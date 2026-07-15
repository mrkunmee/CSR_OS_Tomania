import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-zinc-500">{label}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const isCsr = user.role === "CSR";

  // CSRs see only their own book; managers/admins see the whole pipeline.
  const leadWhere = isCsr ? { assignedToId: user.id } : {};

  const [totalLeads, qualified, needsWork, openTasks] = await Promise.all([
    prisma.lead.count({ where: leadWhere }),
    prisma.lead.count({
      where: { ...leadWhere, status: { in: ["QUALIFIED", "QUALIFIED_WITH_CONDITIONS", "WON"] } },
    }),
    prisma.lead.count({
      where: { ...leadWhere, status: { in: ["NEW", "ASSIGNED", "IN_QUALIFICATION", "NEEDS_NURTURING"] } },
    }),
    prisma.task.count({
      where: { status: "OPEN", ...(isCsr ? { lead: { assignedToId: user.id } } : {}) },
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        Welcome, {user.name ?? user.email}
      </h1>
      <p className="mt-1 text-sm text-zinc-500">
        {isCsr
          ? "Your assigned pipeline"
          : `Agency-wide pipeline (${user.role.toLowerCase()} view)`}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label={isCsr ? "My leads" : "Total leads"} value={totalLeads} />
        <Stat label="Qualified / won" value={qualified} />
        <Stat label="In progress" value={needsWork} />
        <Stat label="Open tasks" value={openTasks} />
      </div>

      <div className="mt-8 rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-500 dark:border-zinc-700">
        Lead management, the qualification interview, and the AI engine arrive in
        Milestones 1.3–1.5.
      </div>
    </div>
  );
}
