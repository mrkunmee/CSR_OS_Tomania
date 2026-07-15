import type { LeadStatus } from "@/generated/prisma/enums";

export const LEAD_STATUS_META: Record<LeadStatus, { label: string; color: string }> = {
  NEW: { label: "New", color: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300" },
  ASSIGNED: { label: "Assigned", color: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300" },
  IN_QUALIFICATION: { label: "In qualification", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300" },
  QUALIFIED: { label: "Qualified", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" },
  QUALIFIED_WITH_CONDITIONS: { label: "Qualified (conditions)", color: "bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300" },
  NEEDS_NURTURING: { label: "Needs nurturing", color: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300" },
  PARTNER_REFERRAL: { label: "Partner referral", color: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300" },
  DISQUALIFIED_WITH_ROADMAP: { label: "Disqualified (roadmap)", color: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300" },
  WON: { label: "Won", color: "bg-green-600 text-white" },
  LOST: { label: "Lost", color: "bg-zinc-500 text-white" },
};

export const ALL_LEAD_STATUSES = Object.keys(LEAD_STATUS_META) as LeadStatus[];

/**
 * Allowed manual status transitions (Blueprint §6). The AI qualification engine
 * (Milestone 1.5) will set the five outcome statuses; until then CSRs/managers
 * move leads manually, and these rules prevent nonsensical jumps.
 */
export const STATUS_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW: ["ASSIGNED", "IN_QUALIFICATION", "LOST"],
  ASSIGNED: ["IN_QUALIFICATION", "LOST"],
  IN_QUALIFICATION: [
    "QUALIFIED",
    "QUALIFIED_WITH_CONDITIONS",
    "NEEDS_NURTURING",
    "PARTNER_REFERRAL",
    "DISQUALIFIED_WITH_ROADMAP",
    "LOST",
  ],
  QUALIFIED: ["WON", "LOST", "IN_QUALIFICATION"],
  QUALIFIED_WITH_CONDITIONS: ["QUALIFIED", "WON", "LOST", "IN_QUALIFICATION"],
  NEEDS_NURTURING: ["IN_QUALIFICATION", "LOST"],
  PARTNER_REFERRAL: ["IN_QUALIFICATION", "QUALIFIED", "LOST"],
  DISQUALIFIED_WITH_ROADMAP: ["NEEDS_NURTURING", "IN_QUALIFICATION", "LOST"],
  WON: [],
  LOST: ["IN_QUALIFICATION"],
};

export function canTransition(from: LeadStatus, to: LeadStatus): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}
