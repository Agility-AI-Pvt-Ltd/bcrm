"use client";

/**
 * The AI's office shift: what is outstanding, what the next shift will do, and a
 * button to make it happen now.
 *
 * Two things this card exists to make visible. First, `scheduled: false` from the
 * schedule endpoint is not a failure — Temporal is optional, and the work stays
 * queued in Postgres either way, so the copy says "run it by hand" rather than
 * showing an error. Second, the plan is computed by the backend from the counts,
 * so an operator can see *why* the AI is about to do something.
 *
 * Success and failure are separate pieces of state on purpose. They used to share
 * one `message`, which meant a 500 from the snapshot endpoint was rendered in the
 * same grey note as "the shift ran fine" — and because a failed load leaves
 * `counts` empty, the card also showed a green "Nothing waiting" badge next to it.
 * An unread queue is not an empty queue, and this card must never claim otherwise.
 *
 * The same rule is why `uncampaigned_rows` gets a panel of its own rather than a
 * tile. Uploaded contacts with no campaign behind them are real outstanding work,
 * but no shift can clear them — only creating a campaign can. Counting them as a
 * waiting task is exactly the lie this card told for weeks: "1 task waiting",
 * followed by a shift that sent nothing and reported no error.
 */

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { failureText } from "@/lib/api";
import {
  getOfficeSnapshot,
  runOfficeShift,
  scheduleOfficeShift,
  OFFICE_COUNT_LABELS,
  OFFICE_TASK_LABELS,
  type OfficeShiftResult,
  type OfficeSnapshot,
} from "@/lib/outreach";

type Props = {
  /** Called after a shift runs, so the parent can reload campaigns or leads. */
  onWorkDone?: () => void;
};

export default function OfficeShiftCard({ onWorkDone }: Props) {
  const [snapshot, setSnapshot] = useState<OfficeSnapshot | null>(null);
  const [result, setResult] = useState<OfficeShiftResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [notice, setNotice] = useState("");
  const [failure, setFailure] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSnapshot(await getOfficeSnapshot());
      setFailure("");
    } catch (error) {
      // Drop the stale snapshot rather than keeping numbers we can no longer
      // vouch for: the card reads "unavailable" instead of quietly going stale.
      setSnapshot(null);
      setFailure(failureText(error, "Could not read the work queue."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runNow = async () => {
    setRunning(true);
    setResult(null);
    // Clear last time's outcome before this one: a note from the previous shift
    // sitting under a fresh failure would read as if both had just happened.
    setNotice("");
    try {
      const shift = await runOfficeShift();
      setResult(shift);
      setNotice(shift.summary);
      setFailure("");
      await load();
      onWorkDone?.();
    } catch (error) {
      setFailure(failureText(error, "The shift could not run."));
    } finally {
      setRunning(false);
    }
  };

  const schedule = async () => {
    setScheduling(true);
    setNotice("");
    try {
      const outcome = await scheduleOfficeShift();
      setNotice(outcome.message);
    } catch (error) {
      setFailure(failureText(error, "Could not register the schedule."));
    } finally {
      setScheduling(false);
    }
  };

  const counts = snapshot?.counts ?? {};
  const plan = snapshot?.plan ?? [];
  /** Uploaded contacts no campaign is sending to. Shown as a panel, not a tile. */
  const uncampaigned = counts.uncampaigned_rows ?? 0;
  const outstanding = Object.entries(counts).filter(
    ([key, value]) => value > 0 && key !== "uncampaigned_rows",
  );
  /** The queue could not be read, so nothing below it is known. */
  const unread = !loading && snapshot === null;

  // Three honest readings, in the order that matters to whoever is looking.
  const status = unread
    ? { color: "error" as const, text: "Queue unavailable" }
    : plan.length
      ? { color: "warning" as const, text: `${plan.length} task(s) waiting` }
      : uncampaigned
        ? { color: "info" as const, text: "Needs a campaign" }
        : { color: "success" as const, text: "Nothing waiting" };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-brand-500">
            Works like a person in an office
          </p>
          <h2 className="mt-1 font-semibold text-gray-900 dark:text-white/90">
            AI shift, every 6 hours
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            It looks at what is outstanding, decides an order, and does the work.
          </p>
        </div>
        <Badge color={status.color} size="sm">
          {status.text}
        </Badge>
      </div>

      {loading ? (
        <p className="py-6 text-center text-sm text-gray-500">Reading the queue…</p>
      ) : unread ? (
        <div className="rounded-xl border border-error-500/40 bg-error-50 px-4 py-5 text-center dark:border-error-500/30 dark:bg-error-500/10">
          <p className="text-sm font-medium text-error-600 dark:text-error-400">
            The work queue could not be read
          </p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {failure} Nothing has been lost — the work stays queued, and a shift can
            still be run by hand.
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          {outstanding.length === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700">
              Nothing outstanding. Upload a contact list to give the AI work.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {outstanding.map(([key, value]) => (
                <div
                  key={key}
                  className="rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700"
                >
                  <p className="text-lg font-semibold text-gray-800 dark:text-white/90">
                    {value}
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {OFFICE_COUNT_LABELS[key] || key.replace(/_/g, " ")}
                  </p>
                </div>
              ))}
            </div>
          )}

          {uncampaigned > 0 && (
            <div className="mt-3 rounded-xl border border-warning-500/40 bg-warning-50 px-4 py-3 dark:border-warning-500/30 dark:bg-warning-500/10">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {uncampaigned} uploaded contact{uncampaigned === 1 ? " is" : "s are"} in
                no campaign
              </p>
              <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                A shift will not reach these. The AI sends through a campaign, so use
                steps 1 to 3 above — pick the list, write the message, start it — and
                the first messages go out on the next shift.
              </p>
            </div>
          )}

          {plan.length > 0 && (
            <ol className="mt-4 space-y-2">
              {plan.map((task, index) => (
                <li
                  key={task}
                  className="flex items-start gap-3 rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-white/[0.03]"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="text-gray-700 dark:text-gray-300">
                    {OFFICE_TASK_LABELS[task] || task}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running}
          onClick={() => void runNow()}
          className="inline-flex flex-1 items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {running ? "Working…" : "Run a shift now"}
        </button>
        <button
          type="button"
          disabled={scheduling}
          onClick={() => void schedule()}
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          {scheduling ? "Registering…" : "Keep it on schedule"}
        </button>
      </div>

      {result && (
        <div className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {result.summary}
          </p>
          <ul className="mt-3 space-y-2">
            {result.results.map((item) => (
              <li key={item.task} className="flex items-start justify-between gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  {OFFICE_TASK_LABELS[item.task] || item.task}
                </span>
                {item.error ? (
                  <Badge color="error" size="sm">
                    failed
                  </Badge>
                ) : (
                  <Badge color="success" size="sm">
                    {item.handled ?? 0} handled
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          {result.results.some((item) => item.error) && (
            <p className="mt-3 text-xs text-error-500">
              A task that fails is reported and skipped — the rest of the shift still
              runs, and the work stays queued for next time.
            </p>
          )}
        </div>
      )}

      {/* When the queue is unread its own panel above already carries `failure`,
          so showing it twice would just read as two separate problems. */}
      {failure && !unread && (
        <p className="mt-4 rounded-lg bg-error-50 px-3 py-2 text-xs text-error-600 dark:bg-error-500/10 dark:text-error-400">
          {failure}
        </p>
      )}

      {notice && (
        <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
          {notice}
        </p>
      )}
    </section>
  );
}
