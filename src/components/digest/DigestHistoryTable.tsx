"use client";

import { useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  formatDigestDate,
  formatSentAt,
  getDigestHistory,
  reasonLabel,
  STATUS_CHIP,
  type DigestSend,
} from "@/lib/digest";

type Props = { refreshKey?: number };

/**
 * What actually went out, to which number, and what WhatsApp said about it.
 *
 * A row exists for every attempt, including the skipped ones — "why didn't I get a
 * digest this morning?" is the question this table is here to answer.
 */
export default function DigestHistoryTable({ refreshKey = 0 }: Props) {
  const [rows, setRows] = useState<DigestSend[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setRows(await getDigestHistory(20));
    } catch (err) {
      setError(failureText(err, "Could not load the send log."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Send log</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        One row per person per day — a digest is never sent twice for the same morning.
      </p>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : rows.length ? (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Morning</th>
                <th className="py-2 pr-4 font-medium">Number</th>
                <th className="py-2 pr-4 font-medium">Status</th>
                <th className="py-2 pr-4 font-medium">Leads</th>
                <th className="py-2 pr-4 font-medium">Sent</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                >
                  <td className="py-2.5 pr-4 text-gray-800 dark:text-white/90">
                    {formatDigestDate(row.digest_date)}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">{row.phone}</td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_CHIP[row.status] || STATUS_CHIP.skipped
                      }`}
                    >
                      {row.status}
                    </span>
                    {row.reason ? (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {reasonLabel(row.reason)}
                      </span>
                    ) : null}
                    {row.status === "sent" && !row.used_template ? (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        sent as plain text
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {row.counts ? row.counts.new_leads : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                    {formatSentAt(row.sent_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Nothing sent yet. Save your number and use “Send to me now” to see it end to end.
        </p>
      )}
    </section>
  );
}
