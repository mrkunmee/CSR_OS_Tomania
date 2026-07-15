"use client";

import { useActionState } from "react";
import { saveResponses, type SaveState } from "./actions";
import type { ActiveQuestion } from "@/lib/interview";

const CATEGORY_LABEL: Record<string, string> = {
  businessProfile: "Business profile",
  revenue: "Revenue",
  budget: "Marketing budget",
  decisionMaker: "Decision maker",
  products: "Products",
  nafdac: "NAFDAC",
  logistics: "Logistics",
  branding: "Branding",
  website: "Website",
  salesChannels: "Sales channels",
  goals: "Goals",
  painPoints: "Pain points",
};

export function InterviewForm({
  leadId,
  callId,
  questions,
  notes,
}: {
  leadId: string;
  callId: string;
  questions: ActiveQuestion[];
  notes: string;
}) {
  const [state, action, pending] = useActionState<SaveState, FormData>(
    saveResponses,
    undefined,
  );

  const answered = questions.filter((q) => q.answer.trim()).length;
  const pct = questions.length ? Math.round((answered / questions.length) * 100) : 0;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="leadId" value={leadId} />
      <input type="hidden" name="callId" value={callId} />

      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs text-zinc-500">
          <span>{answered} of {questions.length} answered</span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full rounded-full bg-zinc-900 transition-all dark:bg-zinc-100" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="space-y-4">
        {questions.map((q) => (
          <div
            key={q.key}
            className={`rounded-xl border p-4 ${
              q.triggered
                ? "border-amber-300 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20"
                : "border-zinc-200 dark:border-zinc-800"
            }`}
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                {CATEGORY_LABEL[q.category] ?? q.category}
              </span>
              {q.triggered && (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                  Follow-up
                </span>
              )}
            </div>
            <label htmlFor={`answer__${q.key}`} className="block text-sm font-medium">
              {q.text}
            </label>
            <textarea
              id={`answer__${q.key}`}
              name={`answer__${q.key}`}
              defaultValue={q.answer}
              rows={2}
              className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </div>
        ))}
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          CSR notes
        </label>
        <textarea
          id="notes"
          name="notes"
          defaultValue={notes}
          rows={3}
          placeholder="Anything else worth capturing from the call…"
          className="mt-2 w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save progress"}
        </button>
        {state?.saved && !pending && (
          <span className="text-sm text-emerald-600">Saved — answers may reveal follow-up questions.</span>
        )}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}
