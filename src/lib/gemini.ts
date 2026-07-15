import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

export const MODEL_NAME = "gemini-3.5-flash";

/** Tried in order; a 404/429 skips to the next, a 503 retries once before moving on. */
export const MODEL_CANDIDATES = [
  "gemini-3.5-flash",
  "gemini-flash-latest",
  "gemini-2.0-flash",
  "gemini-2.0-flash-001",
];

/** The five allowed outcomes (Blueprint §6) — there is no bare "Not Qualified". */
export const OUTCOMES = [
  "QUALIFIED",
  "QUALIFIED_WITH_CONDITIONS",
  "NEEDS_NURTURING",
  "PARTNER_REFERRAL",
  "DISQUALIFIED_WITH_ROADMAP",
] as const;

export const PARTNER_TYPES = ["NAFDAC", "LOGISTICS", "BRANDING", "WEBSITE", "CREATIVE"] as const;

/** Structured AI output (Blueprint §8, §10). Validated before anything is stored. */
export const qualificationResultSchema = z.object({
  leadScore: z.number().int().min(0).max(100),
  confidenceScore: z.number().int().min(0).max(100),
  outcome: z.enum(OUTCOMES),
  reasoning: z.string().min(1),
  positiveFactors: z.array(z.string()).default([]),
  negativeFactors: z.array(z.string()).default([]),
  signals: z.array(z.string()).default([]),
  ruleReferences: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  objections: z.array(z.string()).default([]),
  buyingSignals: z.array(z.string()).default([]),
  followUpPlan: z
    .array(z.object({ step: z.string(), timing: z.string() }))
    .default([]),
  recommendedPackageName: z.string().nullable().default(null),
  estimatedValue: z.number().int().nonnegative().nullable().default(null),
  partnerRecommendations: z.array(z.enum(PARTNER_TYPES)).default([]),
});

export type QualificationResult = z.infer<typeof qualificationResultSchema>;

const SCHEMA_SPEC = `Return ONLY a JSON object with exactly these keys:
{
  "leadScore": integer 0-100,
  "confidenceScore": integer 0-100,
  "outcome": one of ["QUALIFIED","QUALIFIED_WITH_CONDITIONS","NEEDS_NURTURING","PARTNER_REFERRAL","DISQUALIFIED_WITH_ROADMAP"],
  "reasoning": string (2-4 sentences explaining the decision),
  "positiveFactors": string[],
  "negativeFactors": string[],
  "signals": string[] (the specific data points you used),
  "ruleReferences": string[] (agency rules applied, e.g. "Missing NAFDAC -> partner referral"),
  "risks": string[],
  "opportunities": string[] (upsells: NAFDAC, logistics, branding, website, creatives),
  "objections": string[],
  "buyingSignals": string[],
  "followUpPlan": [{ "step": string, "timing": string }],
  "recommendedPackageName": string or null (must be one of the provided package names),
  "estimatedValue": integer (naira) or null,
  "partnerRecommendations": string[] subset of ["NAFDAC","LOGISTICS","BRANDING","WEBSITE","CREATIVE"]
}`;

const OUTCOME_RULE = `CRITICAL: Never return a bare rejection. Every lead gets one of the five outcomes with a constructive roadmap. Use DISQUALIFIED_WITH_ROADMAP (not a dead end) only when there is no near-term fit, and still populate followUpPlan and opportunities.`;

export function buildQualificationPrompt(input: {
  templateBody: string;
  lead: Record<string, unknown>;
  company: Record<string, unknown>;
  responses: { question: string; answer: string }[];
  packages: { name: string; priceMin: number | null; priceMax: number | null; minBudget: number | null; features: unknown }[];
}): string {
  const qa = input.responses.length
    ? input.responses.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n")
    : "(no interview answers captured)";

  return [
    input.templateBody.trim(),
    "",
    "## Lead",
    JSON.stringify(input.lead, null, 2),
    "## Company",
    JSON.stringify(input.company, null, 2),
    "## Interview responses",
    qa,
    "## Available packages",
    JSON.stringify(input.packages, null, 2),
    "",
    OUTCOME_RULE,
    "",
    SCHEMA_SPEC,
  ].join("\n");
}

