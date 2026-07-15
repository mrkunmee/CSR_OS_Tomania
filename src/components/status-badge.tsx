import { LEAD_STATUS_META } from "@/lib/lead-status";
import type { LeadStatus } from "@/generated/prisma/enums";

export function StatusBadge({ status }: { status: LeadStatus }) {
  const meta = LEAD_STATUS_META[status];
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.color}`}
    >
      {meta.label}
    </span>
  );
}
