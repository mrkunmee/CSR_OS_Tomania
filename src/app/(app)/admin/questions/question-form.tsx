"use client";

import { useActionState } from "react";
import { saveQuestion, type QuestionState } from "./actions";

const input =
  "rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

export type QuestionData = {
  id: string;
  key: string;
  text: string;
  category: string;
  order: number;
  active: boolean;
  branchText: string;
};

export function QuestionForm({
  question,
  categories,
}: {
  question?: QuestionData;
  categories: string[];
}) {
  const [state, action, pending] = useActionState<QuestionState, FormData>(saveQuestion, undefined);
  const isNew = !question;

  return (
    <form action={action} className="space-y-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      {question && <input type="hidden" name="id" value={question.id} />}

      <div className="flex flex-wrap items-center gap-2">
        <input
          name="key"
          defaultValue={question?.key}
          placeholder="key"
          readOnly={!isNew}
          className={`${input} w-36 ${!isNew ? "opacity-60" : ""}`}
        />
        <input name="category" defaultValue={question?.category} placeholder="category" list="categories" className={`${input} w-40`} />
        <input name="order" type="number" defaultValue={question?.order ?? 0} placeholder="order" className={`${input} w-20`} />
        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={question?.active ?? true} /> active</label>
        <button
          type="submit"
          disabled={pending}
          className="ml-auto rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : isNew ? "Add question" : "Save"}
        </button>
      </div>

      <input name="text" defaultValue={question?.text} placeholder="Question text shown to the prospect" className={`${input} w-full`} />

      <div>
        <textarea
          name="branchRules"
          defaultValue={question?.branchText}
          rows={2}
          placeholder="Branching (one per line):  no -> nafdacTimeline"
          className={`${input} w-full font-mono text-xs`}
        />
        <p className="text-[11px] text-zinc-400">
          Format: <code>answerContains -&gt; targetKey1, targetKey2</code>. Targets must be existing question keys.
        </p>
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && !pending && <p className="text-sm text-emerald-600">Saved.</p>}

      <datalist id="categories">
        {categories.map((c) => <option key={c} value={c} />)}
      </datalist>
    </form>
  );
}
