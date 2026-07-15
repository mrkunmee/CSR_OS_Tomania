import { LEAD_STATUS_META } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";

function asStrings(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}
function asPlan(v: unknown): { step: string; timing: string }[] {
  return Array.isArray(v)
    ? v.filter((x) => x && typeof x === "object" && "step" in x).map((x) => x as { step: string; timing: string })
    : [];
}

function Chips({ items, tone }: { items: string[]; tone: "pos" | "neg" | "neutral" }) {
  if (!items.length) return <p className="text-xs text-zinc-400">—</p>;
  const cls =
    tone === "pos"
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
      : tone === "neg"
        ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <li key={i} className={`rounded-md px-2 py-1 text-xs ${cls}`}>{t}</li>
      ))}
    </ul>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </div>
  );
}

type Rec = {
  outcome: string;
  estimatedValue: number | null;
  reasoning: string;
  signals: unknown;
  positiveFactors: unknown;
  negativeFactors: unknown;
  ruleReferences: unknown;
  risks: unknown;
  opportunities: unknown;
  objections: unknown;
  buyingSignals: unknown;
  followUpPlan: unknown;
  confidenceLevel: number;
  modelName: string | null;
  promptTemplateVersion: number | null;
  createdAt: Date;
  recommendedPackage: { name: string } | null;
  overrideReason: string | null;
  overriddenAt: Date | null;
  overriddenBy: { name: string | null; email: string } | null;
};

export function RecommendationPanel({
  rec,
  leadScore,
  rulesPackageName,
}: {
  rec: Rec;
  leadScore: number | null;
  rulesPackageName?: string | null;
}) {
  const meta = LEAD_STATUS_META[rec.outcome as LeadStatus];
  const followUp = asPlan(rec.followUpPlan);
  const aiPackage = rec.recommendedPackage?.name ?? null;
  const packagesAgree =
    rulesPackageName != null && aiPackage != null &&
    rulesPackageName.toLowerCase() === aiPackage.toLowerCase();

  return (
    <div className="space-y-5 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      {rec.overriddenAt && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <span className="font-semibold">Manager override</span> by{" "}
          {rec.overriddenBy?.name ?? rec.overriddenBy?.email ?? "manager"} ·{" "}
          {rec.overriddenAt.toLocaleString("en-NG")} — “{rec.overrideReason}”
        </div>
      )}
      {/* Headline */}
      <div className="flex flex-wrap items-center gap-4">
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${meta?.color ?? ""}`}>
          {meta?.label ?? rec.outcome}
        </span>
        <div className="flex gap-6">
          <div>
            <p className="text-2xl font-semibold tabular-nums">{leadScore ?? "—"}</p>
            <p className="text-xs text-zinc-500">Lead score</p>
          </div>
          <div>
            <p className="text-2xl font-semibold tabular-nums">{rec.confidenceLevel}</p>
            <p className="text-xs text-zinc-500">Confidence</p>
          </div>
          <div>
            <p className="text-2xl font-semibold">
              {rec.recommendedPackage?.name ?? <span className="text-zinc-400">—</span>}
            </p>
            <p className="text-xs text-zinc-500">
              Package{rec.estimatedValue != null ? ` · ₦${rec.estimatedValue.toLocaleString("en-NG")}` : ""}
            </p>
            {rulesPackageName != null && (
              <p className={`mt-0.5 text-xs ${packagesAgree ? "text-emerald-600" : "text-amber-600"}`}>
                {packagesAgree ? "✓ matches" : `rules pick: ${rulesPackageName}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm leading-relaxed">{rec.reasoning}</p>

      {/* Explainability §10 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Group title="Positive factors"><Chips items={asStrings(rec.positiveFactors)} tone="pos" /></Group>
        <Group title="Negative factors"><Chips items={asStrings(rec.negativeFactors)} tone="neg" /></Group>
        <Group title="Signals used"><Chips items={asStrings(rec.signals)} tone="neutral" /></Group>
        <Group title="Business rules applied"><Chips items={asStrings(rec.ruleReferences)} tone="neutral" /></Group>
        <Group title="Risks"><Chips items={asStrings(rec.risks)} tone="neg" /></Group>
        <Group title="Opportunities"><Chips items={asStrings(rec.opportunities)} tone="pos" /></Group>
        <Group title="Objections"><Chips items={asStrings(rec.objections)} tone="neutral" /></Group>
        <Group title="Buying signals"><Chips items={asStrings(rec.buyingSignals)} tone="pos" /></Group>
      </div>

      {/* Follow-up plan */}
      {followUp.length > 0 && (
        <Group title="Follow-up plan">
          <ol className="space-y-1 text-sm">
            {followUp.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-400">{i + 1}.</span>
                <span>{f.step}</span>
                <span className="text-xs text-zinc-500">· {f.timing}</span>
              </li>
            ))}
          </ol>
        </Group>
      )}

      <p className="border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-900">
        {rec.modelName ?? "AI"}
        {rec.promptTemplateVersion != null ? ` · prompt v${rec.promptTemplateVersion}` : ""} ·{" "}
        {rec.createdAt.toLocaleString("en-NG")}
      </p>
    </div>
  );
}
