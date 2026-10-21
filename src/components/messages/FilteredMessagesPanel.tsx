"use client";

/**
 * "Not answered by the AI" — the review list for the inbound filter.
 *
 * The filter keeps the assistant from replying to auto-replies, advertisements,
 * OTPs and official notices, and keeps them off the Leads page. It errs toward
 * answering, but an error the other way is a buyer nobody replied to, so every
 * held message is listed here with the reason, and one click hands it to the
 * AI. Collapsed to a single line until someone wants to look.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  dismissFilteredMessage,
  listFilteredMessages,
  releaseFilteredMessage,
  type FilteredMessage,
} from "@/lib/filteredMessages";
import { formatSince } from "@/lib/outreach";

const CATEGORY_TONE: Record<string, string> = {
  automated: "bg-blue-light-50 text-blue-light-700 dark:bg-blue-light-500/15 dark:text-blue-light-400",
  promotional: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  official: "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-200",
  system: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
  repeated: "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
};

export default function FilteredMessagesPanel({
  onReleased,
}: {
  /** Refresh the conversation list: a released message becomes a thread. */
  onReleased?: () => void;
}) {
  const [items, setItems] = useState<FilteredMessage[]>([]);
  const [held, setHeld] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const page = await listFilteredMessages("held");
      setItems(page.items);
      setHeld(page.held);
    } catch {
      // Silent on purpose. This panel is a side note on the Messages page, not
      // the page itself: if the list cannot be read — a backend that does not
      // have the filter yet answers 404 — the panel simply does not appear,
      // rather than putting an error above every conversation.
      setItems([]);
      setHeld(0);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (row: FilteredMessage, action: "release" | "dismiss") => {
    setBusy(row.id);
    setNotice("");
    try {
      if (action === "release") {
        await releaseFilteredMessage(row.id);
        setNotice(
          `Sent to the AI. ${row.sender_name || row.sender_phone} will be answered from now on.`,
        );
        onReleased?.();
      } else {
        await dismissFilteredMessage(row.id);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That did not work — try again.");
    } finally {
      setBusy("");
    }
  };

  // Only when something is actually waiting for review. "0 messages not
  // answered" is not news, and the release confirmation is not worth a panel of
  // its own once the list is empty.
  if (!held) {
    return null;
  }

  return (
    <section className="mb-5 rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center justify-between gap-2 px-5 py-3 text-left"
      >
        <span>
          <span className="text-sm font-medium text-gray-800 dark:text-white/90">
            {held} message{held === 1 ? "" : "s"} not answered by the AI
          </span>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
            Auto-replies, ads, OTPs and official notices are held here instead of being answered or
            counted as leads.
          </span>
        </span>
        <span className="text-xs font-medium text-brand-500">{open ? "Hide" : "Review"}</span>
      </button>

      {notice ? <p className="px-5 pb-2 text-xs text-success-600">{notice}</p> : null}
      {error ? <p className="px-5 pb-2 text-xs text-error-500">{error}</p> : null}

      {open ? (
        <ul className="divide-y divide-gray-100 border-t border-gray-100 dark:divide-gray-800 dark:border-gray-800">
          {items.length === 0 ? (
            <li className="px-5 py-6 text-center text-sm text-gray-500">Nothing waiting for review.</li>
          ) : (
            items.map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-1 gap-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        CATEGORY_TONE[row.category] ?? CATEGORY_TONE.system
                      }`}
                    >
                      {row.category_label}
                    </span>
                    <span className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {row.sender_name || row.sender_phone}
                    </span>
                    {row.sender_name ? (
                      <span className="text-xs text-gray-500">{row.sender_phone}</span>
                    ) : null}
                    <span className="text-xs text-gray-400">{formatSince(row.created_at)}</span>
                  </div>
                  {row.text ? (
                    <p
                      className="mt-1 line-clamp-2 text-sm text-gray-700 dark:text-gray-300"
                      title={row.text}
                    >
                      {row.text}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-gray-400">Why: {row.reason}</p>
                </div>
                <div className="flex gap-2 sm:justify-end">
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void act(row, "release")}
                    title="This is a real customer — let the AI answer, and trust this number from now on"
                    className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    It&apos;s a customer — answer
                  </button>
                  <button
                    type="button"
                    disabled={busy === row.id}
                    onClick={() => void act(row, "dismiss")}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    Dismiss
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </section>
  );
}
