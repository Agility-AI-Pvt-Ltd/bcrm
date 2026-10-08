"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  addSpend,
  defaultRange,
  getKnownSources,
  getSourcePerformance,
  listSpend,
  money,
  monthBounds,
  removeSpend,
  type SourcePerformance,
  type SourceRow,
  type Spend,
} from "@/lib/reporting";
import GoLiveChecklist from "./GoLiveChecklist";

const input =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

/**
 * Cost per site visit and per booking, by lead source.
 *
 * Two rules hold this page together. A cost is never shown as ₹0 when the real answer
 * is "we don't know" — it is blank, with the reason underneath. And cost per visit
 * counts visits that actually happened, because a booked no-show costs the same money
 * and buys nothing; counting it would flatter exactly the portals that waste the most
 * time.
 */
export default function SourcePerformancePage() {
  const [range, setRange] = useState(defaultRange);
  const [report, setReport] = useState<SourcePerformance | null>(null);
  const [spend, setSpend] = useState<Spend[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [form, setForm] = useState(() => {
    const month = monthBounds(defaultRange().end);
    return { source: "", amount: "", period_start: month.start, period_end: month.end };
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [performance, entries, known] = await Promise.all([
        getSourcePerformance(range.start, range.end),
        listSpend(),
        getKnownSources(),
      ]);
      setReport(performance);
      setSpend(entries);
      setSources(known);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load the report."));
    }
  }, [range.start, range.end]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const onAddSpend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await addSpend({
        source: form.source.trim(),
        amount: form.amount.trim(),
        period_start: form.period_start,
        period_end: form.period_end,
      });
      setNotice(`${form.source.trim()} spend saved.`);
      setForm((current) => ({ ...current, source: "", amount: "" }));
      void load();
    } catch (err) {
      setError(failureText(err, "Could not save that spend."));
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (entry: Spend) => {
    try {
      await removeSpend(entry.id);
      void load();
    } catch (err) {
      setError(failureText(err, "Could not remove that entry."));
    }
  };

  const cell = (value: string | null, note: string) =>
    value ? (
      <span className="text-gray-800 dark:text-white/90">{money(value)}</span>
    ) : (
      // Never ₹0: that reads as free, and the real answer is that we cannot say.
      <span className="text-xs text-gray-400" title={note}>
        —
      </span>
    );

  const rows: SourceRow[] = report?.rows ?? [];

  return (
    <div className="space-y-5">
      <GoLiveChecklist compact />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Cost per visit and per booking
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              What each channel actually bought you. Cost per visit counts the visits
              that happened — a booked no-show costs the same and buys nothing.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1.5 block text-gray-500">From</span>
              <input
                type="date"
                value={range.start}
                onChange={(event) =>
                  setRange((current) => ({ ...current, start: event.target.value }))
                }
                className={`${input} w-40`}
              />
            </label>
            <label className="text-sm">
              <span className="mb-1.5 block text-gray-500">To</span>
              <input
                type="date"
                value={range.end}
                onChange={(event) =>
                  setRange((current) => ({ ...current, end: event.target.value }))
                }
                className={`${input} w-40`}
              />
            </label>
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

        {report ? (
          <>
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              {report.period.label} · {report.period.days} days
            </p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[62rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    <th className="py-2 pr-4 font-medium">Source</th>
                    <th className="py-2 pr-4 font-medium">Spend</th>
                    <th className="py-2 pr-4 font-medium">Leads</th>
                    <th className="py-2 pr-4 font-medium">Visits done</th>
                    <th className="py-2 pr-4 font-medium">Bookings</th>
                    <th className="py-2 pr-4 font-medium">Per lead</th>
                    <th className="py-2 pr-4 font-medium">Per visit</th>
                    <th className="py-2 pr-4 font-medium">Per booking</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.source}
                      className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                    >
                      <td className="py-2.5 pr-4">
                        <span className="text-gray-800 dark:text-white/90">{row.source}</span>
                        {row.notes.map((note) => (
                          <span
                            key={note}
                            className="mt-0.5 block text-xs text-warning-600"
                          >
                            {note}
                          </span>
                        ))}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {row.spend ? money(row.spend) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {row.leads}
                        {row.contacted < row.leads ? (
                          <span className="ml-1 text-xs text-gray-400">
                            ({row.contacted} contacted)
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {row.visits_done}
                        {row.visits_booked > row.visits_done ? (
                          <span className="ml-1 text-xs text-warning-600">
                            of {row.visits_booked} booked
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                        {row.bookings}
                      </td>
                      <td className="py-2.5 pr-4">
                        {cell(row.cost_per_lead, "No spend or no leads recorded")}
                      </td>
                      <td className="py-2.5 pr-4">
                        {cell(row.cost_per_visit, "No spend or no completed visits")}
                      </td>
                      <td className="py-2.5 pr-4">
                        {cell(row.cost_per_booking, "No spend or no bookings yet")}
                      </td>
                    </tr>
                  ))}
                  {rows.length ? (
                    <tr className="font-medium">
                      <td className="py-2.5 pr-4 text-gray-800 dark:text-white/90">
                        {report.totals.source}
                        {report.totals.notes.map((note) => (
                          <span key={note} className="mt-0.5 block text-xs font-normal text-warning-600">
                            {note}
                          </span>
                        ))}
                      </td>
                      <td className="py-2.5 pr-4">{report.totals.spend ? money(report.totals.spend) : "—"}</td>
                      <td className="py-2.5 pr-4">{report.totals.leads}</td>
                      <td className="py-2.5 pr-4">{report.totals.visits_done}</td>
                      <td className="py-2.5 pr-4">{report.totals.bookings}</td>
                      <td className="py-2.5 pr-4">{cell(report.totals.cost_per_lead, "")}</td>
                      <td className="py-2.5 pr-4">{cell(report.totals.cost_per_visit, "")}</td>
                      <td className="py-2.5 pr-4">{cell(report.totals.cost_per_booking, "")}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            {!rows.length ? (
              <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                Nothing in this range yet. Record what you spent below, and the costs
                appear as leads and visits come in.
              </p>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          What you spent
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Enter each portal&apos;s invoice for the month. A monthly figure read over a
          shorter report is apportioned by the days they share, and entering the same
          month twice corrects it rather than doubling it.
        </p>

        <form onSubmit={onAddSpend} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1.5 block text-gray-500">Source</span>
            <input
              list="known-sources"
              value={form.source}
              onChange={(event) =>
                setForm((current) => ({ ...current, source: event.target.value }))
              }
              placeholder="99acres"
              className={`${input} w-44`}
            />
            <datalist id="known-sources">
              {sources.map((source) => (
                <option key={source} value={source} />
              ))}
            </datalist>
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-gray-500">Amount ₹</span>
            <input
              value={form.amount}
              onChange={(event) =>
                setForm((current) => ({ ...current, amount: event.target.value }))
              }
              inputMode="decimal"
              placeholder="30000"
              className={`${input} w-32`}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-gray-500">From</span>
            <input
              type="date"
              value={form.period_start}
              onChange={(event) =>
                setForm((current) => ({ ...current, period_start: event.target.value }))
              }
              className={`${input} w-40`}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1.5 block text-gray-500">To</span>
            <input
              type="date"
              value={form.period_end}
              onChange={(event) =>
                setForm((current) => ({ ...current, period_end: event.target.value }))
              }
              className={`${input} w-40`}
            />
          </label>
          <button
            type="submit"
            disabled={saving || !form.source.trim() || !form.amount.trim()}
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save spend"}
          </button>
        </form>

        {spend.length ? (
          <ul className="mt-4 space-y-2">
            {spend.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm dark:border-gray-800"
              >
                <span className="text-gray-800 dark:text-white/90">{entry.source}</span>
                <span className="text-gray-600 dark:text-gray-300">
                  {money(entry.amount)}
                </span>
                <span className="text-xs text-gray-500">
                  {entry.period_start} → {entry.period_end}
                </span>
                <button
                  type="button"
                  onClick={() => void onRemove(entry)}
                  className="text-xs text-gray-500 underline underline-offset-2"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            No spend recorded yet. Without it the table can count leads and visits but
            cannot cost them.
          </p>
        )}
      </section>
    </div>
  );
}
