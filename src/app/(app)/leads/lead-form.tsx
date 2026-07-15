"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { FormState } from "./actions";

type LeadWithCompany = {
  id: string;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  source: string | null;
  isDecisionMaker: boolean;
  assignedToId: string | null;
  company: {
    name: string;
    industry: string | null;
    products: string | null;
    nafdacStatus: string | null;
    monthlyRevenue: number | null;
    marketingBudget: number | null;
    salesChannels: string | null;
    website: string | null;
  } | null;
};

type Csr = { id: string; name: string | null; email: string };

const inputCls =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

function Field({
  label,
  name,
  defaultValue,
  error,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  error?: string;
  type?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue ?? undefined}
        className={inputCls}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function LeadForm({
  action,
  lead,
  csrs,
  canAssign,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  lead?: LeadWithCompany;
  csrs?: Csr[];
  canAssign?: boolean;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    undefined,
  );
  const fe = state?.fieldErrors ?? {};
  const c = lead?.company;

  return (
    <form action={formAction} className="max-w-2xl space-y-8">
      {lead && <input type="hidden" name="leadId" value={lead.id} />}

      {state?.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {state.error}
        </p>
      )}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Contact
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Contact name *" name="contactName" defaultValue={lead?.contactName} error={fe.contactName} />
          <Field label="Phone" name="contactPhone" defaultValue={lead?.contactPhone} />
          <Field label="Email" name="contactEmail" type="email" defaultValue={lead?.contactEmail} error={fe.contactEmail} />
          <Field label="Source" name="source" placeholder="Instagram DM, referral…" defaultValue={lead?.source} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isDecisionMaker" defaultChecked={lead?.isDecisionMaker} />
          Contact is the decision maker
        </label>
        {canAssign && csrs && (
          <div className="space-y-1">
            <label htmlFor="assignedToId" className="text-sm font-medium">
              Assign to
            </label>
            <select
              id="assignedToId"
              name="assignedToId"
              defaultValue={lead?.assignedToId ?? ""}
              className={inputCls}
            >
              <option value="">— Unassigned —</option>
              {csrs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email}
                </option>
              ))}
            </select>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Company
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Company name *" name="companyName" defaultValue={c?.name} error={fe.name} />
          <Field label="Industry" name="industry" defaultValue={c?.industry} />
          <Field label="Products" name="products" defaultValue={c?.products} />
          <div className="space-y-1">
            <label htmlFor="nafdacStatus" className="text-sm font-medium">
              NAFDAC status
            </label>
            <select
              id="nafdacStatus"
              name="nafdacStatus"
              defaultValue={c?.nafdacStatus ?? ""}
              className={inputCls}
            >
              <option value="">— Unknown —</option>
              <option value="NONE">Not registered</option>
              <option value="PENDING">Pending</option>
              <option value="REGISTERED">Registered</option>
            </select>
          </div>
          <Field label="Monthly revenue (₦)" name="monthlyRevenue" type="number" defaultValue={c?.monthlyRevenue} error={fe.monthlyRevenue} />
          <Field label="Marketing budget (₦)" name="marketingBudget" type="number" defaultValue={c?.marketingBudget} error={fe.marketingBudget} />
          <Field label="Sales channels" name="salesChannels" defaultValue={c?.salesChannels} />
          <Field label="Website" name="website" defaultValue={c?.website} />
        </div>
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        <Link
          href={lead ? `/leads/${lead.id}` : "/leads"}
          className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
