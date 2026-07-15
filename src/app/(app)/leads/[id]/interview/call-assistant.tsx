"use client";

import { useActionState } from "react";
import { getCallAssist, type AssistState } from "./actions";

const SENTIMENT_STYLE: Record<string, string> = {
  POSITIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  NEUTRAL: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  NEGATIVE: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  MIXED: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
};

function List({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm">
        {items.map((t, i) => <li key={i}>{t}</li>)}
      </ul>
    </div>
  );
}

export function CallAssistant({ leadId }: { leadId: string }) {
  const [state, action, pending] = useActionState<AssistState, FormData>(getCallAssist, undefined);
  const a = state?.assist;

  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Call assistant</h2>
          <p className="text-xs text-zinc-500">Live AI guidance from the answers captured so far (§4).</p>
        </div>
        <form action={action}>
          <input type="hidden" name="leadId" value={leadId} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {pending ? "Analyzing…" : a ? "Refresh assist" : "Get AI assist"}
          </button>
        </form>
      </div>

      {state?.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}

      {a && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${SENTIMENT_STYLE[a.sentiment] ?? ""}`}>
              {a.sentiment}
            </span>
            <p className="text-sm">{a.summary}</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <List title="Suggested next questions" items={a.suggestedQuestions} />
            <List title="Talking points" items={a.talkingPoints} />
            <List title="Objections to address" items={a.objections} />
            <List title="Buying signals" items={a.buyingSignals} />
          </div>
        </div>
      )}
    </section>
  );
}
