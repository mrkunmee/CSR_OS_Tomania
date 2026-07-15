/**
 * Deterministic confidence engine (Blueprint §9).
 *
 * The AI reports its own confidence, but that number can't be trusted blindly.
 * This computes an independent, code-derived confidence from data quality:
 * completeness, missing fields, decision-maker presence, and consistency. A CSR
 * (and the learning engine later) can compare the two.
 */

export type ConfidenceFactor = {
  label: string;
  ok: boolean;
  detail: string;
  deduction: number;
};

export type ConfidenceResult = {
  score: number; // 0-100
  factors: ConfidenceFactor[];
  missingFields: string[];
};

type CompanyLike = {
  products: string | null;
  nafdacStatus: string | null;
  monthlyRevenue: number | null;
  marketingBudget: number | null;
  salesChannels: string | null;
  website: string | null;
};

const KEY_FIELDS: { key: keyof CompanyLike; label: string }[] = [
  { key: "products", label: "Products" },
  { key: "nafdacStatus", label: "NAFDAC status" },
  { key: "monthlyRevenue", label: "Monthly revenue" },
  { key: "marketingBudget", label: "Marketing budget" },
  { key: "salesChannels", label: "Sales channels" },
  { key: "website", label: "Website" },
];

function isEmpty(v: unknown): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.trim() === "");
}

export function computeDataConfidence(input: {
  answered: number;
  totalBaseQuestions: number;
  isDecisionMaker: boolean;
  company: CompanyLike | null;
}): ConfidenceResult {
  const factors: ConfidenceFactor[] = [];
  const company = input.company;

  // 1) Interview completeness (up to -30)
  const ratio =
    input.totalBaseQuestions > 0 ? Math.min(1, input.answered / input.totalBaseQuestions) : 0;
  const completenessDeduction = Math.round(30 * (1 - ratio));
  factors.push({
    label: "Interview completeness",
    ok: ratio >= 0.8,
    detail: `${input.answered}/${input.totalBaseQuestions} core questions answered`,
    deduction: completenessDeduction,
  });

  // 2) Missing key company fields (-6 each)
  const missingFields: string[] = [];
  for (const f of KEY_FIELDS) {
    if (!company || isEmpty(company[f.key])) missingFields.push(f.label);
  }
  const missingDeduction = missingFields.length * 6;
  factors.push({
    label: "Profile fields present",
    ok: missingFields.length === 0,
    detail:
      missingFields.length === 0
        ? "All key fields captured"
        : `Missing: ${missingFields.join(", ")}`,
    deduction: missingDeduction,
  });

  // 3) Decision-maker presence (-15)
  factors.push({
    label: "Decision maker engaged",
    ok: input.isDecisionMaker,
    detail: input.isDecisionMaker
      ? "Contact is the decision maker"
      : "Contact is not the decision maker",
    deduction: input.isDecisionMaker ? 0 : 15,
  });

  // 4) Consistency check (-8): a committed budget with no evidence of revenue is thin.
  const budgetNoRevenue =
    company != null && !isEmpty(company.marketingBudget) && isEmpty(company.monthlyRevenue);
  factors.push({
    label: "Financial consistency",
    ok: !budgetNoRevenue,
    detail: budgetNoRevenue
      ? "Budget stated but revenue unknown — hard to validate spend"
      : "No obvious financial contradictions",
    deduction: budgetNoRevenue ? 8 : 0,
  });

  const totalDeduction = factors.reduce((s, f) => s + f.deduction, 0);
  const score = Math.max(0, Math.min(100, 100 - totalDeduction));

  return { score, factors, missingFields };
}
