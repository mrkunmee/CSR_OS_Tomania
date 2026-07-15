import type { ConfidenceResult } from "@/lib/confidence";

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-600";
  if (score >= 50) return "text-amber-600";
  return "text-rose-600";
}

export function ConfidenceCard({
  confidence,
  aiConfidence,
}: {
  confidence: ConfidenceResult;
  aiConfidence: number | null;
}) {
  const divergence =
    aiConfidence != null ? Math.abs(aiConfidence - confidence.score) : null;

  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Data confidence (computed)
        </h3>
        <div className="flex items-baseline gap-4">
          <span className={`text-2xl font-semibold tabular-nums ${scoreColor(confidence.score)}`}>
            {confidence.score}
          </span>
          {aiConfidence != null && (
            <span className="text-xs text-zinc-500">
              AI self-reported: <span className="font-medium">{aiConfidence}</span>
            </span>
          )}
        </div>
      </div>

      {divergence != null && divergence >= 25 && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
          ⚠ The AI&apos;s confidence differs from the data-quality score by {divergence} points — review before acting.
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {confidence.factors.map((f) => (
          <li key={f.label} className="flex items-start gap-2 text-sm">
            <span className={f.ok ? "text-emerald-500" : "text-amber-500"}>{f.ok ? "✓" : "!"}</span>
            <span className="flex-1">
              <span className="font-medium">{f.label}</span>
              <span className="text-zinc-500"> — {f.detail}</span>
            </span>
            {f.deduction > 0 && <span className="text-xs text-rose-500">−{f.deduction}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
