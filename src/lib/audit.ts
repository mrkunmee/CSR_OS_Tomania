import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { AuditAction } from "@/generated/prisma/enums";

/**
 * Central audit writer (Blueprint §13). Every side-effectful action —
 * CSR actions, AI decisions, overrides, status/score changes — goes through here.
 */
export async function logAudit(input: {
  action: AuditAction;
  actorId?: string | null;
  leadId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      action: input.action,
      actorId: input.actorId ?? undefined,
      leadId: input.leadId ?? undefined,
      summary: input.summary,
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    },
  });
}
