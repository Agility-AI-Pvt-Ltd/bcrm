"use client";

import { useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  formatDigestDate,
  getDigestPreview,
  sendDigestNow,
  type DigestPreview,
} from "@/lib/digest";

type Props = {
  /** Bumped by the parent when a number or the schedule changes, to reload. */
  refreshKey?: number;
  onSent?: () => void;
};

const LINES: Array<{ key: keyof DigestPreview["counts"]; label: string }> = [
  { key: "new_leads", label: "New leads" },
  { key: "hot", label: "🔥 Hot" },
  { key: "warm", label: "🟡 Warm" },
  { key: "cold", label: "⚪ Cold" },
  { key: "followups_due", label: "Follow-ups due" },
  { key: "not_contacted", label: "Not contacted yet" },
  { key: "visits_today", label: "Site visits today" },
  { key: "unanswered", label: "Waiting on a reply" },
];

/**
 * The digest as it will read on a phone, with today's real numbers.
 *
 * Shown as the message rather than as a table, because the thing worth checking
 * before switching this on is whether the sentence makes sense — the counts are
 * the same ones the Leads and Inbox screens use.
 */
export default function DigestPreviewCard({ refreshKey = 0, onSent }: Props) {
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      setPreview(await getDigestPreview());
    } catch (err) {
      setError(failureText(err, "Could not build today's digest."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const send = async (onlyMe: boolean) => {
    setSending(true);
    setError("");
    try {
      const result = await sendDigestNow(onlyMe);
      setNotice(result.message);
      onSent?.();
    } catch (err) {
      setError(failureText(err, "Could not send the digest."));
    } finally {
      setSending(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Today&apos;s digest
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {preview
              ? `The message for ${formatDigestDate(preview.digest_date)}, with live numbers.`
              : "Building the message…"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={sending}
            onClick={() => void send(true)}
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {sending ? "Sending…" : "Send to me now"}
          </button>
          <button
            type="button"
            disabled={sending || !preview?.recipients.length}
            onClick={() => void send(false)}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.04]"
          >
            Send to everyone
          </button>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      {preview ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl bg-[#d9fdd3] p-4 text-sm leading-relaxed text-gray-900 shadow-sm dark:bg-[#075e54]/30 dark:text-gray-100">
            <pre className="whitespace-pre-wrap font-sans">{preview.text}</pre>
          </div>

          <div>
            <dl className="grid grid-cols-2 gap-2">
              {LINES.map((line) => (
                <div
                  key={line.key}
                  className="rounded-xl border border-gray-200 px-3 py-2 dark:border-gray-800"
                >
                  <dt className="text-xs text-gray-500 dark:text-gray-400">{line.label}</dt>
                  <dd className="text-base font-semibold text-gray-800 dark:text-white/90">
                    {preview.counts[line.key]}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              Hot, Warm and Cold add up to the new-lead count. A lead the scorer has not read
              yet counts as Cold rather than disappearing.
            </p>

            <h4 className="mt-5 text-sm font-medium text-gray-800 dark:text-white/90">
              Going to {preview.recipients.length}{" "}
              {preview.recipients.length === 1 ? "person" : "people"}
            </h4>
            {preview.recipients.length ? (
              <ul className="mt-2 space-y-1.5">
                {preview.recipients.map((person) => (
                  <li
                    key={person.user_id}
                    className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-800"
                  >
                    <span className="text-gray-800 dark:text-white/90">{person.name}</span>
                    <span className="text-gray-500 dark:text-gray-400">{person.phone}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Nobody has saved a personal WhatsApp number yet, so the digest has nowhere to
                go. Add yours above.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
