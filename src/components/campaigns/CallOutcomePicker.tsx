"use client";

/**
 * "Log call": what happened when you phoned this lead.
 *
 * Replaces the old "Mark called", which took a lead off the call list whether or
 * not they picked up. Pick an outcome, optionally add a note (and a time for a
 * call-back), then Save. Each outcome says on hover what it will do.
 */

import { useState } from "react";
import { CALL_OUTCOMES, type CallOutcome, type LastCall, type Lead } from "@/lib/outreach";

export type CallLogInput = {
  outcome: CallOutcome;
  note: string | null;
  call_back_at: string | null;
};

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** A Date as the value a datetime-local input wants, in the browser's own time. */
function toLocalInput(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** One-tap call-back times. "This evening" only while it is still ahead. */
function quickTimes(now: Date): Array<{ label: string; at: Date }> {
  const inHour = new Date(now.getTime() + 60 * 60 * 1000);
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(11, 0, 0, 0);
  const options = [{ label: "In 1 hour", at: inHour }];
  if (evening.getTime() - now.getTime() > 30 * 60 * 1000) {
    options.push({ label: "This evening 6 PM", at: evening });
  }
  options.push({ label: "Tomorrow 11 AM", at: tomorrow });
  return options;
}

export function formatCallBack(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function CallOutcomePicker({
  lead,
  busy,
  urgent,
  onLog,
}: {
  lead: Lead;
  busy: boolean;
  /** On the call list now: the button is shown in amber. */
  urgent: boolean;
  onLog: (lead: Lead, input: CallLogInput) => Promise<boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");

  const reset = () => {
    setOpen(false);
    setOutcome(null);
    setNote("");
    setWhen("");
  };

  if (!open) {
    return (
      <button
        type="button"
        disabled={busy}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        title="Record what happened when you phoned them"
        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          urgent
            ? "border-amber-300 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
            : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        }`}
      >
        {busy ? "Saving…" : "Log call"}
      </button>
    );
  }

  const needsTime = outcome === "call_back";
  const canSave = outcome !== null && (!needsTime || when !== "");

  return (
    <div
      className="flex w-60 flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-sm dark:border-gray-700 dark:bg-gray-900"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="text-xs font-medium text-gray-700 dark:text-gray-200">How did the call go?</p>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Call outcome">
        {CALL_OUTCOMES.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={outcome === option.value}
            title={option.effect}
            onClick={() => setOutcome(option.value)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              outcome === option.value
                ? "border-brand-500 bg-brand-500 text-white"
                : "border-gray-300 text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {outcome ? (
        <p className="text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          {CALL_OUTCOMES.find((option) => option.value === outcome)?.effect}
        </p>
      ) : null}
      {needsTime ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {quickTimes(new Date()).map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setWhen(toLocalInput(option.at))}
                className={`rounded-md border px-2 py-0.5 text-[11px] ${
                  when === toLocalInput(option.at)
                    ? "border-brand-500 text-brand-600"
                    : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <input
            type="datetime-local"
            aria-label="Call back at"
            value={when}
            min={toLocalInput(new Date())}
            onChange={(event) => setWhen(event.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
          />
        </div>
      ) : null}
      <input
        type="text"
        value={note}
        maxLength={1000}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Note (optional), e.g. wants 2 BHK near metro"
        className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!canSave || busy}
          onClick={async () => {
            if (!outcome) return;
            const saved = await onLog(lead, {
              outcome,
              note: note.trim() || null,
              // The browser's local time, sent with its offset so the server
              // stores the moment the agent meant.
              call_back_at: needsTime && when ? new Date(when).toISOString() : null,
            });
            if (saved) reset();
          }}
          className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          onClick={reset}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** "Didn't pick up ×2 · 2 h ago · Priya", or the planned call-back. */
export function LastCallLine({
  call,
  since,
}: {
  call: LastCall | null | undefined;
  since: (iso: string | null) => string;
}) {
  if (!call) return null;
  if (call.call_back_at) {
    return (
      <p className="mt-1 text-[11px] font-medium text-brand-600 dark:text-brand-400" title={call.note ?? undefined}>
        Call back {formatCallBack(call.call_back_at)}
      </p>
    );
  }
  const tries = call.outcome === "not_picked" && call.attempts > 1 ? ` ×${call.attempts}` : "";
  const parts = [`${call.label}${tries}`, call.at ? since(call.at) : null, call.by].filter(Boolean);
  return (
    <p className="mt-1 max-w-[16rem] truncate text-[11px] text-gray-500 dark:text-gray-400" title={call.note ?? undefined}>
      Last call: {parts.join(" · ")}
      {call.note ? ` · “${call.note}”` : ""}
    </p>
  );
}
