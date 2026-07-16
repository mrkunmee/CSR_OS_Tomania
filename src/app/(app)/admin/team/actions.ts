"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import type { Role } from "@/generated/prisma/enums";

export type TeamState = { error?: string; ok?: string } | undefined;

const ROLES = ["ADMIN", "MANAGER", "CSR"] as const;

/** Add a teammate to the current admin's organization (3.4c). */
export async function addTeamMember(
  _prev: TeamState,
  formData: FormData,
): Promise<TeamState> {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const role = String(formData.get("role") ?? "CSR") as Role;
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!ROLES.includes(role as (typeof ROLES)[number])) return { error: "Invalid role." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name: name || null, role, passwordHash, organizationId },
  });

  await logAudit({
    action: "CSR_ACTION",
    organizationId,
    actorId: user.id,
    summary: `Added team member ${email} (${role})`,
  });

  revalidatePath("/admin/team");
  return { ok: `Added ${email}.` };
}
