import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { ALL_LEAD_STATUSES, LEAD_STATUS_META } from "@/lib/lead-status";
import type { LeadStatus, Prisma } from "@/generated/prisma/client";

const selectCls =
  "rounded-lg border border-zinc-300 bg-transparent px-3 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; assignedToId?: string; q?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const isCsr = user.role === "CSR";

  const where: Prisma.LeadWhereInput = { organizationId: user.organizationId };
  if (isCsr) {
    where.assignedToId = user.id;
  } else if (sp.assignedToId) {
    where.assignedToId = sp.assignedToId === "none" ? null : sp.assignedToId;
  }
  if (sp.status && ALL_LEAD_STATUSES.includes(sp.status as LeadStatus)) {
    where.status = sp.status as LeadStatus;
  }
  if (sp.q) {
    where.OR = [
      { contactName: { contains: sp.q, mode: "insensitive" } },
      { company: { name: { contains: sp.q, mode: "insensitive" } } },
    ];
  }

  const [leads, csrs] = await Promise.all([
    prisma.lead.findMany({
      where,
      include: { company: true, assignedTo: true },
      orderBy: { createdAt: "desc" },
    }),
    isCsr
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { role: "CSR", organizationId: user.organizationId },
          select: { id: true, name: true, email: true },
          orderBy: { email: "asc" },
        }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {isCsr ? "Leads assigned to you" : "All leads across the agency"}
          </p>
        </div>
        <Link
          href="/leads/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New lead
        </Link>
      </div>

      {/* Filters (server-rendered GET form) */}
      <form method="get" className="mt-6 flex flex-wrap items-end gap-3">
        <input
          type="text"
          name="q"
          placeholder="Search name or company…"
          defaultValue={sp.q ?? ""}
          className={`${selectCls} min-w-56`}
        />
        <select name="status" defaultValue={sp.status ?? ""} className={selectCls}>
          <option value="">All statuses</option>
          {ALL_LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {LEAD_STATUS_META[s].label}
            </option>
          ))}
        </select>
        {!isCsr && (
          <select name="assignedToId" defaultValue={sp.assignedToId ?? ""} className={selectCls}>
            <option value="">All CSRs</option>
            <option value="none">Unassigned</option>
            {csrs.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name ?? u.email}
              </option>
            ))}
          </select>
        )}
        <button type="submit" className={`${selectCls} font-medium`}>
          Filter
        </button>
        {(sp.q || sp.status || sp.assignedToId) && (
          <Link href="/leads" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
            Clear
          </Link>
        )}
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 font-medium">Contact</th>
              <th className="px-4 py-3 font-medium">Company</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
            {leads.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                  No leads match. <Link href="/leads/new" className="underline">Create one</Link>.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.contactName ?? "—"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{lead.company?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={lead.status} />
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {lead.assignedTo?.name ?? lead.assignedTo?.email ?? "Unassigned"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
