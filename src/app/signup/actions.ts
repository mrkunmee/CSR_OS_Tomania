"use server";

import { AuthError } from "next-auth";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn } from "@/auth";
import { seedOrgDefaults } from "@/lib/org-defaults";
import { rateLimit } from "@/lib/rate-limit";

export type SignupState = { error?: string } | undefined;

function slugify(name: string): string {
  return (
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "org"
  );
}

/** Self-serve onboarding (Milestone 3.4c): create an org + first admin, seed its config, sign in. */
export async function signup(
  _prev: SignupState,
  formData: FormData,
): Promise<SignupState> {
  const orgName = String(formData.get("orgName") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const password = String(formData.get("password") ?? "");

  if (!orgName || !email || !password) {
    return { error: "Organization, email, and password are required." };
  }
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const rl = rateLimit(`signup:${email}`, 3, 10 * 60_000);
  if (!rl.ok) return { error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  // Unique org slug.
  const base = slugify(orgName);
  let slug = base;
  let n = 1;
  while (await prisma.organization.findUnique({ where: { slug } })) slug = `${base}-${n++}`;

  const org = await prisma.organization.create({ data: { name: orgName, slug } });
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name: name || null, role: "ADMIN", passwordHash, organizationId: org.id },
  });
  await seedOrgDefaults(prisma, org.id);

  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
  } catch (error) {
    // signIn throws a redirect on success — that must propagate.
    if (error instanceof AuthError) return { error: "Account created — please sign in." };
    throw error;
  }
  return undefined;
}
