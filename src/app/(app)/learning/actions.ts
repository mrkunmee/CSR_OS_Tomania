"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { computeLearningAggregate, type Suggestion } from "@/lib/learning";

/**
 * Manager review of learning events (Blueprint §11 — "managers approve changes").
 * Approving APPLIES the proposed recalibration to the live config; rejecting just
 * records the decision. Both are audited. Nothing is ever auto-applied.
 */
export async function approveLearningEvent(formData: FormData) {
  const user = await requireRole("MANAGER", "ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");

  const event = await prisma.learningEvent.findFirst({ where: { id, organizationId } });
  if (!event || event.status !== "PENDING_REVIEW") return;

  const proposed = event.proposedChanges as { suggestions?: Suggestion[] } | null;
  const suggestions = Array.isArray(proposed?.suggestions) ? proposed.suggestions : [];

  const applied: string[] = [];
  for (const s of suggestions) {
    if (s.type === "threshold") {
      const th = await prisma.qualificationThreshold.findFirst({ where: { key: s.key, organizationId } });
      if (th) {
        await prisma.qualificationThreshold.update({ where: { id: th.id }, data: { value: s.to } });
        applied.push(`${s.key} ${s.from}→${s.to}`);
      }
    } else if (s.type === "weight") {
      const w = await prisma.scoringWeight.findFirst({ where: { key: s.key, organizationId } });
      if (w) {
        await prisma.scoringWeight.update({ where: { id: w.id }, data: { weight: s.to } });
        applied.push(`${s.key} ${s.from}→${s.to}`);
      }
    }
  }

  await prisma.learningEvent.update({
    where: { id },
    data: { status: "APPROVED", reviewerId: user.id, reviewedAt: new Date() },
  });

  await logAudit({
    action: "MANAGER_OVERRIDE",
    organizationId,
    actorId: user.id,
    leadId: event.leadId ?? undefined,
    summary: applied.length
      ? `Approved recalibration: ${applied.join(", ")}`
      : "Approved learning event (no config change)",
    metadata: { learningEventId: id, applied },
  });

  revalidatePath("/learning");
}

/** Apply the aggregate net recalibration (§11, 3.3). Recomputed server-side to avoid stale input. */
export async function applyAggregateRecalibration() {
  const user = await requireRole("MANAGER", "ADMIN");
  const organizationId = user.organizationId;
  const agg = await computeLearningAggregate(organizationId);
  const p = agg.netProposal;
  if (!p) return;

  const th = await prisma.qualificationThreshold.findFirst({ where: { key: p.key, organizationId } });
  if (!th) return;
  await prisma.qualificationThreshold.update({ where: { id: th.id }, data: { value: p.to } });

  await logAudit({
    action: "MANAGER_OVERRIDE",
    organizationId,
    actorId: user.id,
    summary: `Applied aggregate recalibration: ${p.key} ${p.from}→${p.to}`,
    metadata: { aggregate: true, key: p.key, from: p.from, to: p.to },
  });

  revalidatePath("/learning");
}

export async function rejectLearningEvent(formData: FormData) {
  const user = await requireRole("MANAGER", "ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");

  const event = await prisma.learningEvent.findFirst({ where: { id, organizationId } });
  if (!event || event.status !== "PENDING_REVIEW") return;

  await prisma.learningEvent.update({
    where: { id },
    data: { status: "REJECTED", reviewerId: user.id, reviewedAt: new Date() },
  });

  await logAudit({
    action: "MANAGER_OVERRIDE",
    organizationId,
    actorId: user.id,
    leadId: event.leadId ?? undefined,
    summary: "Rejected proposed recalibration",
    metadata: { learningEventId: id },
  });

  revalidatePath("/learning");
}
