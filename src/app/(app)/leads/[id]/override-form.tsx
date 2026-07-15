"use client";

import { useActionState, useState } from "react";
import { overrideRecommendation, type ActionState } from "./manage-actions";
import { LEAD_STATUS_META } from "@/lib/lead-status";
import { OUTCOMES } from "@/lib/gemini";
import type { LeadStatus } from "@/generated/prisma/enums";

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

export function OverrideForm({
  leadId,
  currentOutcome,
  packages,
}: {
  leadId: string;
  currentOutcome: string;
  packages: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    overrideRecommendation,
    undefined,
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Override…
      </button>
    );
  }

  return (
    <form action={action} className="w-full space-y-3 rounded-xl border border-amber-300 bg-amber-50/40 p-4 dark:border-amber-800 dark:bg-amber-950/20">
      <p className="text-sm font-medium">Manager override (§14)</p>
      <input type="hidden" name="leadId" value={leadId} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="font-medium">Outcome</span>
          <select name="outcome" defaultValue={currentOutcome} className={inputCls}>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {LEAD_STATUS_META[o as LeadStatus].label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="font-medium">Package (optional)</span>
          <select name="packageId" defaultValue="" className={inputCls}>
            <option value="">— Keep / none —</option>
            {packages.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Adjust lead score (optional, 0–100)</span>
        <input name="leadScore" type="number" min={0} max={100} className={inputCls} />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="font-medium">Reason (required)</span>
        <textarea name="reason" rows={2} required className={inputCls} placeholder="Why are you overriding the AI?" />
      </label>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Apply override"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
