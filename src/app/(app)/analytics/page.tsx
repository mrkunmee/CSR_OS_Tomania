import { requireRole } from "@/lib/auth-helpers";
import { computeAnalytics } from "@/lib/analytics";
import { LEAD_STATUS_META } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400">{sub}</p>}
    </div>
  );
}

/** Single-hue magnitude bar; identity comes from the text label, not the color. */
function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const pct = max > 0 ? Math.max(count > 0 ? 4 : 0, (count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-52 shrink-0 text-sm">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div className="h-full rounded-full bg-zinc-800 dark:bg-zinc-200" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 shrink-0 text-right text-sm tabular-nums text-zinc-600 dark:text-zinc-400">{count}</span>
    </div>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-base font-semibold">{title}</h2>
      {hint && <p className="mb-4 text-xs text-zinc-500">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
    </section>
  );
}

export default async function AnalyticsPage() {
  await requireRole("MANAGER", "ADMIN");
  const a = await computeAnalytics();

  const funnelMax = Math.max(1, ...a.funnel.map((f) => f.count));
  const pkgMax = Math.max(1, ...a.packageMix.map((p) => p.count));
  const partnerMax = Math.max(1, ...a.partnerMix.map((p) => p.count));

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
      <p className="mt-1 text-sm text-zinc-500">Agency-wide pipeline and AI performance (§4).</p>

      {/* Headline tiles */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total leads" value={String(a.total)} />
        <StatTile label="Won" value={String(a.won)} sub={`${a.lost} lost`} />
        <StatTile label="Win rate" value={a.winRate != null ? `${a.winRate}%` : "—"} sub="of resolved deals" />
        <StatTile
          label="AI accuracy"
          value={a.accuracy.accuracyPct != null ? `${a.accuracy.accuracyPct}%` : "—"}
          sub={`${a.accuracy.correct}/${a.accuracy.resolvedWithRec} predictions`}
        />
      </div>

      <div className="mt-6 space-y-6">
        {/* Funnel */}
        <Section title="Pipeline" hint="Leads by status (§3 lifecycle).">
          <div className="space-y-2">
            {a.funnel.map((f) => (
              <Bar
                key={f.status}
                label={LEAD_STATUS_META[f.status as LeadStatus].label}
                count={f.count}
                max={funnelMax}
              />
            ))}
          </div>
        </Section>

        {/* Score vs outcome */}
        <Section title="Score vs. outcome" hint="Predicted outcome vs. actual won/lost — feeds the Phase 3 learning engine.">
          {a.accuracy.resolvedWithRec === 0 ? (
            <p className="text-sm text-zinc-500">No resolved deals with a recommendation yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <StatTile label="Correct predictions" value={`${a.accuracy.correct}/${a.accuracy.resolvedWithRec}`} />
              <StatTile label="Avg score — won" value={a.accuracy.avgScoreWon != null ? String(a.accuracy.avgScoreWon) : "—"} />
              <StatTile label="Avg score — lost" value={a.accuracy.avgScoreLost != null ? String(a.accuracy.avgScoreLost) : "—"} />
            </div>
          )}
        </Section>

        {/* CSR performance */}
        <Section title="CSR performance">
          {a.csrRows.length === 0 ? (
            <p className="text-sm text-zinc-500">No assigned leads yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-2 font-medium">CSR</th>
                  <th className="py-2 text-right font-medium">Assigned</th>
                  <th className="py-2 text-right font-medium">Qualified</th>
                  <th className="py-2 text-right font-medium">Won</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                {a.csrRows.map((r) => (
                  <tr key={r.name}>
                    <td className="py-2">{r.name}</td>
                    <td className="py-2 text-right tabular-nums">{r.assigned}</td>
                    <td className="py-2 text-right tabular-nums">{r.qualified}</td>
                    <td className="py-2 text-right tabular-nums">{r.won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Mix */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Package mix">
            {a.packageMix.length === 0 ? (
              <p className="text-sm text-zinc-500">No recommendations yet.</p>
            ) : (
              <div className="space-y-2">
                {a.packageMix.map((p) => (
                  <Bar key={p.name} label={p.name} count={p.count} max={pkgMax} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Partner referrals">
            {a.partnerMix.length === 0 ? (
              <p className="text-sm text-zinc-500">No referrals yet.</p>
            ) : (
              <div className="space-y-2">
                {a.partnerMix.map((p) => (
                  <Bar key={p.type} label={p.type} count={p.count} max={partnerMax} />
                ))}
              </div>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}
