"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import type { PartnerType } from "@/generated/prisma/enums";

function intOrNull(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? "").trim();
  if (s === "") return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

async function audit(organizationId: string, actorId: string, summary: string) {
  await logAudit({ action: "CSR_ACTION", organizationId, actorId, summary });
  revalidatePath("/admin/config");
}

/** Create or update a package (no delete — toggle `active` instead). Org-scoped. */
export async function savePackage(formData: FormData) {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const data = {
    name,
    description: String(formData.get("description") ?? "").trim() || null,
    priceMin: intOrNull(formData.get("priceMin")),
    priceMax: intOrNull(formData.get("priceMax")),
    minBudget: intOrNull(formData.get("minBudget")),
    active: formData.get("active") === "on",
  };
  if (id) await prisma.package.updateMany({ where: { id, organizationId }, data });
  else await prisma.package.create({ data: { ...data, organizationId } });
  await audit(organizationId, user.id, `Package "${name}" ${id ? "updated" : "created"}`);
}

export async function savePartner(formData: FormData) {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as PartnerType;
  if (!name || !type) return;
  const data = {
    name,
    type,
    description: String(formData.get("description") ?? "").trim() || null,
    active: formData.get("active") === "on",
  };
  if (id) await prisma.partnerService.updateMany({ where: { id, organizationId }, data });
  else await prisma.partnerService.create({ data: { ...data, organizationId } });
  await audit(organizationId, user.id, `Partner service "${name}" ${id ? "updated" : "created"}`);
}

export async function saveWeight(formData: FormData) {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");
  const weight = parseFloat(String(formData.get("weight") ?? ""));
  if (!id || !Number.isFinite(weight)) return;
  await prisma.scoringWeight.updateMany({
    where: { id, organizationId },
    data: { weight, active: formData.get("active") === "on" },
  });
  await audit(organizationId, user.id, `Scoring weight updated`);
}

export async function saveThreshold(formData: FormData) {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");
  const value = parseFloat(String(formData.get("value") ?? ""));
  if (!id || !Number.isFinite(value)) return;
  await prisma.qualificationThreshold.updateMany({ where: { id, organizationId }, data: { value } });
  await audit(organizationId, user.id, `Threshold updated`);
}

export async function saveCadence(formData: FormData) {
  const user = await requireRole("ADMIN");
  const organizationId = user.organizationId;
  const id = String(formData.get("id") ?? "");
  const offsetDays = intOrNull(formData.get("offsetDays"));
  if (!id || offsetDays == null) return;
  await prisma.followUpCadence.updateMany({
    where: { id, organizationId },
    data: { offsetDays, active: formData.get("active") === "on" },
  });
  await audit(organizationId, user.id, `Follow-up cadence updated`);
}
