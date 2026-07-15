"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { OUTCOMES } from "@/lib/gemini";
import type { LeadStatus, QualificationOutcome } from "@/generated/prisma/enums";

export type ActionState = { error?: string; ok?: boolean } | undefined;

/** CSR/manager marks a follow-up task done. */
export async function completeTask(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  const taskId = String(formData.get("taskId") ?? "");

  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { lead: true } });
  if (!task) return { error: "Task not found." };
  if (user.role === "CSR" && task.lead.assignedToId !== user.id) {
    return { error: "Not your task." };
  }

  await prisma.task.update({ where: { id: taskId }, data: { status: "DONE" } });
  await logAudit({
    action: "CSR_ACTION",
    actorId: user.id,
    leadId: task.leadId,
    summary: `Completed task: ${task.title}`,
  });

  revalidatePath(`/leads/${task.leadId}`);
  return { ok: true };
}

/**
 * Manager human-in-the-loop override (§14). Reason is mandatory. Updates the
 * latest recommendation's override fields and moves the lead to the new outcome.
 */
export async function overrideRecommendation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (user.role === "CSR") return { error: "Only managers can override." };

  const leadId = String(formData.get("leadId") ?? "");
  const outcome = String(formData.get("outcome") ?? "") as QualificationOutcome;
  const reason = String(formData.get("reason") ?? "").trim();
  const packageId = String(formData.get("packageId") ?? "");
  const scoreRaw = String(formData.get("leadScore") ?? "").trim();

  if (!reason) return { error: "A reason is required to override." };
  if (!OUTCOMES.includes(outcome as (typeof OUTCOMES)[number])) {
    return { error: "Pick a valid outcome." };
  }

  const rec = await prisma.recommendation.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
  if (!rec) return { error: "No recommendation to override yet." };

  await prisma.recommendation.update({
    where: { id: rec.id },
    data: {
      outcome,
      packageId: packageId || null,
      overriddenById: user.id,
      overrideReason: reason,
      overriddenAt: new Date(),
    },
  });

  // Managers can move the lead to the overridden outcome directly.
  await prisma.lead.update({
    where: { id: leadId },
    data: { status: outcome as LeadStatus },
  });

  // Optional score adjustment records a new Score snapshot.
  if (scoreRaw !== "") {
    const leadScore = Math.max(0, Math.min(100, parseInt(scoreRaw, 10) || 0));
    await prisma.score.create({
      data: { leadId, leadScore, confidenceScore: rec.confidenceLevel },
    });
    await logAudit({
      action: "SCORE_CHANGE",
      actorId: user.id,
      leadId,
      summary: `Manager set lead score to ${leadScore}`,
    });
  }

  await logAudit({
    action: "MANAGER_OVERRIDE",
    actorId: user.id,
    leadId,
    summary: `Override → ${outcome}: ${reason}`,
    metadata: { from: rec.outcome, to: outcome, reason },
  });

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
