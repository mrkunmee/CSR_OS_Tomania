import type { PartnerType } from "@/generated/prisma/enums";

const TYPE_STYLE: Record<PartnerType, string> = {
  NAFDAC: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  LOGISTICS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  BRANDING: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  WEBSITE: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CREATIVE: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300",
};

type Referral = {
  id: string;
  reason: string;
  partnerService: { name: string; type: PartnerType };
};

export function PartnerReferralsCard({ referrals }: { referrals: Referral[] }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-zinc-500">
        Partner referrals (§7)
      </h3>
      {referrals.length === 0 ? (
        <p className="text-sm text-zinc-500">No gaps detected — no partner referrals needed.</p>
      ) : (
        <ul className="space-y-3">
          {referrals.map((r) => (
            <li key={r.id} className="flex gap-3">
              <span
                className={`h-fit rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${TYPE_STYLE[r.partnerService.type]}`}
              >
                {r.partnerService.type}
              </span>
              <div>
                <p className="text-sm font-medium">{r.partnerService.name}</p>
                <p className="text-xs text-zinc-500">{r.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
