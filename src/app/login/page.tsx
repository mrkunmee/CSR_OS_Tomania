"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const DEMO = [
  { role: "Admin", email: "admin@agency.test" },
  { role: "Manager", email: "manager@agency.test" },
  { role: "CSR", email: "csr@agency.test" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState<LoginState, FormData>(
    login,
    undefined,
  );

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">AI Sales OS</h1>
          <p className="mt-1 text-sm text-zinc-500">Sign in to your workspace</p>
        </div>

        <form
          action={action}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
            />
          </div>

          {state?.error && (
            <p className="text-sm text-red-600" role="alert">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <div className="mt-6 rounded-xl border border-dashed border-zinc-300 p-4 text-xs text-zinc-500 dark:border-zinc-700">
          <p className="mb-2 font-medium text-zinc-600 dark:text-zinc-400">
            Demo accounts (password: <code>password123</code>)
          </p>
          <ul className="space-y-1">
            {DEMO.map((d) => (
              <li key={d.email} className="flex justify-between">
                <span>{d.role}</span>
                <code>{d.email}</code>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
