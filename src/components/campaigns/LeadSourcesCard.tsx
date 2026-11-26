"use client";

/**
 * Lead sources on Home: a light per source and "last lead X min ago". Red when a
 * connection is broken (fix it now), amber when a source has gone quiet (a lapsed
 * portal package or a stopped ad), green when leads are arriving.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLeadSources, type LeadSource } from "@/lib/leadSources";

const DOT: Record<LeadSource["light"], string> = {
  green: "bg-success-500",
  amber: "bg-warning-500",
  red: "bg-error-500",
  grey: "bg-gray-300 dark:bg-gray-600",
};

const LIGHT_WORD: Record<LeadSource["light"], string> = {
  green: "Working",
  amber: "Quiet",
  red: "Broken",
  grey: "No leads yet",
};

export default function LeadSourcesCard() {
  const [sources, setSources] = useState<LeadSource[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    getLeadSources()
      .then((rows) => {
        if (current) setSources(rows);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, []);

  if (failed || (sources && sources.length === 0)) return null;

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">Lead sources</h2>
      <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
        Where your leads come from, and whether each one is still sending them.
      </p>
      {sources === null ? (
        <p className="mt-3 text-sm text-gray-500">Loading…</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {sources.map((source) => (
            <li key={source.key} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[source.light]}`}
                role="img"
                aria-label={LIGHT_WORD[source.light]}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                  {source.label}
                  {source.leads_7d ? (
                    <span className="ml-1.5 text-xs font-normal text-gray-400">{source.leads_7d} this week</span>
                  ) : null}
                </span>
                <span className={`block text-xs ${source.light === "red" ? "text-error-600" : "text-gray-500 dark:text-gray-400"}`}>
                  {source.note}
                </span>
                {source.fix_href ? (
                  <Link href={source.fix_href} className="mt-0.5 inline-block text-xs font-medium text-brand-600 hover:text-brand-700">
                    Fix it →
                  </Link>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
