import type { PrismaClient } from "@/generated/prisma/client";

/**
 * Canonical starter configuration for a new organization (Blueprint §12).
 * One source of truth, used by both the seed script and self-serve signup (3.4c)
 * so every new agency begins with a working qualification setup.
 */
export const DEFAULT_PACKAGES = [
  { name: "Starter", description: "Entry Meta Ads management", priceMin: 150000, priceMax: 250000, minBudget: 100000 },
  { name: "Growth", description: "Scaling ads + creatives", priceMin: 300000, priceMax: 500000, minBudget: 300000 },
  { name: "Premium", description: "Full-funnel + branding + logistics", priceMin: 600000, priceMax: 1000000, minBudget: 700000 },
];

export const DEFAULT_PARTNERS = [
  { name: "NAFDAC Registration Partner", type: "NAFDAC" as const, description: "Handles NAFDAC product registration" },
  { name: "Logistics Partner", type: "LOGISTICS" as const, description: "Nationwide delivery & fulfilment" },
  { name: "Branding Studio", type: "BRANDING" as const, description: "Brand identity & packaging" },
  { name: "Website Service", type: "WEBSITE" as const, description: "Landing pages & storefronts" },
  { name: "Creative Studio", type: "CREATIVE" as const, description: "Ad creatives & UGC" },
];

export const DEFAULT_WEIGHTS = [
  { key: "budget", weight: 0.3 },
  { key: "revenue", weight: 0.2 },
  { key: "decisionMaker", weight: 0.2 },
  { key: "nafdac", weight: 0.15 },
  { key: "productMarketFit", weight: 0.15 },
];

export const DEFAULT_THRESHOLDS = [
  { key: "qualifiedMinScore", value: 70 },
  { key: "conditionalMinScore", value: 50 },
  { key: "nurtureMinScore", value: 30 },
];

export const DEFAULT_QUESTIONS: {
  key: string;
  text: string;
  category: string;
  order: number;
  branchRules?: Record<string, string[]>;
}[] = [
  { key: "businessProfile", text: "Tell me about your business and what you sell.", category: "businessProfile", order: 1 },
  { key: "products", text: "What products do you currently offer?", category: "businessProfile", order: 2 },
  { key: "revenue", text: "What is your approximate monthly revenue?", category: "revenue", order: 3 },
  { key: "budget", text: "What monthly budget can you commit to marketing?", category: "budget", order: 4 },
  { key: "decisionMaker", text: "Are you the decision maker for this spend?", category: "decisionMaker", order: 5 },
  { key: "nafdac", text: "Are your products NAFDAC registered?", category: "nafdac", order: 6, branchRules: { no: ["nafdacTimeline"], pending: ["nafdacTimeline"] } },
  { key: "nafdacTimeline", text: "When do you plan to complete NAFDAC registration?", category: "nafdac", order: 7 },
  { key: "logistics", text: "How do you currently handle delivery/logistics?", category: "logistics", order: 8 },
  { key: "branding", text: "How would you rate your current branding?", category: "branding", order: 9 },
  { key: "website", text: "Do you have a website or online store?", category: "website", order: 10 },
  { key: "salesChannels", text: "Which channels drive most of your sales today?", category: "salesChannels", order: 11 },
  { key: "goals", text: "What are your main goals for the next 3 months?", category: "goals", order: 12 },
  { key: "painPoints", text: "What is your biggest pain point right now?", category: "painPoints", order: 13 },
];

export const DEFAULT_CADENCES = [
  { outcome: "QUALIFIED" as const, offsetDays: 1 },
  { outcome: "QUALIFIED_WITH_CONDITIONS" as const, offsetDays: 2 },
  { outcome: "NEEDS_NURTURING" as const, offsetDays: 7 },
  { outcome: "PARTNER_REFERRAL" as const, offsetDays: 3 },
  { outcome: "DISQUALIFIED_WITH_ROADMAP" as const, offsetDays: 30 },
];

export const DEFAULT_PROMPT = {
  name: "qualification",
  version: 1,
  body: [
    "You are a sales qualification analyst for a Nigerian Meta Ads agency serving supplement and herbal brands.",
    "Given the lead profile and interview responses, return a structured qualification.",
    "Never output a bare 'Not Qualified' — always map to one of the five outcomes and include a roadmap.",
    "Explain every decision: signals used, positive factors, negative factors, and business-rule references.",
    "Recommend partners for gaps: missing NAFDAC, weak logistics, weak branding, weak website, poor creatives.",
  ].join("\n"),
};

/** Populate a fresh organization with the default config. Assumes the org is empty. */
export async function seedOrgDefaults(client: PrismaClient, organizationId: string) {
  await client.package.createMany({ data: DEFAULT_PACKAGES.map((p) => ({ ...p, organizationId })) });
  await client.partnerService.createMany({ data: DEFAULT_PARTNERS.map((p) => ({ ...p, organizationId })) });
  await client.scoringWeight.createMany({ data: DEFAULT_WEIGHTS.map((w) => ({ ...w, organizationId })) });
  await client.qualificationThreshold.createMany({ data: DEFAULT_THRESHOLDS.map((t) => ({ ...t, organizationId })) });
  await client.qualificationQuestion.createMany({ data: DEFAULT_QUESTIONS.map((q) => ({ ...q, organizationId })) });
  await client.followUpCadence.createMany({ data: DEFAULT_CADENCES.map((c) => ({ ...c, organizationId })) });
  await client.promptTemplate.create({ data: { ...DEFAULT_PROMPT, organizationId } });
}
