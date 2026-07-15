"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { generateRecommendationForLead } from "@/lib/qualification";
import { rateLimit } from "@/lib/rate-limit";

export type QualifyState = { error?: string; ok?: boolean } | undefined;

export async function generateRecommendation(
  _prev: QualifyState,
  formData: FormData,
): Promise<QualifyState> {
  const user = await requireUser();
  const leadId = String(formData.get("leadId") ?? "");

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };
  if (user.role === "CSR" && lead.assignedToId !== user.id) {
    return { error: "You can only qualify leads assigned to you." };
  }

  const limit = rateLimit(`qualify:${user.id}`, 8, 60_000);
  if (!limit.ok) {
    return { error: `Rate limit reached. Try again in ${limit.retryAfterSec}s.` };
  }

  try {
    await generateRecommendationForLead(leadId, user.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Record the failed attempt for auditability.
    await prisma.auditLog.create({
      data: {
        action: "AI_DECISION",
        actorId: user.id,
        leadId,
        summary: "AI qualification failed",
        metadata: { error: message },
      },
    });
    return { error: `AI qualification failed: ${message}` };
  }

  revalidatePath(`/leads/${leadId}`);
  return { ok: true };
}