function extractJson(text: string): unknown {
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isOverloaded(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /50\d|unavailable|overloaded|high demand/i.test(msg);
}

/** If the error is a 429 with a short "retry in Ns" hint, return the wait in ms (capped). */
function retryAfterMs(e: unknown): number | null {
  const msg = e instanceof Error ? e.message : String(e);
  if (!/429|RESOURCE_EXHAUSTED|quota/i.test(msg)) return null;
  const m = msg.match(/retry in ([\d.]+)s/i);
  const secs = m ? parseFloat(m[1]) : 0;
  return secs > 0 && secs <= 15 ? Math.ceil(secs * 1000) + 500 : null;
}

/**
 * Call Gemini and return a schema-validated result. Walks a fallback chain of
 * models (skipping 404/429), retries a transient 503 once per model, and retries
 * once on malformed JSON. Throws only if every candidate fails — caller surfaces it.
 */
export async function generateStructured<T>(
  prompt: string,
  schema: z.ZodType<T>,
): Promise<{ result: T; rawText: string; modelUsed: string }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");

  const ai = new GoogleGenAI({ apiKey });
  const call = (model: string, extra = "") =>
    ai.models
      .generateContent({
        model,
        contents: prompt + extra,
        config: { responseMimeType: "application/json", temperature: 0.2 },
      })
      .then((res) => res.text ?? "");

  let lastErr: unknown;
  for (const model of MODEL_CANDIDATES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        let rawText = await call(model);
        try {
          return { result: schema.parse(extractJson(rawText)), rawText, modelUsed: model };
        } catch {
          rawText = await call(model, "\n\nYour previous output was invalid. Return ONLY the JSON object.");
          return { result: schema.parse(extractJson(rawText)), rawText, modelUsed: model };
        }
      } catch (e) {
        lastErr = e;
        if (attempt === 0) {
          if (isOverloaded(e)) {
            await sleep(2500); // transient 503 — retry same model once
            continue;
          }
          const wait = retryAfterMs(e);
          if (wait != null) {
            await sleep(wait); // per-minute 429 — honor the API's retry-after once
            continue;
          }
        }
        break; // hard 404 / exhausted quota / parse failure — move to the next model
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("All Gemini models failed.");
}

/** Full lead qualification (§8). */
export function runQualificationAI(prompt: string) {
  return generateStructured(prompt, qualificationResultSchema);
}

// ---- Live Call Assistant (§4) --------------------------------------------

export const callAssistSchema = z.object({
  sentiment: z.enum(["POSITIVE", "NEUTRAL", "NEGATIVE", "MIXED"]),
  summary: z.string().min(1),
  objections: z.array(z.string()).default([]),
  buyingSignals: z.array(z.string()).default([]),
  suggestedQuestions: z.array(z.string()).default([]),
  talkingPoints: z.array(z.string()).default([]),
});

export type CallAssist = z.infer<typeof callAssistSchema>;

export function buildCallAssistPrompt(input: {
  lead: Record<string, unknown>;
  company: Record<string, unknown>;
  responses: { question: string; answer: string }[];
}): string {
  const qa = input.responses.length
    ? input.responses.map((r) => `Q: ${r.question}\nA: ${r.answer}`).join("\n\n")
    : "(no answers captured yet)";
  return [
    "You are a live call assistant helping a CSR at a Nigerian Meta Ads agency (supplement/herbal brands) during a qualification call. Based on the conversation so far, give real-time guidance: read the prospect's sentiment, surface objections and buying signals, and suggest the next best questions and talking points to move the deal forward.",
    "",
    "## Lead",
    JSON.stringify(input.lead, null, 2),
    "## Company",
    JSON.stringify(input.company, null, 2),
    "## Conversation so far",
    qa,
    "",
    `Return ONLY JSON: {
  "sentiment": one of ["POSITIVE","NEUTRAL","NEGATIVE","MIXED"],
  "summary": string (1-2 sentences on where the call stands),
  "objections": string[] (concerns to address now),
  "buyingSignals": string[],
  "suggestedQuestions": string[] (next best questions to ask),
  "talkingPoints": string[] (points to emphasize)
}`,
  ].join("\n");
}

/** Live in-call guidance (§4). */
export function runCallAssist(prompt: string) {
  return generateStructured(prompt, callAssistSchema);
}
