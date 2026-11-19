"use client";

/**
 * Failed WhatsApp replies, at the top of the Notifications page where the
 * "did not get a reply" bell lands. Hidden when there are none.
 *
 * Retry is two steps when the reply may already have reached the customer:
 * WhatsApp cannot tell us whether a cut-off send arrived, so the first press
 * shows the warning and only "Send again anyway" resends.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  listFailedReplies,
  markFailedReplyHandled,
  retryFailedReply,
  type FailedReply,
} from "@/lib/failedReplies";
import { relativeTime } from "@/lib/notifications";

export default function FailedRepliesCard() {
  const [items, setItems] = useState<FailedReply[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const page = await listFailedReplies();
      setItems(page.items);
      setTotal(page.total);
    } catch {
      // The rest of the page still works; this panel just stays hidden.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (item: FailedReply, action: "retry" | "confirm" | "handled") => {
    if (action === "retry" && item.may_have_sent) {
      setConfirming(item.id);
      return;
    }
    setBusy(item.id);
    setError("");
    try {
      if (action === "handled") {
        await markFailedReplyHandled(item.id);
        setNotice("Marked as handled. Nothing was sent.");
      } else {
        await retryFailedReply(item.id, action === "confirm");
        setNotice("Queued again. The reply goes out in a moment.");
      }
      setConfirming("");
      await load();
    } catch (err) {
      setError(failureText(err, "Could not update that reply."));
    } finally {
      setBusy("");
    }
  };

  if (items.length === 0 && !notice) return null;

  return (
    <section
      id="failed-replies"
      className="mb-6 rounded-2xl border border-error-200 bg-white p-5 dark:border-error-500/30 dark:bg-white/[0.03] lg:p-6"
    >
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Failed replies {total > 0 ? `(${total})` : ""}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        These customers got an apology instead of an answer, or the answer was cut off on its
        way out. Retry, or mark handled if you replied yourself.
      </p>
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}
      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
        {items.map((item) => (
          <li key={item.id} className="py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {item.customer_name || item.customer_phone || "A customer"}{" "}
                  <span className="text-xs font-normal text-gray-400">
                    · {relativeTime(item.failed_at)}
                  </span>
                </p>
                {item.message_text ? (
                  <p className="mt-0.5 truncate text-sm italic text-gray-600 dark:text-gray-300">
                    “{item.message_text}”
                  </p>
                ) : null}
                <p className="mt-0.5 text-xs text-gray-500">{item.reason}</p>
                {item.may_have_sent ? (
                  <p className="mt-1 text-xs font-medium text-warning-600">
                    May already have reached the customer.
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Link
                  href={`/messages?conversation=${item.conversation_id}`}
                  className="text-xs font-medium text-brand-500 hover:text-brand-600"
                >
                  Open chat
                </Link>
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => void act(item, "handled")}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  Mark handled
                </button>
                <button
                  type="button"
                  disabled={busy === item.id}
                  onClick={() => void act(item, "retry")}
                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {busy === item.id ? "Working…" : "Retry"}
                </button>
              </div>
            </div>
            {confirming === item.id ? (
              <div className="mt-3 rounded-xl bg-warning-50 p-3 text-sm text-warning-800 dark:bg-warning-500/15 dark:text-warning-400">
                <p>
                  This reply may already have reached the customer. WhatsApp cannot tell us
                  whether a send that was cut off arrived, so sending it again could answer them
                  twice. Check the chat first.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    disabled={busy === item.id}
                    onClick={() => void act(item, "confirm")}
                    className="rounded-lg bg-warning-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-warning-700 disabled:opacity-50"
                  >
                    Send again anyway
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirming("")}
                    className="rounded-lg border border-warning-300 px-3 py-1.5 text-xs font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
