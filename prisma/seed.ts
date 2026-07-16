import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding AI Sales OS...");

  // --- Organization (tenant, Blueprint §20). Fixed id matches the backfill. ---
  const org = await prisma.organization.upsert({
    where: { slug: "tomania" },
    update: {},
    create: { id: "org_default", name: "Tomania Agency", slug: "tomania" },
  });
  const organizationId = org.id;

  // --- Users (one per role, Blueprint §4 RBAC) ---
  const password = await bcrypt.hash("password123", 10);
  const [admin, manager, csr] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@agency.test" },
      update: { organizationId },
      create: { email: "admin@agency.test", name: "Admin", role: "ADMIN", passwordHash: password, organizationId },
    }),
    prisma.user.upsert({
      where: { email: "manager@agency.test" },
      update: { organizationId },
      create: { email: "manager@agency.test", name: "Manager", role: "MANAGER", passwordHash: password, organizationId },
    }),
    prisma.user.upsert({
      where: { email: "csr@agency.test" },
      update: { organizationId },
      create: { email: "csr@agency.test", name: "CSR One", role: "CSR", passwordHash: password, organizationId },
    }),
  ]);

  // --- Packages (Blueprint §12 config-first) ---
  const packages = [
    { name: "Starter", description: "Entry Meta Ads management", priceMin: 150000, priceMax: 250000, minBudget: 100000 },
    { name: "Growth", description: "Scaling ads + creatives", priceMin: 300000, priceMax: 500000, minBudget: 300000 },
    { name: "Premium", description: "Full-funnel + branding + logistics", priceMin: 600000, priceMax: 1000000, minBudget: 700000 },
  ];
  for (const p of packages) {
    await prisma.package.upsert({
      where: { organizationId_name: { organizationId, name: p.name } },
      update: p,
      create: { ...p, organizationId },
    });
  }

  // --- Partner services (Blueprint §7) ---
  const partners = [
    { name: "NAFDAC Registration Partner", type: "NAFDAC" as const, description: "Handles NAFDAC product registration" },
    { name: "Logistics Partner", type: "LOGISTICS" as const, description: "Nationwide delivery & fulfilment" },
    { name: "Branding Studio", type: "BRANDING" as const, description: "Brand identity & packaging" },
    { name: "Website Service", type: "WEBSITE" as const, description: "Landing pages & storefronts" },
    { name: "Creative Studio", type: "CREATIVE" as const, description: "Ad creatives & UGC" },
  ];
  for (const p of partners) {
    const existing = await prisma.partnerService.findFirst({ where: { name: p.name, organizationId } });
    if (!existing) await prisma.partnerService.create({ data: { ...p, organizationId } });
  }

  // --- Scoring weights (Blueprint §12) ---
  const weights = [
    { key: "budget", weight: 0.3 },
    { key: "revenue", weight: 0.2 },
    { key: "decisionMaker", weight: 0.2 },
    { key: "nafdac", weight: 0.15 },
    { key: "productMarketFit", weight: 0.15 },
  ];
  for (const w of weights) {
    await prisma.scoringWeight.upsert({
      where: { organizationId_key: { organizationId, key: w.key } },
      update: w,
      create: { ...w, organizationId },
    });
  }

  // --- Qualification thresholds ---
  const thresholds = [
    { key: "qualifiedMinScore", value: 70 },
    { key: "conditionalMinScore", value: 50 },
    { key: "nurtureMinScore", value: 30 },
  ];
  for (const t of thresholds) {
    await prisma.qualificationThreshold.upsert({
      where: { organizationId_key: { organizationId, key: t.key } },
      update: t,
      create: { ...t, organizationId },
    });
  }

  // --- Dynamic qualification questions (Blueprint §5) ---
  const questions = [
    { key: "businessProfile", text: "Tell me about your business and what you sell.", category: "businessProfile", order: 1 },
    { key: "products", text: "What products do you currently offer?", category: "businessProfile", order: 2 },
    { key: "revenue", text: "What is your approximate monthly revenue?", category: "revenue", order: 3 },
    { key: "budget", text: "What monthly budget can you commit to marketing?", category: "budget", order: 4 },
    { key: "decisionMaker", text: "Are you the decision maker for this spend?", category: "decisionMaker", order: 5 },
    {
      key: "nafdac",
      text: "Are your products NAFDAC registered?",
      category: "nafdac",
      order: 6,
      branchRules: { no: ["nafdacTimeline"], pending: ["nafdacTimeline"] },
    },
    { key: "nafdacTimeline", text: "When do you plan to complete NAFDAC registration?", category: "nafdac", order: 7 },
    { key: "logistics", text: "How do you currently handle delivery/logistics?", category: "logistics", order: 8 },
    { key: "branding", text: "How would you rate your current branding?", category: "branding", order: 9 },
    { key: "website", text: "Do you have a website or online store?", category: "website", order: 10 },
    { key: "salesChannels", text: "Which channels drive most of your sales today?", category: "salesChannels", order: 11 },
    { key: "goals", text: "What are your main goals for the next 3 months?", category: "goals", order: 12 },
    { key: "painPoints", text: "What is your biggest pain point right now?", category: "painPoints", order: 13 },
  ];
  for (const q of questions) {
    await prisma.qualificationQuestion.upsert({
      where: { organizationId_key: { organizationId, key: q.key } },
      update: q,
      create: { ...q, organizationId },
    });
  }

  // --- Follow-up cadence (Blueprint §12) ---
  const cadences = [
    { outcome: "QUALIFIED" as const, offsetDays: 1 },
    { outcome: "QUALIFIED_WITH_CONDITIONS" as const, offsetDays: 2 },
    { outcome: "NEEDS_NURTURING" as const, offsetDays: 7 },
    { outcome: "PARTNER_REFERRAL" as const, offsetDays: 3 },
    { outcome: "DISQUALIFIED_WITH_ROADMAP" as const, offsetDays: 30 },
  ];
  for (const c of cadences) {
    await prisma.followUpCadence.upsert({
      where: { organizationId_outcome: { organizationId, outcome: c.outcome } },
      update: c,
      create: { ...c, organizationId },
    });
  }

  // --- Starter prompt template (Blueprint §16) ---
  await prisma.promptTemplate.upsert({
    where: { organizationId_name_version: { organizationId, name: "qualification", version: 1 } },
    update: {},
    create: {
      organizationId,
      name: "qualification",
      version: 1,
      body: [
        "You are a sales qualification analyst for a Nigerian Meta Ads agency serving supplement and herbal brands.",
        "Given the lead profile and interview responses, return a structured qualification.",
        "Never output a bare 'Not Qualified' — always map to one of the five outcomes and include a roadmap.",
        "Explain every decision: signals used, positive factors, negative factors, and business-rule references.",
        "Recommend partners for gaps: missing NAFDAC, weak logistics, weak branding, weak website, poor creatives.",
      ].join("\n"),
    },
  });

  // --- Demo company + lead assigned to the CSR (only if none exist yet) ---
  const existingLead = await prisma.lead.findFirst({ where: { organizationId } });
  if (!existingLead) {
    const company = await prisma.company.create({
      data: {
        organizationId,
        name: "GreenHerb Naturals",
        industry: "Herbal supplements",
        products: "Immune booster, detox tea",
        nafdacStatus: "PENDING",
        monthlyRevenue: 2500000,
        marketingBudget: 400000,
        salesChannels: "Instagram, WhatsApp",
        website: "",
      },
    });
    await prisma.lead.create({
      data: {
        organizationId,
        status: "ASSIGNED",
        source: "Instagram DM",
        contactName: "Ada Obi",
        contactPhone: "+2348000000000",
        isDecisionMaker: true,
        companyId: company.id,
        assignedToId: csr.id,
      },
    });
  }

  console.log(`Seeded org ${org.slug}; users: ${[admin.email, manager.email, csr.email].join(", ")}`);
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
