"use client";

import { useActionState } from "react";
import { completeTask, type ActionState } from "./manage-actions";

type Task = { id: string; title: string; dueAt: Date | null; status: string };

function TaskRow({ task }: { task: Task }) {
  const [, action, pending] = useActionState<ActionState, FormData>(completeTask, undefined);
  const done = task.status === "DONE";
  return (
    <li className="flex items-start justify-between gap-3">
      <div>
        <p className={`text-sm ${done ? "text-zinc-400 line-through" : ""}`}>{task.title}</p>
        {task.dueAt && (
          <p className="text-xs text-zinc-500">
            Due {new Date(task.dueAt).toLocaleDateString("en-NG")}
          </p>
        )}
      </div>
      {!done && (
        <form action={action}>
          <input type="hidden" name="taskId" value={task.id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {pending ? "…" : "Done"}
          </button>
        </form>
      )}
    </li>
  );
}

export function TasksCard({ tasks }: { tasks: Task[] }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Follow-up tasks
      </h2>
      {tasks.length === 0 ? (
        <p className="text-sm text-zinc-500">No tasks yet — generated when the lead is qualified.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} />
          ))}
        </ul>
      )}
    </section>
  );
}
