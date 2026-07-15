/**
 * Deterministic, config-driven recommendation rules (Blueprint §7 partners, §8 packages).
 *
 * The AI mentions partners in prose; this turns the gaps into structured,
 * explainable referrals and an independent package pick that cross-checks the AI.
 */
import type { PartnerType } from "@/generated/prisma/enums";

export type PartnerNeed = { type: PartnerType; reason: string };

type CompanyLike = {
  nafdacStatus: string | null;
  website: string | null;
};

/** Words in a free-text answer that signal a weakness/gap. */
const NEGATIVE = /\b(no|none|not|don'?t|nil|myself|self|manual|struggle|poor|weak|basic|bad|amateur|diy|informal|whatsapp only)\b/i;

function isWeak(answer: string | undefined): boolean {
  return !!answer && NEGATIVE.test(answer);
}

/**
 * Evaluate which partner services a lead needs. `byCategory` maps a
 * QualificationQuestion.category to the lead's answer (lowercased is fine).
 */
export function evaluatePartnerNeeds(input: {
  company: CompanyLike | null;
  byCategory: Map<string, string>;
}): PartnerNeed[] {
  const { company, byCategory } = input;
  const needs: PartnerNeed[] = [];

  // §7: Missing NAFDAC → compliance partner
  const nafdac = company?.nafdacStatus;
  if (nafdac !== "REGISTERED") {
    needs.push({
      type: "NAFDAC",
      reason: `NAFDAC registration incomplete (status: ${nafdac ?? "unknown"}) — required for compliant supplement ads.`,
    });
  }

  // §7: No website → website service
  const websiteAnswer = byCategory.get("website");
  if ((!company?.website || company.website.trim() === "") && (isWeak(websiteAnswer) || !websiteAnswer)) {
    needs.push({
      type: "WEBSITE",
      reason: "No website/landing page — needed to receive and convert ad traffic.",
    });
  }

  // §7: Weak logistics → logistics partner
  if (isWeak(byCategory.get("logistics"))) {
    needs.push({
      type: "LOGISTICS",
      reason: "Delivery/logistics handled informally — a logistics partner de-risks fulfilment at scale.",
    });
  }

  // §7: Weak branding → branding partner
  if (isWeak(byCategory.get("branding"))) {
    needs.push({
      type: "BRANDING",
      reason: "Branding is weak/basic — stronger branding lifts ad trust and conversion.",
    });
  }

  // §7: Poor creatives (inferred from pain points / goals) → creative service
  const painSignal = `${byCategory.get("painPoints") ?? ""} ${byCategory.get("goals") ?? ""}`;
  if (/\b(creative|content|ad copy|ads not|design|videos?)\b/i.test(painSignal) && NEGATIVE.test(painSignal)) {
    needs.push({
      type: "CREATIVE",
      reason: "Creative/content is a stated pain point — a creative service improves ad output.",
    });
  }

  return needs;
}

export type PackageLike = {
  id: string;
  name: string;
  minBudget: number | null;
  priceMin: number | null;
};

/**
 * Deterministic package pick from budget (§8): the highest-tier package whose
 * minimum budget the lead meets; falls back to the cheapest if none qualify.
 */
export function pickPackageByBudget(
  packages: PackageLike[],
  marketingBudget: number | null,
): PackageLike | null {
  if (packages.length === 0) return null;
  if (marketingBudget == null) {
    return [...packages].sort((a, b) => (a.priceMin ?? 0) - (b.priceMin ?? 0))[0];
  }
  const eligible = packages
    .filter((p) => p.minBudget == null || marketingBudget >= p.minBudget)
    .sort((a, b) => (b.minBudget ?? 0) - (a.minBudget ?? 0));
  if (eligible.length > 0) return eligible[0];
  return [...packages].sort((a, b) => (a.priceMin ?? 0) - (b.priceMin ?? 0))[0];
}
