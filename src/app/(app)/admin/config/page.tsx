import Link from "next/link";
import { requireRole } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { savePackage, savePartner, saveWeight, saveThreshold, saveCadence } from "./actions";

const input =
  "rounded-lg border border-zinc-300 bg-transparent px-2.5 py-1.5 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100";
const saveBtn =
  "rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200";
const PARTNER_TYPES = ["NAFDAC", "LOGISTICS", "BRANDING", "WEBSITE", "CREATIVE"] as const;

function Section({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-4 text-xs text-zinc-500">{hint}</p>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export default async function ConfigPage() {
  const { organizationId } = await requireRole("ADMIN");

  const [packages, partners, weights, thresholds, cadences] = await Promise.all([
    prisma.package.findMany({ where: { organizationId }, orderBy: { minBudget: "asc" } }),
    prisma.partnerService.findMany({ where: { organizationId }, orderBy: { type: "asc" } }),
    prisma.scoringWeight.findMany({ where: { organizationId }, orderBy: { key: "asc" } }),
    prisma.qualificationThreshold.findMany({ where: { organizationId }, orderBy: { key: "asc" } }),
    prisma.followUpCadence.findMany({ where: { organizationId }, orderBy: { offsetDays: "asc" } }),
  ]);

  return (
    <div className="max-w-4xl">
      <Link href="/admin" className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Configuration (§12)</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Change packages, partners, and scoring without code. Items are deactivated, never deleted.
      </p>

      <div className="mt-6 space-y-6">
        {/* Packages */}
        <Section title="Packages" hint="Recommendable agency packages (₦). minBudget drives the deterministic package pick.">
          {packages.map((p) => (
            <form key={p.id} action={savePackage} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={p.id} />
              <input name="name" defaultValue={p.name} className={`${input} w-32`} />
              <input name="description" defaultValue={p.description ?? ""} placeholder="description" className={`${input} flex-1 min-w-40`} />
              <input name="priceMin" type="number" defaultValue={p.priceMin ?? ""} placeholder="price min" className={`${input} w-24`} />
              <input name="priceMax" type="number" defaultValue={p.priceMax ?? ""} placeholder="price max" className={`${input} w-24`} />
              <input name="minBudget" type="number" defaultValue={p.minBudget ?? ""} placeholder="min budget" className={`${input} w-28`} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={p.active} /> active</label>
              <button type="submit" className={saveBtn}>Save</button>
            </form>
          ))}
          <form action={savePackage} className="flex flex-wrap items-center gap-2 border-t border-dashed border-zinc-300 pt-3 dark:border-zinc-700">
            <input name="name" placeholder="new package name" className={`${input} w-32`} />
            <input name="description" placeholder="description" className={`${input} flex-1 min-w-40`} />
            <input name="priceMin" type="number" placeholder="price min" className={`${input} w-24`} />
            <input name="priceMax" type="number" placeholder="price max" className={`${input} w-24`} />
            <input name="minBudget" type="number" placeholder="min budget" className={`${input} w-28`} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked /> active</label>
            <button type="submit" className={saveBtn}>Add</button>
          </form>
        </Section>

        {/* Partner services */}
        <Section title="Partner services" hint="Referral partners matched by type (§7).">
          {partners.map((s) => (
            <form key={s.id} action={savePartner} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={s.id} />
              <input name="name" defaultValue={s.name} className={`${input} w-48`} />
              <select name="type" defaultValue={s.type} className={input}>
                {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input name="description" defaultValue={s.description ?? ""} placeholder="description" className={`${input} flex-1 min-w-40`} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={s.active} /> active</label>
              <button type="submit" className={saveBtn}>Save</button>
            </form>
          ))}
          <form action={savePartner} className="flex flex-wrap items-center gap-2 border-t border-dashed border-zinc-300 pt-3 dark:border-zinc-700">
            <input name="name" placeholder="new partner name" className={`${input} w-48`} />
            <select name="type" defaultValue="NAFDAC" className={input}>
              {PARTNER_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input name="description" placeholder="description" className={`${input} flex-1 min-w-40`} />
            <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked /> active</label>
            <button type="submit" className={saveBtn}>Add</button>
          </form>
        </Section>

        {/* Scoring weights */}
        <Section title="Scoring weights" hint="Relative weights the scoring model applies to each factor.">
          {weights.map((w) => (
            <form key={w.id} action={saveWeight} className="flex items-center gap-3">
              <input type="hidden" name="id" value={w.id} />
              <span className="w-40 text-sm font-medium">{w.key}</span>
              <input name="weight" type="number" step="0.05" defaultValue={w.weight} className={`${input} w-24`} />
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={w.active} /> active</label>
              <button type="submit" className={saveBtn}>Save</button>
            </form>
          ))}
        </Section>

        {/* Thresholds */}
        <Section title="Qualification thresholds" hint="Score cut-offs for qualification tiers.">
          {thresholds.map((t) => (
            <form key={t.id} action={saveThreshold} className="flex items-center gap-3">
              <input type="hidden" name="id" value={t.id} />
              <span className="w-48 text-sm font-medium">{t.key}</span>
              <input name="value" type="number" step="1" defaultValue={t.value} className={`${input} w-24`} />
              <button type="submit" className={saveBtn}>Save</button>
            </form>
          ))}
        </Section>

        {/* Cadences */}
        <Section title="Follow-up cadences" hint="Days after qualification to schedule the first follow-up, per outcome.">
          {cadences.map((c) => (
            <form key={c.id} action={saveCadence} className="flex items-center gap-3">
              <input type="hidden" name="id" value={c.id} />
              <span className="w-56 text-sm font-medium">{c.outcome}</span>
              <input name="offsetDays" type="number" min="0" defaultValue={c.offsetDays} className={`${input} w-20`} />
              <span className="text-xs text-zinc-500">days</span>
              <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={c.active} /> active</label>
              <button type="submit" className={saveBtn}>Save</button>
            </form>
          ))}
        </Section>
      </div>
    </div>
  );
}
