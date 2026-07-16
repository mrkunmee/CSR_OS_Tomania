import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";

function ConfigCard({
  title,
  count,
  hint,
  href,
}: {
  title: string;
  count: number;
  hint: string;
  href?: string;
}) {
  const inner = (
    <>
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-2xl font-semibold tabular-nums">{count}</span>
      </div>
      <p className="mt-1 text-xs text-zinc-500">
        {hint}
        {href && <span className="ml-1 text-zinc-400">· Edit →</span>}
      </p>
    </>
  );
  const cls =
    "block rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950";
  return href ? (
    <Link href={href} className={`${cls} transition-colors hover:border-zinc-400 dark:hover:border-zinc-600`}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}

export default async function AdminPage() {
  // ADMIN-only — middleware also blocks non-admins, this is defense in depth.
  const { organizationId } = await requireRole("ADMIN");
  const where = { organizationId };

  const [packages, partners, weights, thresholds, questions, cadences, prompts, team] =
    await Promise.all([
      prisma.package.count({ where }),
      prisma.partnerService.count({ where }),
      prisma.scoringWeight.count({ where }),
      prisma.qualificationThreshold.count({ where }),
      prisma.qualificationQuestion.count({ where }),
      prisma.followUpCadence.count({ where }),
      prisma.promptTemplate.count({ where }),
      prisma.user.count({ where }),
    ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Configuration-first settings (Blueprint §12). Prompt templates are editable now;
        the rest become editable through Phase 2.
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <ConfigCard title="Packages" count={packages} hint="Recommendable agency packages" href="/admin/config" />
        <ConfigCard title="Partner services" count={partners} hint="NAFDAC, logistics, branding…" href="/admin/config" />
        <ConfigCard title="Scoring weights" count={weights} hint="Lead-scoring factors" href="/admin/config" />
        <ConfigCard title="Thresholds" count={thresholds} hint="Qualification cut-offs" href="/admin/config" />
        <ConfigCard title="Questions" count={questions} hint="Dynamic interview questions + branching" href="/admin/questions" />
        <ConfigCard title="Follow-up cadences" count={cadences} hint="Per-outcome timing" href="/admin/config" />
        <ConfigCard title="Prompt templates" count={prompts} hint="Versioned Gemini prompts" href="/admin/prompts" />
        <ConfigCard title="Team" count={team} hint="Members of this organization" href="/admin/team" />
      </div>
    </div>
  );
}
