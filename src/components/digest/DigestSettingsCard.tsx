"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getDigestSettings,
  parseTimeValue,
  templateStatusLabel,
  timeValue,
  TIMEZONES,
  updateDigestSettings,
  type DigestSettings,
} from "@/lib/digest";

const field =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

type Props = { onChanged?: (settings: DigestSettings) => void };

/**
 * When the digest goes out, and what stands in its way.
 *
 * The two blockers are shown as facts rather than left for 9am to reveal: WhatsApp
 * not connected, and the `daily_digest` template not yet approved by Meta. Because
 * this message is business-initiated, an unapproved template means no digest at
 * all — not a plain-text fallback.
 */
export default function DigestSettingsCard({ onChanged }: Props) {
  const [settings, setSettings] = useState<DigestSettings | null>(null);
  const [time, setTime] = useState("09:00");
  const [timezone, setTimezone] = useState("Asia/Kolkata");
  const [lookback, setLookback] = useState("24");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = (next: DigestSettings) => {
    setSettings(next);
    setTime(timeValue(next.send_hour, next.send_minute));
    setTimezone(next.timezone);
    setLookback(String(next.lookback_hours));
    onChanged?.(next);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await getDigestSettings();
        if (alive) apply(loaded);
      } catch (err) {
        if (alive) setError(failureText(err, "Could not load the digest settings."));
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (payload: Parameters<typeof updateDigestSettings>[0], done: string) => {
    setSaving(true);
    setError("");
    try {
      apply(await updateDigestSettings(payload));
      setNotice(done);
    } catch (err) {
      setError(failureText(err, "Could not save the digest settings."));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseTimeValue(time);
    if (!parsed) {
      setError("Enter a time like 09:00.");
      return;
    }
    void save(
      { ...parsed, timezone, lookback_hours: Number(lookback) || 24 },
      "Schedule saved.",
    );
  };

  if (!settings) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || "Loading digest settings…"}
        </p>
      </section>
    );
  }

  const approved = settings.template_status === "APPROVED";
  const zones = TIMEZONES.includes(settings.timezone)
    ? TIMEZONES
    : [settings.timezone, ...TIMEZONES];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Morning digest
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            One WhatsApp message a day to every teammate who has saved a personal number —
            new leads by interest, follow-ups due, and anyone still waiting to be contacted.
          </p>
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={settings.enabled}
            disabled={saving}
            onChange={(event) =>
              void save(
                { enabled: event.target.checked },
                event.target.checked ? "Digest on." : "Digest off.",
              )
            }
            className="h-4 w-4 rounded border-gray-300 text-brand-500"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {settings.enabled ? "On" : "Off"}
          </span>
        </label>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">Sends at</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-800 dark:text-white/90">
            {settings.send_label}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">Going to</dt>
          <dd className="mt-0.5 text-sm font-medium text-gray-800 dark:text-white/90">
            {settings.recipient_count}{" "}
            {settings.recipient_count === 1 ? "teammate" : "teammates"}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">
            <code>{settings.template_name}</code> template
          </dt>
          <dd
            className={`mt-0.5 text-sm font-medium ${
              approved ? "text-success-600" : "text-warning-600"
            }`}
          >
            <Link href="/whatsapp-templates" className="underline underline-offset-2">
              {templateStatusLabel(settings.template_status)}
            </Link>
          </dd>
        </div>
      </dl>

      {!settings.whatsapp_connected ? (
        <p className="mt-4 rounded-xl bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
          WhatsApp is not connected, so nothing can be delivered yet. Connect it on{" "}
          <Link href="/profile/api-management" className="underline">
            API management
          </Link>
          .
        </p>
      ) : null}
      {!approved ? (
        <p className="mt-3 rounded-xl bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
          The digest arrives before anyone has messaged you that morning, so WhatsApp only
          carries it on an approved template. Submit <code>{settings.template_name}</code> on{" "}
          <Link href="/whatsapp-templates" className="underline">
            WhatsApp templates
          </Link>{" "}
          — until Meta approves it, the digest is skipped rather than sent as plain text.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1.5 block text-gray-500">Send at</span>
          <input
            type="time"
            value={time}
            onChange={(event) => setTime(event.target.value)}
            className={`${field} w-32`}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-gray-500">Timezone</span>
          <select
            value={timezone}
            onChange={(event) => setTimezone(event.target.value)}
            className={`${field} w-48`}
          >
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1.5 block text-gray-500">New leads from the last</span>
          <select
            value={lookback}
            onChange={(event) => setLookback(event.target.value)}
            className={`${field} w-32`}
          >
            {[12, 24, 36, 48, 72].map((hours) => (
              <option key={hours} value={String(hours)}>
                {hours} hours
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save schedule"}
        </button>
      </form>

      <label className="mt-4 flex items-start gap-3">
        <input
          type="checkbox"
          checked={settings.skip_when_empty}
          disabled={saving}
          onChange={(event) => void save({ skip_when_empty: event.target.checked }, "Saved.")}
          className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500"
        />
        <span className="text-sm text-gray-700 dark:text-gray-200">
          Stay quiet on a morning with nothing to report
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            A digest of zeroes trains people to ignore the next one.
          </span>
        </span>
      </label>
    </section>
  );
}
