"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStoredUser } from "@/hooks/useStoredUser";
import { canOpen } from "@/lib/access";

/**
 * Keeps an agent out of the sections they do not have, even by typed URL or an
 * in-page link. The sidebar already fades those entries and does not navigate;
 * this is the same rule for every other way of arriving. The sidebar stays on
 * screen so the way back is one click.
 */
export default function AgentRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const user = useStoredUser();
  if (canOpen(pathname, user)) return <>{children}</>;
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-sm text-center">
        <p className="text-base font-semibold text-gray-800 dark:text-white/90">
          This section is not available on your account
        </p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You can use Home, Messages, Properties, Site Visits, Daily Digest, Visit calendar,
          Notifications and your profile.
        </p>
        <Link
          href="/leads"
          className="mt-5 inline-flex rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
