import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { QualificationOutcome, LeadStatus } from "@/generated/prisma/enums";

/**
 * Continuous learning (Blueprint §11). When a deal resolves (WON/LOST) we compare
 * the AI's prediction to reality and propose a recalibration for a manager to
 * approve. Nothing is auto-applied — proposals are PENDING_REVIEW until a manager
 * acts (see Milestone 3.2).
 */

const POSITIVE = new Set<QualificationOutcome>(["QUALIFIED", "QUALIFIED_WITH_CONDITIONS"]);

export type Suggestion = {
  type: "threshold" | "weight";
  key: string;
  from: number;
  to: number;
  rationale: string;
};
export type Recalibration = {
  predictionCorrect: boolean;
  direction: "over_optimistic" | "under_estimated" | "aligned" | "unknown";
  suggestions: Suggestion[];
};

/** Pure: given a prediction, an actual outcome, and the current threshold, what to propose. */
export function computeRecalibration(
  predictedOutcome: QualificationOutcome | null,
  actualWon: boolean,
  qualifiedMinScore: number | null,
): Recalibration {
  if (predictedOutcome == null) {
    return { predictionCorrect: false, direction: "unknown", suggestions: [] };
  }
  const predictedPositive = POSITIVE.has(predictedOutcome);
  if (predictedPositive === actualWon) {
    return { predictionCorrect: true, direction: "aligned", suggestions: [] };
  }

  const direction = predictedPositive ? "over_optimistic" : "under_estimated";
  const suggestions: Suggestion[] = [];
  if (qualifiedMinScore != null) {
    const delta = direction === "over_optimistic" ? 5 : -5;
    suggestions.push({
      type: "threshold",
      key: "qualifiedMinScore",
      from: qualifiedMinScore,
      to: Math.max(0, Math.min(100, qualifiedMinScore + delta)),
      rationale:
        direction === "over_optimistic"
          ? "Predicted a win but the deal was lost — qualify more conservatively."
          : "Predicted no win but the deal was won — qualify more leads.",
    });
  }
  return { predictionCorrect: false, direction, suggestions };
}

export type LearningAggregate = {
  total: number;
  decided: number; // events that carried a prediction
  correct: number;
  accuracyPct: number | null;
  byDirection: { over_optimistic: number; under_estimated: number; aligned: number; unknown: number };
  netProposal: { key: string; from: number; to: number; rationale: string } | null;
};

/**
 * Aggregate signal across all learning events (§11, Milestone 3.3). Surfaces
 * prediction accuracy and a NET recalibration proposal only when a systematic
 * bias is clear (|over − under| ≥ 2) — avoids chasing single-deal noise.
 */
export async function computeLearningAggregate(): Promise<LearningAggregate> {
  const events = await prisma.learningEvent.findMany({ select: { proposedChanges: true } });

  const byDirection = { over_optimistic: 0, under_estimated: 0, aligned: 0, unknown: 0 };
  let correct = 0;
  for (const e of events) {
    const pc = e.proposedChanges as { direction?: string; predictionCorrect?: boolean } | null;
    const dir = (pc?.direction ?? "unknown") as keyof typeof byDirection;
    if (dir in byDirection) byDirection[dir]++;
    else byDirection.unknown++;
    if (pc?.predictionCorrect) correct++;
  }

  const total = events.length;
  const decided = byDirection.over_optimistic + byDirection.under_estimated + byDirection.aligned;
  const accuracyPct = decided > 0 ? Math.round((correct / decided) * 100) : null;

  let netProposal: LearningAggregate["netProposal"] = null;
  const net = byDirection.over_optimistic - byDirection.under_estimated;
  if (Math.abs(net) >= 2) {
    const th = await prisma.qualificationThreshold.findFirst({ where: { key: "qualifiedMinScore" } });
    if (th) {
      const delta = net > 0 ? 5 : -5;
      netProposal = {
        key: "qualifiedMinScore",
        from: th.value,
        to: Math.max(0, Math.min(100, th.value + delta)),
        rationale:
          net > 0
            ? "Systematically over-optimistic across resolved deals — raise the qualification bar."
            : "Systematically under-estimating — lower the qualification bar.",
      };
    }
  }

  return { total, decided, correct, accuracyPct, byDirection, netProposal };
}

/** Record a LearningEvent for a resolved deal (idempotent per lead+outcome). */
export async function recordLearningEvent(leadId: string, actualOutcome: "WON" | "LOST") {
  const existing = await prisma.learningEvent.findFirst({
    where: { leadId, actualOutcome: actualOutcome as LeadStatus },
  });
  if (existing) return;

  const [rec, score, threshold] = await Promise.all([
    prisma.recommendation.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } }),
    prisma.score.findFirst({ where: { leadId }, orderBy: { createdAt: "desc" } }),
    prisma.qualificationThreshold.findFirst({ where: { key: "qualifiedMinScore" } }),
  ]);

  const recal = computeRecalibration(
    rec?.outcome ?? null,
    actualOutcome === "WON",
    threshold?.value ?? null,
  );

  await prisma.learningEvent.create({
    data: {
      leadId,
      predictedOutcome: rec?.outcome ?? undefined,
      actualOutcome: actualOutcome as LeadStatus,
      predictedScore: score?.leadScore ?? undefined,
      proposedChanges: recal as unknown as Prisma.InputJsonValue,
      status: "PENDING_REVIEW",
    },
  });
}
