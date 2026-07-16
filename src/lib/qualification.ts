import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { canTransition } from "@/lib/lead-status";
import { buildQualificationPrompt, runQualificationAI } from "@/lib/gemini";
import { evaluatePartnerNeeds } from "@/lib/partners";
import type { LeadStatus } from "@/generated/prisma/enums";

const DEFAULT_TEMPLATE = `You are the AI qualification analyst for a Nigerian Meta Ads agency serving supplement and herbal brands. Assess the lead using the interview answers and company profile. Recommend the best-fit agency package and flag upsell/partner opportunities (NAFDAC, logistics, branding, website, creatives).`;

/**
 * Run the Gemini qualification engine for a lead and persist the results
 * (Score + Recommendation + audit). Returns the new recommendation id.
 * Throws if the AI call fails — the caller surfaces the error.
 */
export async function generateRecommendationForLead(leadId: string, actorId: string) {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { company: true },
  });
  if (!lead) throw new Error("Lead not found.");
  const { organizationId } = lead;

  // Latest call that has answers.
  const call = await prisma.call.findFirst({
    where: { leadId, organizationId, responses: { some: {} } },
    include: { responses: { orderBy: { createdAt: "asc" } } },
    orderBy: { startedAt: "desc" },
  });

  const [packages, template, questions] = await Promise.all([
    prisma.package.findMany({ where: { active: true, organizationId } }),
    prisma.promptTemplate.findFirst({ where: { active: true, organizationId }, orderBy: { version: "desc" } }),
    prisma.qualificationQuestion.findMany({ where: { active: true, organizationId }, select: { key: true, category: true } }),
  ]);

  // Map interview answers to their question category for the partner rules.
  const categoryByKey = new Map(questions.map((q) => [q.key, q.category]));
  const byCategory = new Map<string, string>();
  for (const r of call?.responses ?? []) {
    const cat = categoryByKey.get(r.questionKey);
    if (cat) byCategory.set(cat, r.answer.toLowerCase());
  }

  const promptInput = {
    templateBody: template?.body ?? DEFAULT_TEMPLATE,
    lead: {
      contactName: lead.contactName,
      source: lead.source,
      isDecisionMaker: lead.isDecisionMaker,
      status: lead.status,
    },
    company: {
      name: lead.company?.name,
      industry: lead.company?.industry,
      products: lead.company?.products,
      nafdacStatus: lead.company?.nafdacStatus,
      monthlyRevenue: lead.company?.monthlyRevenue,
      marketingBudget: lead.company?.marketingBudget,
      salesChannels: lead.company?.salesChannels,
      website: lead.company?.website,
    },
    responses: (call?.responses ?? []).map((r) => ({ question: r.questionText, answer: r.answer })),
    packages: packages.map((p) => ({
      name: p.name,
      priceMin: p.priceMin,
      priceMax: p.priceMax,
      minBudget: p.minBudget,
      features: p.features,
    })),
  };

  const prompt = buildQualificationPrompt(promptInput);
  const { result, rawText, modelUsed } = await runQualificationAI(prompt);

  // Resolve the recommended package by name (case-insensitive).
  const pkg = result.recommendedPackageName
    ? packages.find(
        (p) => p.name.toLowerCase() === result.recommendedPackageName!.toLowerCase(),
      )
    : undefined;

  const recommendation = await prisma.recommendation.create({
    data: {
      leadId,
      organizationId,
      outcome: result.outcome,
      packageId: pkg?.id ?? null,
      estimatedValue: result.estimatedValue,
      reasoning: result.reasoning,
      signals: result.signals,
      positiveFactors: result.positiveFactors,
      negativeFactors: result.negativeFactors,
      ruleReferences: result.ruleReferences,
      risks: result.risks,
      opportunities: result.opportunities,
      objections: result.objections,
      buyingSignals: result.buyingSignals,
      followUpPlan: result.followUpPlan,
      confidenceLevel: result.confidenceScore,
      promptTemplateVersion: template?.version ?? null,
      rawModelInput: { prompt },
      rawModelOutput: rawText,
      modelName: modelUsed,
    },
  });

  await prisma.score.create({
    data: {
      leadId,
      organizationId,
      callId: call?.id ?? null,
      leadScore: result.leadScore,
      confidenceScore: result.confidenceScore,
    },
  });

  // Deterministic partner referrals (§7). Rebuild from scratch so re-runs are idempotent.
  const needs = evaluatePartnerNeeds({ company: lead.company, byCategory });
  const services = await prisma.partnerService.findMany({ where: { active: true, organizationId } });
  await prisma.partnerReferral.deleteMany({ where: { leadId } });
  for (const need of needs) {
    const service = services.find((s) => s.type === need.type);
    if (service) {
      await prisma.partnerReferral.create({
        data: { leadId, organizationId, partnerServiceId: service.id, reason: need.reason },
      });
    }
  }

  // Follow-up tasks (§8 follow-up, §12 cadence). Timed from the outcome's cadence;
  // replace prior open tasks so re-runs stay idempotent.
  const cadence = await prisma.followUpCadence.findFirst({
    where: { outcome: result.outcome, active: true, organizationId },
  });
  const offsetDays = cadence?.offsetDays ?? 3;
  const firstDue = new Date(Date.now() + offsetDays * 86_400_000);
  await prisma.task.deleteMany({ where: { leadId, status: "OPEN" } });
  for (const [i, step] of result.followUpPlan.entries()) {
    await prisma.task.create({
      data: {
        leadId,
        organizationId,
        title: step.timing ? `${step.step} (${step.timing})` : step.step,
        dueAt: new Date(firstDue.getTime() + i * 2 * 86_400_000),
        status: "OPEN",
      },
    });
  }

  // The AI outcome maps 1:1 to a lead status; move the lead if allowed.
  const target = result.outcome as LeadStatus;
  if (canTransition(lead.status, target)) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: target } });
  }

  await logAudit({
    action: "AI_DECISION",
    organizationId,
    actorId,
    leadId,
    summary: `AI qualified: ${result.outcome} (score ${result.leadScore}, confidence ${result.confidenceScore})`,
    metadata: {
      model: modelUsed,
      promptVersion: template?.version ?? null,
      leadScore: result.leadScore,
      confidenceScore: result.confidenceScore,
      outcome: result.outcome,
      partnerReferrals: needs.length,
    },
  });

  return recommendation.id;
}
