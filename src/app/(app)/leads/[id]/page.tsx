import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/status-badge";
import { STATUS_TRANSITIONS } from "@/lib/lead-status";
import { StatusChanger, AssignControl } from "./lead-actions";
import { QualifyButton } from "./qualify-button";
import { RecommendationPanel } from "./recommendation-panel";
import { ConfidenceCard } from "./confidence-card";
import { PartnerReferralsCard } from "./partner-referrals-card";
import { TasksCard } from "./tasks-card";
import { OverrideForm } from "./override-form";
import { buildActiveQuestions } from "@/lib/interview";
import { computeDataConfidence } from "@/lib/confidence";
import { pickPackageByBudget } from "@/lib/partners";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm">{value || <span className="text-zinc-400">—</span>}</dd>
    </div>
  );
}

const naira = (n: number | null) =>
  n == null ? null : `₦${n.toLocaleString("en-NG")}`;

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const organizationId = user.organizationId;

  const lead = await prisma.lead.findFirst({
    where: { id, organizationId },
    include: {
      company: true,
      assignedTo: true,
      auditLogs: { include: { actor: true }, orderBy: { createdAt: "desc" }, take: 20 },
      calls: {
        include: { _count: { select: { responses: true } } },
        orderBy: { startedAt: "desc" },
      },
      recommendations: {
        include: { recommendedPackage: true, overriddenBy: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      scores: { orderBy: { createdAt: "desc" }, take: 1 },
      partnerReferrals: { include: { partnerService: true }, orderBy: { createdAt: "asc" } },
      tasks: { orderBy: [{ status: "asc" }, { dueAt: "asc" }] },
    },
  });

  if (!lead) notFound();
  if (user.role === "CSR" && lead.assignedToId !== user.id) notFound();

  const openCall = lead.calls.find((c) => c.endedAt === null) ?? null;
  const lastCall = lead.calls.find((c) => c.endedAt !== null) ?? null;
  const recommendation = lead.recommendations[0] ?? null;
  const latestScore = lead.scores[0] ?? null;
  const answered = Math.max(0, ...lead.calls.map((c) => c._count.responses), 0);
  const hasInterviewData = answered > 0;

  // Deterministic confidence (§9) — computed independently of the AI's number.
  let confidence = null as ReturnType<typeof computeDataConfidence> | null;
  if (hasInterviewData) {
    const questions = await prisma.qualificationQuestion.findMany({ where: { active: true, organizationId } });
    const totalBaseQuestions = buildActiveQuestions(questions, new Map()).length;
    confidence = computeDataConfidence({
      answered,
      totalBaseQuestions,
      isDecisionMaker: lead.isDecisionMaker,
      company: lead.company,
    });
  }

  // Deterministic package pick (§8) to cross-check the AI's choice.
  let rulesPackageName: string | null = null;
  let packages: { id: string; name: string }[] = [];
  if (recommendation) {
    const pkgs = await prisma.package.findMany({
      where: { active: true, organizationId },
      select: { id: true, name: true, minBudget: true, priceMin: true },
    });
    rulesPackageName = pickPackageByBudget(pkgs, lead.company?.marketingBudget ?? null)?.name ?? null;
    packages = pkgs.map((p) => ({ id: p.id, name: p.name }));
  }

  const canManage = user.role !== "CSR";
  const csrs = canManage
    ? await prisma.user.findMany({
        where: { role: "CSR", organizationId },
        select: { id: true, name: true, email: true },
        orderBy: { email: "asc" },
      })
    : [];

  const c = lead.company;

  return (
    <div className="max-w-4xl">
      <Link href="/leads" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Leads
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {lead.contactName ?? "Lead"}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            {c?.name ?? "No company"} · <StatusBadge status={lead.status} />
          </p>
        </div>
        <Link
          href={`/leads/${lead.id}/edit`}
          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Edit
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: details */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Contact</h2>
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Name" value={lead.contactName} />
              <Detail label="Phone" value={lead.contactPhone} />
              <Detail label="Email" value={lead.contactEmail} />
              <Detail label="Source" value={lead.source} />
              <Detail label="Decision maker" value={lead.isDecisionMaker ? "Yes" : "No"} />
              <Detail label="Assigned to" value={lead.assignedTo?.name ?? lead.assignedTo?.email} />
            </dl>
          </section>

          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-500">Company</h2>
            <dl className="grid grid-cols-2 gap-4">
              <Detail label="Company" value={c?.name} />
              <Detail label="Industry" value={c?.industry} />
              <Detail label="Products" value={c?.products} />
              <Detail label="NAFDAC" value={c?.nafdacStatus} />
              <Detail label="Monthly revenue" value={naira(c?.monthlyRevenue ?? null)} />
              <Detail label="Marketing budget" value={naira(c?.marketingBudget ?? null)} />
              <Detail label="Sales channels" value={c?.salesChannels} />
              <Detail label="Website" value={c?.website} />
            </dl>
          </section>

          {/* Qualification interview (Milestone 1.4) */}
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Qualification interview
              </h2>
              <Link
                href={`/leads/${lead.id}/interview`}
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {openCall ? "Resume interview" : lead.calls.length ? "New interview" : "Start interview"}
              </Link>
            </div>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              {openCall
                ? `In progress — ${openCall._count.responses} response${openCall._count.responses === 1 ? "" : "s"} captured.`
                : lastCall
                  ? `Last interview completed with ${lastCall._count.responses} response${lastCall._count.responses === 1 ? "" : "s"}.`
                  : "Not started. Capture this lead's profile with the guided, branching interview (§5)."}
            </p>
            {hasInterviewData ? (
              <div className="mt-4 space-y-4 border-t border-zinc-100 pt-4 dark:border-zinc-900">
                {confidence && (
                  <ConfidenceCard
                    confidence={confidence}
                    aiConfidence={recommendation?.confidenceLevel ?? null}
                  />
                )}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    AI recommendation
                  </h3>
                  <QualifyButton leadId={lead.id} hasRecommendation={!!recommendation} />
                </div>
                {recommendation ? (
                  <div className="mt-4 space-y-4">
                    {canManage && (
                      <OverrideForm
                        leadId={lead.id}
                        currentOutcome={recommendation.outcome}
                        packages={packages}
                      />
                    )}
                    <RecommendationPanel
                      rec={recommendation}
                      leadScore={latestScore?.leadScore ?? null}
                      rulesPackageName={rulesPackageName}
                    />
                    <PartnerReferralsCard referrals={lead.partnerReferrals} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-zinc-500">
                    No recommendation yet — generate one from the captured interview (§8).
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-zinc-400">
                Capture interview answers first — then the Gemini recommendation (§8) can be generated here.
              </p>
            )}
          </section>
        </div>

        {/* Right: actions + audit */}
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Status</h2>
            <StatusChanger leadId={lead.id} current={lead.status} nextOptions={STATUS_TRANSITIONS[lead.status]} />
          </section>

          {canManage && (
            <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Assignment</h2>
              <AssignControl leadId={lead.id} currentAssigneeId={lead.assignedToId} csrs={csrs} />
            </section>
          )}

          <TasksCard tasks={lead.tasks} />

          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">Audit trail</h2>
            <ol className="space-y-3">
              {lead.auditLogs.length === 0 ? (
                <li className="text-sm text-zinc-500">No activity yet.</li>
              ) : (
                lead.auditLogs.map((log) => (
                  <li key={log.id} className="text-sm">
                    <p>{log.summary}</p>
                    <p className="text-xs text-zinc-500">
                      {log.actor?.name ?? log.actor?.email ?? "System"} ·{" "}
                      {log.createdAt.toLocaleString("en-NG")}
                    </p>
                  </li>
                ))
              )}
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
