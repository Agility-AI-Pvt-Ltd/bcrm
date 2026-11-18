"use client";

/**
 * A red bar across every page while one of the agency's connections is broken —
 * a WhatsApp token that expired, Zoho credentials that were revoked. An expired
 * token stops every reply at once, and the agency used to find out from
 * customers; this, and the bell the backend rings once, are how they find out
 * first. Re-checked on every page change, and hidden when all is well.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

type ConnectionProblem = {
  source: string;
  label: string;
  message: string;
  fix_href: string;
  broken_at: string | null;
};

export default function ConnectionProblemsBar() {
  const pathname = usePathname();
  const [problems, setProblems] = useState<ConnectionProblem[]>([]);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ConnectionProblem[]>("/api/v1/connections/problems")
      .then((found) => {
        if (!cancelled) setProblems(found ?? []);
      })
      .catch(() => {
        // A failed check must not cover the page; the next navigation retries.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  if (problems.length === 0) return null;
  return (
    <div role="alert" className="bg-error-600 px-4 py-2 text-sm text-white">
      {problems.map((problem) => (
        <p key={problem.source} className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium">{problem.message}</span>
          {pathname !== problem.fix_href ? (
            <Link href={problem.fix_href} className="font-semibold underline">
              Reconnect {problem.label}
            </Link>
          ) : null}
        </p>
      ))}
    </div>
  );
}
