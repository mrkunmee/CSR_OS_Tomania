"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { canTransition } from "@/lib/lead-status";
import { buildCallAssistPrompt, runCallAssist, type CallAssist } from "@/lib/gemini";
import { rateLimit } from "@/lib/rate-limit";

/** Load a lead and enforce that the current user may work on it. */
async function authorizeLead(leadId: string) {
  const user = await requireUser();
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: user.organizationId },
  });
  if (!lead) return { user, lead: null as null };
  if (user.role === "CSR" && lead.assignedToId !== user.id) {
    return { user, lead: null as null };
  }
  return { user, lead };
}

/** Start (or resume) a qualification interview for a lead. */
export async function startInterview(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const { user, lead } = await authorizeLead(leadId);
  if (!lead) return;
  const organizationId = lead.organizationId;

  // Reuse an open call if one exists; otherwise create one.
  const existing = await prisma.call.findFirst({
    where: { leadId, organizationId, endedAt: null },
  });
  if (!existing) {
    await prisma.call.create({ data: { leadId, csrId: user.id, organizationId } });
    if (canTransition(lead.status, "IN_QUALIFICATION")) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { status: "IN_QUALIFICATION" },
      });
    }
    await logAudit({
      action: "CSR_ACTION",
      organizationId,
      actorId: user.id,
      leadId,
      summary: "Qualification interview started",
    });
  }

  revalidatePath(`/leads/${leadId}/interview`);
}

export type SaveState = { saved?: boolean; error?: string } | undefined;

/** Persist the answers entered so far (upsert per question). */
export async function saveResponses(
  _prev: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const leadId = String(formData.get("leadId") ?? "");
  const callId = String(formData.get("callId") ?? "");
  const { user, lead } = await authorizeLead(leadId);
  if (!lead) return { error: "Not allowed." };
  const organizationId = lead.organizationId;

  const call = await prisma.call.findFirst({
    where: { id: callId, leadId, organizationId, endedAt: null },
  });
  if (!call) return { error: "This interview is no longer open." };

  const questions = await prisma.qualificationQuestion.findMany({
    where: { active: true, organizationId },
    select: { key: true, text: true },
  });
  const textByKey = new Map(questions.map((q) => [q.key, q.text]));

  let saved = 0;
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith("answer__")) continue;
    const questionKey = field.slice("answer__".length);
    const answer = String(value).trim();
    const questionText = textByKey.get(questionKey);
    if (!questionText) continue; // unknown/inactive question

    if (answer === "") {
      // Clear a previously-saved answer if emptied.
      await prisma.response.deleteMany({ where: { callId, questionKey } });
      continue;
    }
    await prisma.response.upsert({
      where: { callId_questionKey: { callId, questionKey } },
      update: { answer, questionText },
      create: { callId, questionKey, questionText, answer, organizationId },
    });
    saved++;
  }

  const notes = formData.get("notes");
  if (notes !== null) {
    await prisma.call.update({
      where: { id: callId },
      data: { notes: String(notes) },
    });
  }

  await logAudit({
    action: "CSR_ACTION",
    organizationId,
    actorId: user.id,
    leadId,
    summary: `Saved ${saved} interview response${saved === 1 ? "" : "s"}`,
  });

  revalidatePath(`/leads/${leadId}/interview`);
  return { saved: true };
}

export type AssistState = { assist?: CallAssist; error?: string } | undefined;

/** On-demand live call guidance (§4) from the answers captured so far. Ephemeral. */
export async function getCallAssist(
  _prev: AssistState,
  formData: FormData,
): Promise<AssistState> {
  const leadId = String(formData.get("leadId") ?? "");
  const { user, lead } = await authorizeLead(leadId);
  if (!lead) return { error: "Not allowed." };
  const organizationId = lead.organizationId;

  const limit = rateLimit(`assist:${user.id}`, 12, 60_000);
  if (!limit.ok) {
    return { error: `Rate limit reached. Try again in ${limit.retryAfterSec}s.` };
  }

  const full = await prisma.lead.findFirst({ where: { id: leadId, organizationId }, include: { company: true } });
  const call = await prisma.call.findFirst({
    where: { leadId, organizationId, endedAt: null },
    include: { responses: { orderBy: { createdAt: "asc" } } },
    orderBy: { startedAt: "desc" },
  });
  const responses = (call?.responses ?? []).map((r) => ({ question: r.questionText, answer: r.answer }));
  if (responses.length === 0) {
    return { error: "Answer at least one question and Save first." };
  }

  const prompt = buildCallAssistPrompt({
    lead: {
      contactName: full?.contactName,
      isDecisionMaker: full?.isDecisionMaker,
      source: full?.source,
    },
    company: {
      name: full?.company?.name,
      products: full?.company?.products,
      nafdacStatus: full?.company?.nafdacStatus,
      marketingBudget: full?.company?.marketingBudget,
      website: full?.company?.website,
    },
    responses,
  });

  try {
    const { result } = await runCallAssist(prompt);
    await logAudit({
      action: "API_CALL",
      organizationId,
      actorId: user.id,
      leadId,
      summary: "Live call assist requested",
    });
    return { assist: result };
  } catch (err) {
    return { error: err instanceof Error ? `AI assist failed: ${err.message}` : "AI assist failed." };
  }
}

/** Mark the interview complete. */
export async function completeInterview(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");
  const callId = String(formData.get("callId") ?? "");
  const { user, lead } = await authorizeLead(leadId);
  if (!lead) return;
  const organizationId = lead.organizationId;

  await prisma.call.updateMany({
    where: { id: callId, leadId, organizationId, endedAt: null },
    data: { endedAt: new Date() },
  });

  await logAudit({
    action: "CSR_ACTION",
    organizationId,
    actorId: user.id,
    leadId,
    summary: "Qualification interview completed",
  });

  redirect(`/leads/${leadId}`);
}
