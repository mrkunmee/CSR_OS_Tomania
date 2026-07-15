import { z } from "zod";

const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

const optionalStr = z.preprocess(emptyToUndefined, z.string().optional());
const optionalInt = z.preprocess(
  emptyToUndefined,
  z.coerce.number().int().nonnegative().optional(),
);
const optionalEmail = z.preprocess(
  emptyToUndefined,
  z.string().email("Enter a valid email").optional(),
);

export const companySchema = z.object({
  name: z.string().trim().min(1, "Company name is required"),
  industry: optionalStr,
  products: optionalStr,
  nafdacStatus: z
    .preprocess(emptyToUndefined, z.enum(["NONE", "PENDING", "REGISTERED"]).optional()),
  monthlyRevenue: optionalInt,
  marketingBudget: optionalInt,
  salesChannels: optionalStr,
  website: optionalStr,
});

export const leadSchema = z.object({
  contactName: z.string().trim().min(1, "Contact name is required"),
  contactPhone: optionalStr,
  contactEmail: optionalEmail,
  source: optionalStr,
  isDecisionMaker: z.boolean().optional(),
  assignedToId: optionalStr,
});

export type CompanyInput = z.infer<typeof companySchema>;
export type LeadInput = z.infer<typeof leadSchema>;
