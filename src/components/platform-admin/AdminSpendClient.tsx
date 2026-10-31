"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { failureText } from "@/lib/api";
import {
  getAccountSpend,
  getAdminToken,
  listAccountSpend,
  listUsageRates,
  quantity,
  rupees,
  tokens,
  tokensFromThousands,
  type AccountSpend,
  type AccountSpendDetail,
  type SpendWindow,
  type UsageRate,
} from "@/lib/adminApi";
import AdminNav from "./AdminNav";
import AdminRateCard, { unpricedCount } from "./AdminRateCard";

const WINDOWS: SpendWindow[] = [7, 30, 90, "all"];

const TOKEN_UNIT = "1k_tokens";

function windowLabel(window: SpendWindow) {
  return window === "all" ? "All time" : `${window} days`;
}

function when(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * What every account costs us to serve.
 *
 * The list is every agency, dearest first, including the ones that cost nothing —
 * an account that has gone quiet is one of the more interesting rows here.
 * Clicking one opens every line behind its total.
 *
 * The rate card is on the same screen on purpose: the commonest reason a total
 * looks wrong is that a unit has no price, and the fix is three feet away rather
 * than in a deploy.
 */
export default function AdminSpendClient() {
  const router = useRouter();
  const [days, setDays] = useState<SpendWindow>(30);
  const [accounts, setAccounts] = useState<AccountSpend[]>([]);
  const [selected, setSelected] = useState<AccountSpendDetail | null>(null);
  // Kept only for the "n unset" badge on the toggle: the card itself owns the
  // rates it edits, and a second writable copy here is how the two would drift.
  const [rates, setRates] = useState<UsageRate[]>([]);
  const [showRates, setShowRates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAdminToken()) router.replace("/admin/login");
  }, [router]);

  const load = useCallback(async (window: SpendWindow) => {
    setLoading(true);
    setError("");
    try {
      const [rows, card] = await Promise.all([listAccountSpend(window), listUsageRates()]);
      setAccounts(rows);
      setRates(card);
    } catch (err) {
      setAccounts([]);
      setError(failureText(err, "Could not load account spend."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const open = async (organizationId: string) => {
    setError("");
    try {
      setSelected(await getAccountSpend(organizationId, days));
    } catch (err) {
      setError(failureText(err, "Could not load that account."));
    }
  };

  const unpriced = unpricedCount(rates);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Account spend
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            What each agency cost to serve{" "}
            {days === "all" ? "since it joined" : `over the last ${days} days`} — calls, AI
            text and WhatsApp, priced at what we pay our providers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
            {WINDOWS.map((window) => (
              <button
                key={window}
                type="button"
                onClick={() => {
                  setSelected(null);
                  setDays(window);
                }}
                className={
                  window === days
                    ? "rounded-md bg-brand-500 px-3 py-1 text-xs font-medium text-white"
                    : "rounded-md px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-300"
                }
              >
                {windowLabel(window)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowRates((value) => !value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
          >
            Rates{unpriced ? ` · ${unpriced} unset` : ""}
          </button>
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-error-500">{error}</p> : null}

      {showRates ? (
        // The same card the Rates page shows. Here because the commonest reason
        // a total looks wrong is a unit nobody has priced, and the fix should be
        // three feet away rather than in a deploy. Saving one re-reads the
        // spend, whose figures are computed from these numbers.
        <div className="mt-5">
          <AdminRateCard onSaved={() => void load(days)} />
        </div>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
                <th className="px-4 py-3 text-right font-medium">AI tokens</th>
                <th className="px-4 py-3 text-right font-medium">Customers</th>
                <th className="px-4 py-3 text-right font-medium">Per customer</th>
                <th className="px-4 py-3 text-right font-medium">Total cost</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((row) => (
                <tr
                  key={row.organization_id}
                  onClick={() => void open(row.organization_id)}
                  className="cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-white/[0.04]"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {row.organization_name || row.organization_id}
                    </p>
                    <p className="text-xs text-gray-500">
                      {row.lines.map((line) => line.label).join(" · ") || "No usage"}
                      {row.has_unpriced ? " · some usage not priced" : ""}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <p className="text-gray-700 dark:text-gray-200">
                      {(row.total_tokens ?? 0).toLocaleString("en-IN")}
                    </p>
                    {row.total_tokens ? (
                      <p className="text-xs text-gray-500">
                        in {(row.input_tokens ?? 0).toLocaleString("en-IN")} · out{" "}
                        {(row.output_tokens ?? 0).toLocaleString("en-IN")}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                    {row.customers.toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200">
                    {rupees(row.cost_per_customer)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-white">
                    {rupees(row.total)}
                  </td>
                </tr>
              ))}
              {accounts.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={5}>
                    No accounts yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {selected ? (
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selected.organization_name || selected.organization_id}
              </h2>
              <p className="mt-1 text-xs text-gray-500">
                {days === "all"
                  ? `All time, up to ${when(selected.period_end)}`
                  : `${when(selected.period_start)} — ${when(selected.period_end)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200"
            >
              Close
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Total cost", rupees(selected.total)],
              ["Customers", selected.customers.toLocaleString("en-IN")],
              ["New this period", selected.new_customers.toLocaleString("en-IN")],
              ["Per customer", rupees(selected.cost_per_customer)],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-100 p-3 dark:border-gray-800"
              >
                <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            {[
              ["AI tokens in", selected.input_tokens],
              ["AI tokens out", selected.output_tokens],
              ["AI tokens total", selected.total_tokens],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-gray-100 p-3 dark:border-gray-800"
              >
                <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
                  {Number(value ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
          </div>

          {selected.lines.length ? (
            <ul className="mt-4 space-y-2">
              {selected.lines.map((line) => (
                <li
                  key={line.kind}
                  className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-4 py-2.5 text-sm dark:border-gray-800"
                >
                  <span className="text-gray-700 dark:text-gray-200">
                    {line.label}
                    <span className="ml-2 text-xs text-gray-500">
                      {line.unit === TOKEN_UNIT
                        ? tokens(tokensFromThousands(line.quantity))
                        : `${quantity(line.quantity)} ${line.unit_label}`}{" "}
                      · {line.events} events
                      {Number(line.unpriced_quantity) > 0
                        ? ` · ${
                            line.unit === TOKEN_UNIT
                              ? tokens(tokensFromThousands(line.unpriced_quantity))
                              : quantity(line.unpriced_quantity)
                          } unpriced`
                        : ""}
                    </span>
                  </span>
                  <span className="font-medium text-gray-800 dark:text-white/90">
                    {rupees(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <h3 className="mt-5 text-sm font-semibold text-gray-800 dark:text-white/90">
            Every line of spend
          </h3>
          <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-gray-100 dark:border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-gray-50 text-gray-500 dark:bg-white/[0.04]">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">What</th>
                  <th className="px-3 py-2 font-medium">Source</th>
                  <th className="px-3 py-2 text-right font-medium">Used</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {selected.entries.map((entry, index) => (
                  <tr
                    key={`${entry.kind}-${entry.reference_id ?? index}-${index}`}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="whitespace-nowrap px-3 py-2 text-gray-500">
                      {when(entry.occurred_at)}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">{entry.key}</td>
                    <td className="px-3 py-2 text-gray-500">{entry.source || "—"}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-500">
                      {entry.unit === TOKEN_UNIT
                        ? tokens(tokensFromThousands(entry.quantity))
                        : `${quantity(entry.quantity)} ${entry.unit}`}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-500">
                      {rupees(entry.unit_rate, 4)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right text-gray-700 dark:text-gray-200">
                      {rupees(entry.amount, 4)}
                    </td>
                  </tr>
                ))}
                {selected.entries.length === 0 ? (
                  <tr>
                    <td className="px-3 py-4 text-gray-500" colSpan={6}>
                      Nothing in this period.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
