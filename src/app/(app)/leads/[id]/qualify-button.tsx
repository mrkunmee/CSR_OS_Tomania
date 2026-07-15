"use client";

import { useActionState } from "react";
import { generateRecommendation, type QualifyState } from "./qualify-actions";

export function QualifyButton({
  leadId,
  hasRecommendation,
}: {
  leadId: string;
  hasRecommendation: boolean;
}) {
  const [state, action, pending] = useActionState<QualifyState, FormData>(
    generateRecommendation,
    undefined,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending
          ? "Analyzing…"
          : hasRecommendation
            ? "Re-run AI qualification"
            : "Generate AI recommendation"}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
