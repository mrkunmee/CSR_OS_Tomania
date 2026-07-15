import Link from "next/link";
import { requireUser } from "@/lib/auth-helpers";
import { signOut } from "@/auth";
import type { Role } from "@/generated/prisma/enums";

type NavItem = { href: string; label: string; roles?: Role[] };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/analytics", label: "Analytics", roles: ["MANAGER", "ADMIN"] },
  { href: "/admin", label: "Admin", roles: ["ADMIN"] },
];

const ROLE_BADGE: Record<Role, string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  CSR: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const items = NAV.filter((i) => !i.roles || i.roles.includes(user.role));

  return (
    <div className="flex min-h-full flex-1">
      {/* Sidebar */}
      <aside className="flex w-60 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <span className="text-sm font-semibold tracking-tight">AI Sales OS</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="block rounded-lg px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-zinc-200 p-3 dark:border-zinc-800">
          <div className="mb-2 px-2">
            <p className="truncate text-sm font-medium">{user.name ?? user.email}</p>
            <span
              className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${ROLE_BADGE[user.role]}`}
            >
              {user.role}
            </span>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/login" });
            }}
          >
            <button
              type="submit"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
