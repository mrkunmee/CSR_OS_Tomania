"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

export type LoginState = { error?: string } | undefined;

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // Brute-force protection: cap attempts per email (§15).
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const limit = rateLimit(`login:${email}`, 5, 5 * 60_000);
  if (!limit.ok) {
    return { error: `Too many attempts. Try again in ${limit.retryAfterSec}s.` };
  }

  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    // signIn throws a redirect on success — that must propagate.
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return undefined;
}
