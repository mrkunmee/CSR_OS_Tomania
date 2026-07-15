/**
 * Human-friendly text form for a QualificationQuestion's branchRules (§5).
 *
 * JSON  { "no": ["nafdacTimeline"], "pending": ["nafdacTimeline"] }
 * Text  no -> nafdacTimeline
 *       pending -> nafdacTimeline
 *
 * Admins edit the text form; we parse it back to JSON. Keeps the branching
 * configurable without exposing raw JSON braces.
 */
export function branchRulesToText(rules: unknown): string {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) return "";
  return Object.entries(rules as Record<string, unknown>)
    .filter(([, v]) => Array.isArray(v))
    .map(([k, v]) => `${k} -> ${(v as string[]).join(", ")}`)
    .join("\n");
}

export function parseBranchRulesText(text: string): {
  rules: Record<string, string[]>;
  targets: string[];
} {
  const rules: Record<string, string[]> = {};
  const targets: string[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const idx = t.indexOf("->");
    if (idx === -1) continue;
    const match = t.slice(0, idx).trim();
    const keys = t
      .slice(idx + 2)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!match || keys.length === 0) continue;
    rules[match] = keys;
    targets.push(...keys);
  }
  return { rules, targets };
}
