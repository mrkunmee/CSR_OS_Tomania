import { prisma } from "@/lib/prisma";
import { ALL_LEAD_STATUSES } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";

const POSITIVE_OUTCOMES = new Set(["QUALIFIED", "QUALIFIED_WITH_CONDITIONS"]);

export type Analytics = Awaited<ReturnType<typeof computeAnalytics>>;

/** All Phase-2.3 metrics (§4), computed from the DB. Deterministic, no AI. */
export async function computeAnalytics(organizationId: string) {
  const [leads, recs, referrals, scores] = await Promise.all([
    prisma.lead.findMany({ where: { organizationId }, include: { assignedTo: true } }),
    prisma.recommendation.findMany({
      where: { organizationId },
      include: { recommendedPackage: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.partnerReferral.findMany({ where: { organizationId }, include: { partnerService: true } }),
    prisma.score.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } }),
  ]);

  // Pipeline funnel — count per status, in lifecycle order.
  const statusCount = new Map<LeadStatus, number>();
  for (const s of ALL_LEAD_STATUSES) statusCount.set(s, 0);
  for (const l of leads) statusCount.set(l.status, (statusCount.get(l.status) ?? 0) + 1);
  const funnel = ALL_LEAD_STATUSES.map((s) => ({ status: s, count: statusCount.get(s) ?? 0 }));

  const total = leads.length;
  const won = statusCount.get("WON") ?? 0;
  const lost = statusCount.get("LOST") ?? 0;
  const resolved = won + lost;
  const winRate = resolved > 0 ? Math.round((won / resolved) * 100) : null;

  // CSR performance.
  const csrMap = new Map<string, { name: string; assigned: number; qualified: number; won: number }>();
  for (const l of leads) {
    if (!l.assignedTo) continue;
    const key = l.assignedTo.id;
    const row = csrMap.get(key) ?? {
      name: l.assignedTo.name ?? l.assignedTo.email,
      assigned: 0,
      qualified: 0,
      won: 0,
    };
    row.assigned++;
    if (["QUALIFIED", "QUALIFIED_WITH_CONDITIONS", "WON"].includes(l.status)) row.qualified++;
    if (l.status === "WON") row.won++;
    csrMap.set(key, row);
  }
  const csrRows = [...csrMap.values()].sort((a, b) => b.assigned - a.assigned);

  // Latest recommendation + score per lead (recs/scores are desc-ordered).
  const latestRec = new Map<string, (typeof recs)[number]>();
  for (const r of recs) if (!latestRec.has(r.leadId)) latestRec.set(r.leadId, r);
  const latestScore = new Map<string, number>();
  for (const s of scores) if (!latestScore.has(s.leadId)) latestScore.set(s.leadId, s.leadScore);

  // Score-vs-outcome accuracy: predicted positive vs actual won/lost.
  let correct = 0;
  let resolvedWithRec = 0;
  let sumScoreWon = 0;
  let nWon = 0;
  let sumScoreLost = 0;
  let nLost = 0;
  for (const l of leads) {
    if (l.status !== "WON" && l.status !== "LOST") continue;
    const rec = latestRec.get(l.id);
    const score = latestScore.get(l.id);
    if (score != null) {
      if (l.status === "WON") { sumScoreWon += score; nWon++; }
      else { sumScoreLost += score; nLost++; }
    }
    if (!rec) continue;
    resolvedWithRec++;
    const predictedPositive = POSITIVE_OUTCOMES.has(rec.outcome);
    if ((l.status === "WON" && predictedPositive) || (l.status === "LOST" && !predictedPositive)) {
      correct++;
    }
  }
  const accuracy = {
    resolvedWithRec,
    correct,
    accuracyPct: resolvedWithRec > 0 ? Math.round((correct / resolvedWithRec) * 100) : null,
    avgScoreWon: nWon > 0 ? Math.round(sumScoreWon / nWon) : null,
    avgScoreLost: nLost > 0 ? Math.round(sumScoreLost / nLost) : null,
  };

  // Package mix (latest rec per lead).
  const pkgMap = new Map<string, number>();
  for (const r of latestRec.values()) {
    const name = r.recommendedPackage?.name ?? "None";
    pkgMap.set(name, (pkgMap.get(name) ?? 0) + 1);
  }
  const packageMix = [...pkgMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Partner referral volume by type.
  const partnerMap = new Map<string, number>();
  for (const ref of referrals) {
    partnerMap.set(ref.partnerService.type, (partnerMap.get(ref.partnerService.type) ?? 0) + 1);
  }
  const partnerMix = [...partnerMap.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);

  return { total, won, lost, winRate, funnel, csrRows, accuracy, packageMix, partnerMix };
}
