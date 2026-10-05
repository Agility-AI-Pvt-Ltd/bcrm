"use client";

/**
 * Every AI callback, newest first: a live countdown for each customer still
 * waiting to be called, then whether the call succeeded or failed. Re-reads
 * itself every 10 seconds while anything is counting down or on the line.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getAiCallbackActivity,
  type AiCallbackActivity,
} from "@/lib/aiCallback";
import { AI_CALLBACK_LIVE_PHASES } from "@/lib/inbox";
import { formatSince, formatWhen } from "@/lib/outreach";
import { AiCallbackBadge } from "@/components/messages/AiCallbackStatus";

const POLL_MS = 10_000;

/** Summary chips, in the order a broker reads them. */
const SUMMARY: { label: string; phases: string[]; className: string }[] = [
  {
    label: "Waiting to call",
    phases: ["scheduled", "checking"],
    className: "text-brand-600 dark:text-brand-400",
  },
  {
    label: "On the line",
    phases: ["dialing", "ringing", "on_call"],
    className: "text-brand-600 dark:text-brand-400",
  },
  { label: "Succeeded", phases: ["completed"], className: "text-success-600" },
  { label: "Failed", phases: ["failed"], className: "text-error-600" },
  { label: "Skipped", phases: ["skipped", "cancelled"], className: "text-gray-500" },
];

export default function AiCallbackActivityList() {
  const [activity, setActivity] = useState<AiCallbackActivity | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      setActivity(await getAiCallbackActivity());
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load AI calls."));
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const live = useMemo(
    () =>
      (activity?.items ?? []).some((item) => AI_CALLBACK_LIVE_PHASES.has(item.ai_callback.phase)),
    [activity],
  );

  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(timer);
  }, [live, load]);

  const counts = activity?.counts ?? {};

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">AI calls</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Time left before each call, then whether it succeeded or failed.
            {live ? " Updates automatically." : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={refreshing}
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SUMMARY.map((chip) => {
          const total = chip.phases.reduce((sum, phase) => sum + (counts[phase] ?? 0), 0);
          return (
            <div
              key={chip.label}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-white/[0.02]"
            >
              <p className={`text-lg font-bold tabular-nums ${chip.className}`}>{total}</p>
              <p className="text-[11px] text-gray-500">{chip.label}</p>
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {!activity ? (
        <p className="mt-4 text-sm text-gray-500">{error ? "" : "Loading AI calls…"}</p>
      ) : activity.items.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          No AI calls yet. When a new WhatsApp enquiry goes quiet, it appears here with a
          countdown.
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
          {activity.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                  {item.customer_name || item.phone || "Unknown customer"}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {[item.customer_name ? item.phone : null, `enquired ${formatSince(item.created_at)}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {item.ai_callback.detail ? (
                  <p
                    className="mt-1 text-xs text-gray-600 dark:text-gray-300"
                    title={formatWhen(item.created_at)}
                  >
                    {item.ai_callback.detail}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <AiCallbackBadge view={item.ai_callback} />
                <Link
                  href={`/messages?conversation=${encodeURIComponent(item.conversation_id)}`}
                  className="text-xs font-medium text-brand-500 hover:underline"
                >
                  Open chat
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
