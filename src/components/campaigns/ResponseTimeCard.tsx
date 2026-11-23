"use client";

/**
 * Speed to lead on Home: median and slowest time to first response, by source
 * and by agent. "Whoever calls first wins", so this is the proof.
 *
 * Its own period switch rather than Home's: Home counts by calendar week and
 * month, and a response time is read over a rolling window.
 */

import { useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  formatDuration,
  getResponseTime,
  RESPONSE_PERIODS,
  type ResponseDays,
  type ResponseStats,
  type ResponseTimeReport,
} from "@/lib/responseTime";

function Headline({ title, hint, stats }: { title: string; hint: string; stats: ResponseStats }) {
  return (
    <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</p>
      <p className="mt-0.5 text-[11px] leading-snug text-gray-400">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2">
        <div>
          <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            {formatDuration(stats.median_seconds)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">median</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
            {formatDuration(stats.slowest_seconds)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">slowest</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {stats.answered} of {stats.enquiries} answered
        {stats.waiting > 0 ? (
          <span className="font-medium text-error-600">
            {" "}
            · {stats.waiting} still waiting, longest {formatDuration(stats.oldest_waiting_seconds)}
          </span>
        ) : null}
      </p>
    </div>
  );
}

const th = "px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400";
const td = "px-3 py-2 text-sm text-gray-700 dark:text-gray-200 whitespace-nowrap";

export default function ResponseTimeCard() {
  const [days, setDays] = useState<ResponseDays>(7);
  const [report, setReport] = useState<ResponseTimeReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let current = true;
    getResponseTime(days)
      .then((data) => {
        if (!current) return;
        setReport(data);
        setError(null);
      })
      .catch((err) => {
        if (current) setError(err instanceof ApiError ? err.message : "Could not load response times.");
      });
    // Only the newest answer is drawn: switching period quickly must not let an
    // older, slower request overwrite it.
    return () => {
      current = false;
    };
  }, [days]);

  const empty = report !== null && report.first_reply.enquiries === 0;

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">Speed to lead</h2>
          <p className="mt-0.5 max-w-2xl text-xs text-gray-500 dark:text-gray-400">
            How fast new enquiries hear back: from a customer&apos;s first WhatsApp message, or a
            portal lead arriving. Campaign contacts and people marked Not a lead are left out.
          </p>
        </div>
        <div
          role="group"
          aria-label="Response time period"
          className="flex rounded-lg border border-gray-300 p-0.5 dark:border-gray-700"
        >
          {RESPONSE_PERIODS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => setDays(option.days)}
              aria-pressed={days === option.days}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                days === option.days
                  ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm text-error-600">{error}</p>
      ) : report === null ? (
        <p className="mt-4 text-sm text-gray-500">Loading…</p>
      ) : empty ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          No new enquiries in this period.
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <Headline
              title="First reply"
              hint="Anything sent back: the AI's reply, the first message, an AI call or a person."
              stats={report.first_reply}
            />
            <Headline
              title="First contact by a person"
              hint="A message typed in Messages, or a call marked as done."
              stats={report.first_human}
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="mt-3 text-xs font-medium text-brand-500 hover:text-brand-600"
          >
            {open ? "Hide by source and agent" : "By source and agent →"}
          </button>

          {open ? (
            <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="overflow-x-auto">
                <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-200">By source</p>
                <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                  <thead>
                    <tr>
                      <th className={th}>Source</th>
                      <th className={th}>Enquiries</th>
                      <th className={th}>First reply (median / slowest)</th>
                      <th className={th}>By a person (median / slowest)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {report.by_source.map((row) => (
                      <tr key={row.source}>
                        <td className={td}>{row.source}</td>
                        <td className={td}>{row.first_reply.enquiries}</td>
                        <td className={td}>
                          {formatDuration(row.first_reply.median_seconds)} /{" "}
                          {formatDuration(row.first_reply.slowest_seconds)}
                          {row.first_reply.waiting > 0 ? (
                            <span className="ml-1 text-error-600">({row.first_reply.waiting} waiting)</span>
                          ) : null}
                        </td>
                        <td className={td}>
                          {formatDuration(row.first_human.median_seconds)} /{" "}
                          {formatDuration(row.first_human.slowest_seconds)}
                          {row.first_human.waiting > 0 ? (
                            <span className="ml-1 text-gray-400">({row.first_human.waiting} not yet)</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-200">By agent</p>
                {report.by_agent.length === 0 ? (
                  <p className="text-sm text-gray-500">Nobody has answered an enquiry in this period.</p>
                ) : (
                  <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                    <thead>
                      <tr>
                        <th className={th}>Who</th>
                        <th className={th}>Enquiries</th>
                        <th className={th}>Median</th>
                        <th className={th}>Slowest</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {report.by_agent.map((row) => (
                        <tr key={row.agent}>
                          <td className={td}>{row.agent}</td>
                          <td className={td}>{row.enquiries}</td>
                          <td className={td}>{formatDuration(row.median_seconds)}</td>
                          <td className={td}>{formatDuration(row.slowest_seconds)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                <p className="mt-1 text-[11px] leading-snug text-gray-400">
                  The AI&apos;s row is its first replies. A person&apos;s row is the enquiries they
                  were first to contact, by typed message or a call marked done.
                </p>
              </div>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
