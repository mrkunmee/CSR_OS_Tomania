"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { companySchema, leadSchema } from "@/lib/validation";
import { canTransition } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";

export type FormState =
  | { error?: string; fieldErrors?: Record<string, string> }
  | undefined;

function parse(formData: FormData) {
  const company = companySchema.safeParse({
    name: formData.get("companyName"),
    industry: formData.get("industry"),
    products: formData.get("products"),
    nafdacStatus: formData.get("nafdacStatus"),
    monthlyRevenue: formData.get("monthlyRevenue"),
    marketingBudget: formData.get("marketingBudget"),
    salesChannels: formData.get("salesChannels"),
    website: formData.get("website"),
  });
  const lead = leadSchema.safeParse({
    contactName: formData.get("contactName"),
    contactPhone: formData.get("contactPhone"),
    contactEmail: formData.get("contactEmail"),
    source: formData.get("source"),
    isDecisionMaker: formData.get("isDecisionMaker") === "on",
    assignedToId: formData.get("assignedToId"),
  });
  return { company, lead };
}

function collectErrors(
  ...results: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }[]
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};
  for (const r of results) {
    if (!r.success && r.error) {
      for (const issue of r.error.issues) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
    }
  }
  return fieldErrors;
}

export async function createLead(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const { company, lead } = parse(formData);
  if (!company.success || !lead.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: collectErrors(company, lead),
    };
  }

  // CSRs can only create leads assigned to themselves.
  const assignedToId =
    user.role === "CSR" ? user.id : lead.data.assignedToId || null;

  // Nested write: creates the Company and Lead atomically in one statement
  // (avoids interactive $transaction, which times out over the Supabase pooler).
  const created = await prisma.lead.create({
    data: {
      contactName: lead.data.contactName,
      contactPhone: lead.data.contactPhone,
      contactEmail: lead.data.contactEmail ?? null,
      source: lead.data.source,
      isDecisionMaker: lead.data.isDecisionMaker ?? false,
      status: assignedToId ? "ASSIGNED" : "NEW",
      company: { create: { ...company.data } },
      ...(assignedToId ? { assignedTo: { connect: { id: assignedToId } } } : {}),
    },
  });

  await logAudit({
    action: "CSR_ACTION",
    actorId: user.id,
    leadId: created.id,
    summary: `Lead created for ${company.data.name}`,
  });

  redirect(`/leads/${created.id}`);
}

export async function updateLead(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const leadId = String(formData.get("leadId") ?? "");
  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) return { error: "Lead not found." };
  if (user.role === "CSR" && existing.assignedToId !== user.id) {
    return { error: "You can only edit leads assigned to you." };
  }

  const { company, lead } = parse(formData);
  if (!company.success || !lead.success) {
    return {
      error: "Please fix the highlighted fields.",
      fieldErrors: collectErrors(company, lead),
    };
  }

  // Nested write updates (or creates) the linked Company atomically with the Lead.
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      contactName: lead.data.contactName,
      contactPhone: lead.data.contactPhone,
      contactEmail: lead.data.contactEmail ?? null,
      source: lead.data.source,
      isDecisionMaker: lead.data.isDecisionMaker ?? false,
      company: existing.companyId
        ? { update: { ...company.data } }
        : { create: { ...company.data } },
    },
  });

  await logAudit({
    action: "CSR_ACTION",
    actorId: user.id,
    leadId,
    summary: `Lead details updated`,
  });

  redirect(`/leads/${leadId}`);
}

export async function assignLead(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  if (user.role === "CSR") return { error: "Only managers can reassign leads." };

  const leadId = String(formData.get("leadId") ?? "");
  const raw = String(formData.get("assignedToId") ?? "");
  const assignedToId = raw || null;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };

  const status: LeadStatus =
    assignedToId && lead.status === "NEW" ? "ASSIGNED" : lead.status;

  const assignee = assignedToId
    ? await prisma.user.findUnique({ where: { id: assignedToId } })
    : null;

  await prisma.lead.update({
    where: { id: leadId },
    data: { assignedToId, status },
  });

  await logAudit({
    action: "CSR_ACTION",
    actorId: user.id,
    leadId,
    summary: assignedToId
      ? `Assigned to ${assignee?.name ?? assignee?.email ?? "user"}`
      : "Unassigned",
  });

  revalidatePath(`/leads/${leadId}`);
  return undefined;
}

export async function changeLeadStatus(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const leadId = String(formData.get("leadId") ?? "");
  const status = String(formData.get("status") ?? "") as LeadStatus;

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) return { error: "Lead not found." };
  if (user.role === "CSR" && lead.assignedToId !== user.id) {
    return { error: "You can only update leads assigned to you." };
  }
  if (!canTransition(lead.status, status)) {
    return { error: `Cannot move from ${lead.status} to ${status}.` };
  }

  await prisma.lead.update({ where: { id: leadId }, data: { status } });

  await logAudit({
    action: "LEAD_STATUS_CHANGE",
    actorId: user.id,
    leadId,
    summary: `Status: ${lead.status} → ${status}`,
    metadata: { from: lead.status, to: status },
  });

  revalidatePath(`/leads/${leadId}`);
  return undefined;
}
