"use client";

import { useActionState } from "react";
import { addTeamMember, type TeamState } from "./actions";

const input =
  "rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

export function TeamForm() {
  const [state, action, pending] = useActionState<TeamState, FormData>(addTeamMember, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input name="name" placeholder="Name" className={`${input} w-32`} />
      <input name="email" type="email" placeholder="email@agency.com" required className={`${input} w-56`} />
      <select name="role" defaultValue="CSR" className={input}>
        <option value="CSR">CSR</option>
        <option value="MANAGER">Manager</option>
        <option value="ADMIN">Admin</option>
      </select>
      <input name="password" type="password" placeholder="temp password" required minLength={8} className={`${input} w-40`} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? "Adding…" : "Add member"}
      </button>
      {state?.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-sm text-emerald-600">{state.ok}</p>}
    </form>
  );
}
