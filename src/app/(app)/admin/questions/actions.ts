"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { requireRole } from "@/lib/auth-helpers";
import { logAudit } from "@/lib/audit";
import { parseBranchRulesText } from "@/lib/branch-rules";

export type QuestionState = { error?: string; ok?: boolean } | undefined;

/** Create or update an interview question, including its branching rules (§5). */
export async function saveQuestion(
  _prev: QuestionState,
  formData: FormData,
): Promise<QuestionState> {
  const user = await requireRole("ADMIN");
  const id = String(formData.get("id") ?? "");
  const key = String(formData.get("key") ?? "").trim();
  const text = String(formData.get("text") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const order = parseInt(String(formData.get("order") ?? ""), 10);
  const active = formData.get("active") === "on";
  const branchText = String(formData.get("branchRules") ?? "");

  if (!key || !text || !category || !Number.isFinite(order)) {
    return { error: "Key, text, category, and order are all required." };
  }

  const { rules, targets } = parseBranchRulesText(branchText);

  // Reject branch targets that don't reference a real question key.
  const all = await prisma.qualificationQuestion.findMany({ select: { key: true } });
  const known = new Set(all.map((q) => q.key));
  known.add(key);
  const unknown = [...new Set(targets.filter((t) => !known.has(t)))];
  if (unknown.length) {
    return { error: `Unknown branch target key(s): ${unknown.join(", ")}` };
  }

  const data = {
    text,
    category,
    order,
    active,
    branchRules: rules as Prisma.InputJsonValue,
  };

  try {
    if (id) {
      await prisma.qualificationQuestion.update({ where: { id }, data });
    } else {
      await prisma.qualificationQuestion.create({ data: { key, ...data } });
    }
  } catch {
    return { error: "Save failed — is the key unique?" };
  }

  await logAudit({
    action: "CSR_ACTION",
    actorId: user.id,
    summary: `Interview question "${key}" ${id ? "updated" : "created"}`,
  });
  revalidatePath("/admin/questions");
  return { ok: true };
}
