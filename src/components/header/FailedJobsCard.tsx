"use client";

/**
 * Failed AI calls and visit reminders, under the failed replies on the
 * Notifications page, where the "something failed" bell lands. Hidden when
 * there are none.
 *
 * Retry places the AI call again (a new call, through the same checks), or
 * sends the reminder now. A reminder held for a missing location pin is fixed
 * by adding the pin on Site Visits, so that row links there.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import { dismissFailedJob, listFailedJobs, retryFailedJob, type FailedJob } from "@/lib/failedJobs";
import { relativeTime } from "@/lib/notifications";

export default function FailedJobsCard() {
  const [items, setItems] = useState<FailedJob[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const page = await listFailedJobs();
      setItems(page.items);
    } catch {
      // The rest of the page still works; this panel just stays hidden.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (job: FailedJob, action: "retry" | "dismiss") => {
    setBusy(`${job.kind}:${job.id}`);
    setError("");
    try {
      if (action === "retry") {
        await retryFailedJob(job);
        setNotice(job.kind === "ai_call" ? "Calling again now." : "Reminder sent.");
      } else {
        await dismissFailedJob(job);
        setNotice("Dismissed. Nothing was sent.");
      }
      await load();
    } catch (err) {
      setError(failureText(err, "Could not do that."));
    } finally {
      setBusy("");
    }
  };

  if (items.length === 0 && !notice && !error) return null;

  return (
    <section
      id="failed-jobs"
      className="mb-6 rounded-2xl border border-error-200 bg-white p-5 dark:border-error-500/30 dark:bg-white/[0.03] lg:p-6"
    >
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Failed calls and reminders {items.length ? `(${items.length})` : ""}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        AI calls that did not connect and visit reminders that did not go out. Retry, or dismiss
        if you reached the customer another way.
      </p>
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((job) => {
          const key = `${job.kind}:${job.id}`;
          const needsPin = job.kind === "reminder" && /location pin/i.test(job.reason);
          return (
            <li key={key} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {job.what} · {job.customer_name || job.customer_phone || "A customer"}{" "}
                  {job.failed_at ? (
                    <span className="text-xs font-normal text-gray-400">
                      · {relativeTime(job.failed_at)}
                    </span>
                  ) : null}
                </p>
                {job.visit_label ? (
                  <p className="mt-0.5 text-xs text-gray-500">Visit {job.visit_label}</p>
                ) : null}
                <p className="mt-0.5 text-xs text-gray-500">{job.reason}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {job.conversation_id ? (
                  <Link
                    href={`/messages?conversation=${job.conversation_id}`}
                    className="text-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    Open chat
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled={busy === key}
                  onClick={() => void act(job, "dismiss")}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Dismiss
                </button>
                {needsPin ? (
                  <Link
                    href="/site-visits"
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
                  >
                    Add the pin
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={busy === key}
                    onClick={() => void act(job, "retry")}
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {busy === key ? "Working…" : job.kind === "ai_call" ? "Call again" : "Send now"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
