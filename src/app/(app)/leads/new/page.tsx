import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { LeadForm } from "../lead-form";
import { createLead } from "../actions";

export default async function NewLeadPage() {
  const user = await requireUser();
  const canAssign = user.role !== "CSR";

  const csrs = canAssign
    ? await prisma.user.findMany({
        where: { role: "CSR" },
        select: { id: true, name: true, email: true },
        orderBy: { email: "asc" },
      })
    : [];

  return (
    <div>
      <Link href="/leads" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Leads
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">New lead</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {canAssign ? "Create a lead and optionally assign a CSR." : "New leads are assigned to you."}
      </p>

      <div className="mt-6">
        <LeadForm action={createLead} csrs={csrs} canAssign={canAssign} submitLabel="Create lead" />
      </div>
    </div>
  );
}
