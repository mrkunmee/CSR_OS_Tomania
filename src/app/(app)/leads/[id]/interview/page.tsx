import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { buildActiveQuestions } from "@/lib/interview";
import { StatusBadge } from "@/components/status-badge";
import { InterviewForm } from "./interview-form";
import { CallAssistant } from "./call-assistant";
import { startInterview, completeInterview } from "./actions";

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!lead) notFound();
  if (user.role === "CSR" && lead.assignedToId !== user.id) notFound();

  const openCall = await prisma.call.findFirst({
    where: { leadId: id, endedAt: null },
    include: { responses: true },
    orderBy: { startedAt: "desc" },
  });

  const header = (
    <div>
      <Link href={`/leads/${id}`} className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← {lead.contactName ?? "Lead"}
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Qualification interview</h1>
      <p className="mt-1 text-sm text-zinc-500">
        {lead.company?.name ?? "No company"} · <StatusBadge status={lead.status} />
      </p>
    </div>
  );

  // No open interview → offer to start one.
  if (!openCall) {
    return (
      <div className="max-w-2xl">
        {header}
        <div className="mt-6 rounded-xl border border-zinc-200 p-6 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Start a guided interview to capture this lead&apos;s profile (§5). Questions
            adapt as you answer — e.g. an unregistered NAFDAC status reveals a follow-up.
          </p>
          <form action={startInterview} className="mt-4">
            <input type="hidden" name="leadId" value={id} />
            <button
              type="submit"
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Start interview
            </button>
          </form>
        </div>
      </div>
    );
  }

  const questions = await prisma.qualificationQuestion.findMany({
    where: { active: true },
  });
  const answers = new Map(openCall.responses.map((r) => [r.questionKey, r.answer]));
  const active = buildActiveQuestions(questions, answers);

  return (
    <div className="max-w-2xl">
      {header}
      <div className="mt-6">
        <CallAssistant leadId={id} />
      </div>

      <div className="mt-6">
        <InterviewForm
          leadId={id}
          callId={openCall.id}
          questions={active}
          notes={openCall.notes ?? ""}
        />
      </div>

      {/* Complete is a separate form so it isn't nested inside the save form */}
      <div className="mt-6 flex items-center justify-between rounded-xl border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <p className="text-sm text-zinc-500">
          Finished? Completing hands off to the AI qualification engine (Milestone 1.5).
        </p>
        <form action={completeInterview}>
          <input type="hidden" name="leadId" value={id} />
          <input type="hidden" name="callId" value={openCall.id} />
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Complete interview
          </button>
        </form>
      </div>
    </div>
  );
}
