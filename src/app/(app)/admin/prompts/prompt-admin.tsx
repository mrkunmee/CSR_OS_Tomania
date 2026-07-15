"use client";

import { useActionState, useState } from "react";
import { saveNewVersion, activateVersion, type PromptState } from "./actions";

export type PromptVersion = {
  id: string;
  version: number;
  active: boolean;
  body: string;
  createdAt: string;
};
export type PromptGroup = { name: string; versions: PromptVersion[] };

function ActivateButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [, action, pending] = useActionState<PromptState, FormData>(activateVersion, undefined);
  if (disabled) {
    return <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">Active</span>;
  }
  return (
    <form action={action}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {pending ? "…" : "Activate"}
      </button>
    </form>
  );
}

function Editor({ name, activeBody }: { name: string; activeBody: string }) {
  const [state, action, pending] = useActionState<PromptState, FormData>(saveNewVersion, undefined);
  const [body, setBody] = useState(activeBody);

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="name" value={name} />
      <textarea
        name="body"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={8}
        className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || body.trim() === ""}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Saving…" : "Save as new version"}
        </button>
        <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" name="activate" defaultChecked /> Activate immediately
        </label>
        {state?.ok && !pending && <span className="text-sm text-emerald-600">Saved.</span>}
        {state?.error && <span className="text-sm text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function PromptAdmin({ groups }: { groups: PromptGroup[] }) {
  return (
    <div className="space-y-8">
      {groups.map((g) => {
        const active = g.versions.find((v) => v.active) ?? g.versions[0];
        return (
          <section key={g.name} className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-base font-semibold">{g.name}</h2>

            <div className="mt-3 space-y-2">
              {g.versions.map((v) => (
                <div key={v.id} className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                  <span>
                    v{v.version}
                    <span className="ml-2 text-xs text-zinc-500">{new Date(v.createdAt).toLocaleString("en-NG")}</span>
                  </span>
                  <ActivateButton id={v.id} disabled={v.active} />
                </div>
              ))}
            </div>

            <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Edit (creates v{Math.max(...g.versions.map((v) => v.version)) + 1})
            </p>
            <Editor name={g.name} activeBody={active?.body ?? ""} />
          </section>
        );
      })}
    </div>
  );
}
