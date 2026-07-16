import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { LEAD_STATUS_META } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";
import { computeLearningAggregate, type Suggestion } from "@/lib/learning";
import { approveLearningEvent, rejectLearningEvent, applyAggregateRecalibration } from "./actions";

const STATUS_STYLE: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

function outcomeLabel(o: string | null): string {
  if (!o) return "—";
  return LEAD_STATUS_META[o as LeadStatus]?.label ?? o;
}

export default async function LearningPage() {
  await requireRole("MANAGER", "ADMIN");

  const [events, agg] = await Promise.all([
    prisma.learningEvent.findMany({
      include: { lead: { include: { company: true } }, reviewer: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    computeLearningAggregate(),
  ]);

  const pending = events.filter((e) => e.status === "PENDING_REVIEW");
  const reviewed = events.filter((e) => e.status !== "PENDING_REVIEW");

  const dirs: { key: keyof typeof agg.byDirection; label: string }[] = [
    { key: "aligned", label: "Correct" },
    { key: "over_optimistic", label: "Over-optimistic" },
    { key: "under_estimated", label: "Under-estimated" },
    { key: "unknown", label: "No prediction" },
  ];
  const dirMax = Math.max(1, ...dirs.map((d) => agg.byDirection[d.key]));

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight">Learning engine (§11)</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Each resolved deal compares the AI&apos;s prediction to reality. Approving a proposal
        applies the recalibration to the live config — nothing changes without your sign-off.
      </p>

      {/* Aggregate (3.3) */}
      <section className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Aggregate accuracy
          </h2>
          <span className="text-2xl font-semibold tabular-nums">
            {agg.accuracyPct != null ? `${agg.accuracyPct}%` : "—"}
            <span className="ml-1 text-xs font-normal text-zinc-500">
              ({agg.correct}/{agg.decided} predictions)
            </span>
          </span>
        </div>

        <div className="mt-4 space-y-2">
          {dirs.map((d) => (
            <div key={d.key} className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm">{d.label}</span>
              <div className="h-2.5 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200"
                  style={{ width: `${agg.byDirection[d.key] > 0 ? Math.max(4, (agg.byDirection[d.key] / dirMax) * 100) : 0}%` }}
                />
              </div>
              <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                {agg.byDirection[d.key]}
              </span>
            </div>
          ))}
        </div>

        {agg.netProposal ? (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-300 bg-amber-50/40 p-3 dark:border-amber-800 dark:bg-amber-950/20">
            <span className="text-sm">
              Net recalibration:{" "}
              <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                {agg.netProposal.key}: {agg.netProposal.from} → {agg.netProposal.to}
              </code>{" "}
              <span className="text-zinc-500">{agg.netProposal.rationale}</span>
            </span>
            <form action={applyAggregateRecalibration} className="ml-auto">
              <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                Apply aggregate
              </button>
            </form>
          </div>
        ) : (
          <p className="mt-4 text-xs text-zinc-400">
            No systematic bias yet — need a clearer trend before proposing an aggregate change.
          </p>
        )}
      </section>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Pending review ({pending.length})
      </h2>
      <div className="mt-3 space-y-3">
        {pending.length === 0 ? (
          <p className="text-sm text-zinc-500">Nothing to review.</p>
        ) : (
          pending.map((e) => {
            const proposed = e.proposedChanges as { direction?: string; suggestions?: Suggestion[] } | null;
            const suggestions = proposed?.suggestions ?? [];
            return (
              <div key={e.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-medium">{e.lead?.company?.name ?? e.lead?.contactName ?? "Lead"}</span>
                  <span className="text-zinc-500">
                    predicted <b>{outcomeLabel(e.predictedOutcome)}</b>
                    {e.predictedScore != null ? ` (score ${e.predictedScore})` : ""} · actual{" "}
                    <b>{outcomeLabel(e.actualOutcome)}</b>
                  </span>
                  {proposed?.direction && proposed.direction !== "aligned" && (
                    <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                      {proposed.direction.replace("_", " ")}
                    </span>
                  )}
                </div>

                {suggestions.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-sm">
                    {suggestions.map((s, i) => (
                      <li key={i}>
                        <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
                          {s.key}: {s.from} → {s.to}
                        </code>{" "}
                        <span className="text-zinc-500">{s.rationale}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-zinc-500">Prediction was correct — no change proposed.</p>
                )}

                <div className="mt-3 flex gap-2">
                  <form action={approveLearningEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200">
                      {suggestions.length > 0 ? "Approve & apply" : "Acknowledge"}
                    </button>
                  </form>
                  <form action={rejectLearningEvent}>
                    <input type="hidden" name="id" value={e.id} />
                    <button className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            );
          })
        )}
      </div>

      {reviewed.length > 0 && (
        <>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">History</h2>
          <div className="mt-3 space-y-2">
            {reviewed.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                <span>
                  {e.lead?.company?.name ?? e.lead?.contactName ?? "Lead"} — predicted{" "}
                  {outcomeLabel(e.predictedOutcome)} / actual {outcomeLabel(e.actualOutcome)}
                </span>
                <span className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-500">{e.reviewer?.name ?? e.reviewer?.email}</span>
                  <span className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLE[e.status]}`}>{e.status}</span>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
