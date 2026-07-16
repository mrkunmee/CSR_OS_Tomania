"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";

export type PromptState = { error?: string; ok?: boolean } | undefined;

/** Create a new version of a prompt (never mutates history), optionally activating it. */
export async function saveNewVersion(
  _prev: PromptState,
  formData: FormData,
): Promise<PromptState> {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const activate = formData.get("activate") === "on";
  if (!name || !body) return { error: "Name and body are required." };

  const latest = await prisma.promptTemplate.findFirst({
    where: { name, organizationId },
    orderBy: { version: "desc" },
  });
  const version = (latest?.version ?? 0) + 1;

  if (activate) {
    await prisma.promptTemplate.updateMany({ where: { name, organizationId }, data: { active: false } });
  }
  await prisma.promptTemplate.create({ data: { name, body, version, active: activate, organizationId } });

  await logAudit({
    action: "CSR_ACTION",
    organizationId,
    actorId: user.id,
    summary: `Prompt "${name}" v${version} created${activate ? " and activated" : ""}`,
    metadata: { name, version, activated: activate },
  });

  revalidatePath("/admin/prompts");
  return { ok: true };
}

/** Make a specific version the active one (deactivates the others of that name). */
export async function activateVersion(
  _prev: PromptState,
  formData: FormData,
): Promise<PromptState> {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");
  const tpl = await prisma.promptTemplate.findFirst({ where: { id, organizationId } });
  if (!tpl) return { error: "Prompt not found." };

  await prisma.promptTemplate.updateMany({ where: { name: tpl.name, organizationId }, data: { active: false } });
  await prisma.promptTemplate.update({ where: { id }, data: { active: true } });

  await logAudit({
    action: "CSR_ACTION",
    organizationId,
    actorId: user.id,
    summary: `Activated prompt "${tpl.name}" v${tpl.version}`,
    metadata: { name: tpl.name, version: tpl.version },
  });

  revalidatePath("/admin/prompts");
  return { ok: true };
}
