"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup, type SignupState } from "./actions";

const input =
  "w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";

export default function SignupPage() {
  const [state, action, pending] = useActionState<SignupState, FormData>(signup, undefined);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Create your agency</h1>
          <p className="mt-1 text-sm text-zinc-500">Start a new AI Sales OS workspace</p>
        </div>

        <form
          action={action}
          className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="space-y-1">
            <label htmlFor="orgName" className="text-sm font-medium">Agency name</label>
            <input id="orgName" name="orgName" required className={input} placeholder="e.g. BrightAds" />
          </div>
          <div className="space-y-1">
            <label htmlFor="name" className="text-sm font-medium">Your name</label>
            <input id="name" name="name" className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" name="email" type="email" required autoComplete="email" className={input} />
          </div>
          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium">Password</label>
            <input id="password" name="password" type="password" required autoComplete="new-password" minLength={8} className={input} />
            <p className="text-xs text-zinc-400">At least 8 characters. You&apos;ll be the org admin.</p>
          </div>

          {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-zinc-900 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Creating…" : "Create agency"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-100">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
