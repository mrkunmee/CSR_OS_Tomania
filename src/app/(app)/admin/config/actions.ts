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

async function audit(actorId: string, summary: string) {
  await logAudit({ action: "CSR_ACTION", actorId, summary });
  revalidatePath("/admin/config");
}

/** Create or update a package (no delete — toggle `active` instead). */
export async function savePackage(formData: FormData) {
  const user = await requireRole("ADMIN");
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
  if (id) await prisma.package.update({ where: { id }, data });
  else await prisma.package.create({ data });
  await audit(user.id, `Package "${name}" ${id ? "updated" : "created"}`);
}

export async function savePartner(formData: FormData) {
  const user = await requireRole("ADMIN");
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
  if (id) await prisma.partnerService.update({ where: { id }, data });
  else await prisma.partnerService.create({ data });
  await audit(user.id, `Partner service "${name}" ${id ? "updated" : "created"}`);
}

export async function saveWeight(formData: FormData) {
  const user = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const weight = parseFloat(String(formData.get("weight") ?? ""));
  if (!id || !Number.isFinite(weight)) return;
  await prisma.scoringWeight.update({
    where: { id },
    data: { weight, active: formData.get("active") === "on" },
  });
  await audit(user.id, `Scoring weight updated`);
}

export async function saveThreshold(formData: FormData) {
  const user = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const value = parseFloat(String(formData.get("value") ?? ""));
  if (!id || !Number.isFinite(value)) return;
  await prisma.qualificationThreshold.update({ where: { id }, data: { value } });
  await audit(user.id, `Threshold updated`);
}

export async function saveCadence(formData: FormData) {
  const user = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const offsetDays = intOrNull(formData.get("offsetDays"));
  if (!id || offsetDays == null) return;
  await prisma.followUpCadence.update({
    where: { id },
    data: { offsetDays, active: formData.get("active") === "on" },
  });
  await audit(user.id, `Follow-up cadence updated`);
}
