"use client";

import { useActionState } from "react";
import { assignLead, changeLeadStatus, type FormState } from "../actions";
import { LEAD_STATUS_META } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";

const selectCls =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const btnCls =
  "rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";

export function StatusChanger({
  leadId,
  current,
  nextOptions,
}: {
  leadId: string;
  current: LeadStatus;
  nextOptions: LeadStatus[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    changeLeadStatus,
    undefined,
  );

  if (nextOptions.length === 0) {
    return <p className="text-xs text-zinc-500">No further transitions from {LEAD_STATUS_META[current].label}.</p>;
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex gap-2">
        <select name="status" className={selectCls} defaultValue={nextOptions[0]}>
          {nextOptions.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_META[s].label}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "…" : "Update"}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

export function AssignControl({
  leadId,
  currentAssigneeId,
  csrs,
}: {
  leadId: string;
  currentAssigneeId: string | null;
  csrs: { id: string; name: string | null; email: string }[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    assignLead,
    undefined,
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex gap-2">
        <select name="assignedToId" defaultValue={currentAssigneeId ?? ""} className={selectCls}>
          <option value="">— Unassigned —</option>
          {csrs.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name ?? u.email}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={btnCls}>
          {pending ? "…" : "Assign"}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  );
}
