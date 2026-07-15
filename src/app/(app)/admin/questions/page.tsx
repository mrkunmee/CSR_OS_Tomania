import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { branchRulesToText } from "@/lib/branch-rules";
import { QuestionForm, type QuestionData } from "./question-form";

export default async function QuestionsPage() {
  await requireRole("ADMIN");

  const questions = await prisma.qualificationQuestion.findMany({
    orderBy: { order: "asc" },
  });

  const data: QuestionData[] = questions.map((q) => ({
    id: q.id,
    key: q.key,
    text: q.text,
    category: q.category,
    order: q.order,
    active: q.active,
    branchText: branchRulesToText(q.branchRules),
  }));

  const categories = [...new Set(questions.map((q) => q.category))].sort();

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Interview questions (§5)</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Edit the dynamic qualification questions and their branching. Changes take effect on the
        next interview — no code changes. Deactivate rather than delete to preserve history.
      </p>

      <div className="mt-6 space-y-3">
        {data.map((q) => (
          <QuestionForm key={q.id} question={q} categories={categories} />
        ))}
      </div>

      <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-zinc-500">Add a question</h2>
      <div className="mt-3">
        <QuestionForm categories={categories} />
      </div>
    </div>
  );
}
