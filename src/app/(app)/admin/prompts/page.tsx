import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { PromptAdmin, type PromptGroup } from "./prompt-admin";

export default async function PromptsPage() {
  const { organizationId } = await requireRole("ADMIN");

  const templates = await prisma.promptTemplate.findMany({
    where: { organizationId },
    orderBy: [{ name: "asc" }, { version: "desc" }],
  });

  const byName = new Map<string, PromptGroup>();
  for (const t of templates) {
    if (!byName.has(t.name)) byName.set(t.name, { name: t.name, versions: [] });
    byName.get(t.name)!.versions.push({
      id: t.id,
      version: t.version,
      active: t.active,
      body: t.body,
      createdAt: t.createdAt.toISOString(),
    });
  }
  const groups = [...byName.values()];

  return (
    <div className="max-w-3xl">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Prompt library (§16)</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Versioned Gemini prompts. Editing creates a new version — history is never overwritten.
        The qualification engine always uses the active version.
      </p>

      <div className="mt-6">
        {groups.length === 0 ? (
          <p className="text-sm text-zinc-500">No prompt templates found.</p>
        ) : (
          <PromptAdmin groups={groups} />
        )}
      </div>
    </div>
  );
}
