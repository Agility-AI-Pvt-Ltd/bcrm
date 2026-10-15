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
  setUsageRate,
  type AccountSpend,
  type AccountSpendDetail,
  type UsageRate,
} from "@/lib/adminApi";

const WINDOWS = [7, 30, 90];

/**
 * The rate screen in the order an operator reconciles their invoices: the phone
 * bill, the Sarvam bill, the model bill, then WhatsApp. Grouping matters here
 * because the keys alone ("stt_minute") do not say which invoice they came from.
 */
const GROUPS: Array<{ kind: string; title: string; blurb: string }> = [
  {
    kind: "call",
    title: "AI calls — telephony",
    blurb:
      "What the phone provider charges per connected minute. Telephony only; the AI running during the call is priced below.",
  },
  {
    kind: "sarvam",
    title: "Sarvam voice",
    blurb:
      "Speech-to-text and text-to-speech during a call, both per connected minute — the only quantity the voice agent reports back.",
  },
  {
    kind: "llm",
    title: "AI text — per thousand tokens",
    blurb:
      "Input and output are priced separately, per model. Covers text the CRM generates; the model running inside a call is not metered per token.",
  },
  {
    kind: "whatsapp",
    title: "WhatsApp — per message",
    blurb: "Meta's price per conversation category.",
  },
  { kind: "storage", title: "Storage", blurb: "Per GB-month of stored media." },
];

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
  const [days, setDays] = useState(30);
  const [accounts, setAccounts] = useState<AccountSpend[]>([]);
  const [selected, setSelected] = useState<AccountSpendDetail | null>(null);
  const [rates, setRates] = useState<UsageRate[]>([]);
  const [showRates, setShowRates] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");

  useEffect(() => {
    if (!getAdminToken()) router.replace("/admin/login");
  }, [router]);

  const load = useCallback(async (window: number) => {
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

  const price = async (rate: UsageRate, amount: string) => {
    setSaving(`${rate.kind}:${rate.key}`);
    setError("");
    try {
      const saved = await setUsageRate({
        kind: rate.kind,
        key: rate.key,
        unit: rate.unit,
        amount: amount.trim() === "" ? null : amount.trim(),
      });
      setRates((current) =>
        current.map((row) =>
          row.kind === saved.kind && row.key === saved.key ? saved : row,
        ),
      );
      await load(days);
    } catch (err) {
      setError(failureText(err, "Could not save that rate."));
    } finally {
      setSaving("");
    }
  };

  const unpriced = rates.filter((rate) => rate.amount === null).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
            Account spend
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            What each agency cost to serve over the last {days} days — calls, AI text and
            WhatsApp, priced at what we pay our providers.
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
                {window} days
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
        <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            What a unit costs
          </h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Set these from your own provider invoices. A price applies to usage from
            today onwards — anything already metered keeps the rate it was costed at,
            so last month&apos;s figures never move. Leave a box empty to record a unit
            as deliberately unpriced: its usage is still counted and reported as
            unpriced, never as free.
          </p>
          {GROUPS.map((group) => {
            const rows = rates.filter((rate) => rate.kind === group.kind);
            if (rows.length === 0) return null;
            return (
              <div key={group.kind} className="mt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                  {group.title}
                </h3>
                <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                  {group.blurb}
                </p>
                <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
                  {rows.map((rate) => (
                    <li
                      key={`${rate.kind}:${rate.key}`}
                      className="flex flex-wrap items-start justify-between gap-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 dark:text-white/90">
                          {rate.key}
                          <span className="ml-2 text-xs font-normal text-gray-500">
                            per {rate.unit_label}
                          </span>
                        </p>
                        {rate.help ? (
                          <p className="mt-0.5 max-w-xl text-xs text-gray-500 dark:text-gray-400">
                            {rate.help}
                          </p>
                        ) : null}
                        <p className="mt-0.5 text-xs text-gray-400">
                          {rate.effective_from
                            ? `In force from ${rate.effective_from}`
                            : "Not priced yet"}
                        </p>
                      </div>
                      <RateInput
                        key={`${rate.kind}:${rate.key}:${rate.amount ?? ""}`}
                        rate={rate}
                        busy={saving === `${rate.kind}:${rate.key}`}
                        onSave={(amount) => void price(rate, amount)}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-white/[0.04]">
              <tr>
                <th className="px-4 py-3 font-medium">Account</th>
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
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={4}>
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
                {when(selected.period_start)} — {when(selected.period_end)}
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
                      {quantity(line.quantity)} {line.unit_label} · {line.events} events
                      {Number(line.unpriced_quantity) > 0
                        ? ` · ${quantity(line.unpriced_quantity)} unpriced`
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
                      {quantity(entry.quantity)} {entry.unit}
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

function RateInput({
  rate,
  busy,
  onSave,
}: {
  rate: UsageRate;
  busy: boolean;
  onSave: (amount: string) => void;
}) {
  // Seeded once, from the rate this input was mounted for. The parent remounts it
  // on a new amount by including that amount in the key, which is why there is no
  // effect here syncing props into state — that pattern costs a cascading render
  // and gets the two out of step the moment a save is in flight.
  const [value, setValue] = useState(rate.amount ?? "");

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="decimal"
        placeholder="not set"
        className="h-9 w-28 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
      />
      <button
        type="button"
        disabled={busy || value === (rate.amount ?? "")}
        onClick={() => onSave(value)}
        className="h-9 rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40"
      >
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}
