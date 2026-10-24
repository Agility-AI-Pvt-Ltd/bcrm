"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearAdminSession, getStoredAdmin } from "@/lib/adminApi";

/**
 * The operator console's own navigation.
 *
 * It exists because the console had none: the rate card was reachable only by
 * noticing a text link on the verification screen, opening Account spend, and
 * finding a toggle in its corner. An operator who had come to fix a price had
 * to already know where it was. Three screens, three buttons, on every one of
 * them.
 *
 * Deliberately not the agent sidebar. That belongs to a signed-in agent of one
 * agency; this credential belongs to no organisation, and the two must not
 * share a chrome that could imply they share a session.
 */

const LINKS: Array<{ href: string; label: string }> = [
  { href: "/admin", label: "Accounts" },
  { href: "/admin/spend", label: "Spend" },
  { href: "/admin/rates", label: "Rates" },
  { href: "/admin/developers", label: "Developers" },
];

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();
  const admin = getStoredAdmin();

  const signOut = () => {
    clearAdminSession();
    router.replace("/admin/login");
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 pb-4 dark:border-gray-800">
      <nav
        aria-label="Operator console"
        className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
      >
        {LINKS.map((link) => {
          // Exact match for the console root, prefix for the rest, so /admin
          // does not light up on every page under it.
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-600 dark:text-gray-300">
          {admin?.name || admin?.email}
        </span>
        <button
          type="button"
          onClick={signOut}
          className="text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
