"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { failureText } from "@/lib/api";
import {
  getMySpend,
  kindTone,
  quantity,
  rupees,
  type AccountSpendDetail,
} from "@/lib/billing";

const WINDOWS: Array<{ days: number; label: string }> = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/**
 * What this account has used, and what it cost.
 *
 * Deliberately plain about two things. The total is only the usage that has a
 * price set — where one is missing the units are still shown and the card says
 * so, because a confident ₹0 is a worse answer than an honest gap. And the
 * customer count is contacts currently held, so an erasure reduces it.
 */
export default function AccountSpendCard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AccountSpendDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showLines, setShowLines] = useState(false);

  const load = useCallback(async (window: number) => {
    setLoading(true);
    setError("");
    try {
      setData(await getMySpend(window));
    } catch (err) {
      setData(null);
      setError(failureText(err, "Could not load your usage."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const lines = data?.lines ?? [];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Usage and cost
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            What your account has used over the last {days} days — AI calls, AI text and
            WhatsApp messages.
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
          {WINDOWS.map((window) => (
            <button
              key={window.days}
              type="button"
              onClick={() => setDays(window.days)}
              className={
                window.days === days
                  ? "rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]"
              }
            >
              {window.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {loading && !data ? <p className="mt-4 text-sm text-gray-500">Loading…</p> : null}

      {data ? (
        <>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <p className="text-xs uppercase tracking-wide text-gray-500">Total cost</p>
              <p className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">
                {rupees(data.total)}
              </p>
              {data.has_unpriced ? (
                <p className="mt-1 text-xs text-warning-600 dark:text-warning-500">
                  Some usage is not priced yet — see below
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <p className="text-xs uppercase tracking-wide text-gray-500">Customers</p>
              <p className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">
                {data.customers.toLocaleString("en-IN")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {data.new_customers} added in this period
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
              <p className="text-xs uppercase tracking-wide text-gray-500">Per customer</p>
              <p className="mt-1 text-2xl font-semibold text-gray-800 dark:text-white/90">
                {rupees(data.cost_per_customer)}
              </p>
              <p className="mt-1 text-xs text-gray-500">Across every customer you hold</p>
            </div>
          </div>

          {lines.length === 0 ? (
            <p className="mt-5 text-sm text-gray-500">
              No usage recorded in this period.
            </p>
          ) : (
            <ul className="mt-5 space-y-2">
              {lines.map((line) => (
                <li
                  key={line.kind}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-3 dark:border-gray-800"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
                      {line.label}
                      <Badge color={kindTone(line.kind)}>{line.events}</Badge>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {quantity(line.quantity)} {line.unit_label}
                      {Number(line.unpriced_quantity) > 0
                        ? ` · ${quantity(line.unpriced_quantity)} not priced yet`
                        : ""}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-gray-800 dark:text-white/90">
                    {rupees(line.amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {data.entries.length > 0 ? (
            <>
              <button
                type="button"
                onClick={() => setShowLines((value) => !value)}
                className="mt-4 text-sm font-medium text-brand-500 hover:text-brand-600"
              >
                {showLines ? "Hide the detail" : `Show the last ${data.entries.length} items`}
              </button>
              {showLines ? (
                <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-white/[0.04]">
                      <tr>
                        <th className="px-3 py-2 font-medium">When</th>
                        <th className="px-3 py-2 font-medium">What</th>
                        <th className="px-3 py-2 text-right font-medium">Used</th>
                        <th className="px-3 py-2 text-right font-medium">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.entries.map((entry, index) => (
                        <tr
                          key={`${entry.kind}-${entry.reference_id ?? index}-${index}`}
                          className="border-t border-gray-100 dark:border-gray-800"
                        >
                          <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                            {entry.occurred_at
                              ? new Date(entry.occurred_at).toLocaleString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                            {entry.key}
                            {entry.source ? (
                              <span className="text-gray-400"> · {entry.source}</span>
                            ) : null}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-500">
                            {quantity(entry.quantity)} {entry.unit}
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700 dark:text-gray-200">
                            {rupees(entry.amount, 4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </>
          ) : null}

          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Costs are what the platform paid its providers for work done on your account.
            Anything without a price set is counted but not costed.
          </p>
        </>
      ) : null}
    </section>
  );
}
