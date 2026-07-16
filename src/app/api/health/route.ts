import { prisma } from "@/lib/prisma";

// Public diagnostic (no auth): reports whether the runtime can reach the DB.
// Safe to remove once the deployment is confirmed healthy.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.user.count();
    return Response.json({ ok: true, db: "reachable", users });
  } catch (e) {
    return Response.json(
      { ok: false, db: "unreachable", error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
