"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getFirstTouchActivity,
  getFirstTouchSettings,
  templateStatusLabel,
  updateFirstTouchSettings,
  type FirstTouchActivity,
  type FirstTouchActivityItem,
  type FirstTouchSettings,
} from "@/lib/firstTouch";

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";
const field =
  "h-11 w-24 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90";

const TONE: Record<string, string> = {
  success: "text-success-600",
  error: "text-error-500",
  info: "text-brand-500",
  muted: "text-gray-500 dark:text-gray-400",
};

/**
 * Seconds left, ticking once a second. The deadline is fixed when the server's
 * value arrives, so re-renders do not reset it. Derived during render rather than
 * in an effect, the same pattern as the AI callback countdown.
 */
function useSecondsLeft(seconds: number | null): number | null {
  const [left, setLeft] = useState(seconds);
  const [source, setSource] = useState(seconds);
  if (source !== seconds) {
    setSource(seconds);
    setLeft(seconds);
  }
  useEffect(() => {
    if (seconds === null) return;
    const deadline = Date.now() + seconds * 1000;
    const timer = setInterval(() => {
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [seconds]);
  return left;
}

function ActivityRow({ item }: { item: FirstTouchActivityItem }) {
  const live = item.view.phase === "scheduled" ? item.view.seconds_until_send : null;
  const left = useSecondsLeft(live);
  const label =
    item.view.phase === "scheduled"
      ? left && left > 0
        ? `Messaging in ${left}s`
        : "Messaging now…"
      : item.view.label;
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
          {item.customer_name || item.phone || "New lead"}
          {item.lead_source ? (
            <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
              {item.lead_source}
            </span>
          ) : null}
        </p>
        {item.preview ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">
            {item.preview}
          </p>
        ) : null}
      </div>
      <span className={`shrink-0 text-xs font-medium tabular-nums ${TONE[item.view.tone] ?? ""}`}>
        {label}
      </span>
    </li>
  );
}

/**
 * The card on the Zoho page: switch the first touch on, say how fast and how
 * many, and see the last leads it messaged.
 */
export default function LeadFirstTouchCard({ refreshKey }: { refreshKey?: string }) {
  const [settings, setSettings] = useState<FirstTouchSettings | null>(null);
  const [activity, setActivity] = useState<FirstTouchActivity | null>(null);
  const [form, setForm] = useState({ delay: "15", cap: "200", age: "60" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const mounted = useRef(true);

  const apply = useCallback((next: FirstTouchSettings) => {
    setSettings(next);
    setForm({
      delay: String(next.delay_seconds),
      cap: String(next.daily_cap),
      age: String(next.max_lead_age_minutes),
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [loaded, recent] = await Promise.all([
        getFirstTouchSettings(),
        getFirstTouchActivity(),
      ]);
      if (!mounted.current) return;
      apply(loaded);
      setActivity(recent);
      setError("");
    } catch (err) {
      if (mounted.current) setError(failureText(err, "Could not load first-touch settings."));
    }
  }, [apply]);

  // Poll while something is counting down, so "Messaging in 12s" becomes "Template
  // sent" without the broker reloading the page.
  const pending = (activity?.counts?.scheduled ?? 0) + (activity?.counts?.sending ?? 0);
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(() => void load(), pending > 0 ? 5000 : 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load, pending, refreshKey]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (payload: Parameters<typeof updateFirstTouchSettings>[0], done: string) => {
    setSaving(true);
    setError("");
    try {
      apply(await updateFirstTouchSettings(payload));
      setNotice(done);
    } catch (err) {
      setError(failureText(err, "Could not save first-touch settings."));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const delay = Number.parseInt(form.delay, 10);
    const cap = Number.parseInt(form.cap, 10);
    const age = Number.parseInt(form.age, 10);
    if (
      !Number.isFinite(delay) ||
      delay < settings.min_delay_seconds ||
      delay > settings.max_delay_seconds
    ) {
      setError(
        `Send after must be between ${settings.min_delay_seconds} and ${settings.max_delay_seconds} seconds.`,
      );
      return;
    }
    if (!Number.isFinite(cap) || cap < 1 || cap > 5000) {
      setError("The daily limit must be between 1 and 5000 messages.");
      return;
    }
    if (!Number.isFinite(age) || age < 5 || age > 1440) {
      setError("Only message leads created in the last 5 to 1440 minutes.");
      return;
    }
    void save(
      { delay_seconds: delay, daily_cap: cap, max_lead_age_minutes: age },
      "First-touch settings saved.",
    );
  };

  if (!settings) {
    return (
      <section className={card}>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || "Loading first-touch settings…"}
        </p>
      </section>
    );
  }

  const approved = settings.template_status === "APPROVED";

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            First touch on new leads
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            The moment a portal lead reaches EstateFlow, WhatsApp them an approved template
            asking for budget and locality — no waiting for the customer to write first. When
            they reply, the AI qualifies them as it does any enquiry.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          aria-label="First touch on new leads"
          disabled={saving}
          onClick={() =>
            void save(
              { enabled: !settings.enabled },
              settings.enabled ? "First touch switched off." : "First touch switched on.",
            )
          }
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
            settings.enabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
              settings.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            settings.ready ? "bg-success-500" : settings.enabled ? "bg-warning-500" : "bg-gray-400"
          }`}
        />
        <p className="text-sm text-gray-700 dark:text-gray-200">
          {settings.ready
            ? `On. A new portal lead is messaged ${settings.delay_seconds} second${
                settings.delay_seconds === 1 ? "" : "s"
              } after it arrives — up to ${settings.daily_cap} a day.`
            : settings.enabled
              ? "Switched on, but nothing can be sent yet — see below."
              : "Off. New leads are not messaged; nothing goes out until someone writes to you."}
        </p>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">Template</dt>
          <dd className="mt-1 truncate text-sm font-semibold text-gray-800 dark:text-white/90">
            {settings.template_name}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">Meta approval</dt>
          <dd
            className={`mt-1 text-sm font-semibold ${approved ? "text-success-600" : "text-warning-600"}`}
          >
            {templateStatusLabel(settings.template_status)}
          </dd>
        </div>
        <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
          <dt className="text-xs text-gray-500 dark:text-gray-400">Sent today</dt>
          <dd className="mt-1 text-sm font-semibold text-gray-800 dark:text-white/90">
            {settings.sent_today} / {settings.daily_cap}
          </dd>
        </div>
      </dl>

      {settings.warnings.length ? (
        <ul className="mt-3 space-y-1">
          {settings.warnings.map((warning) => (
            <li key={warning} className="text-sm text-warning-600">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      {!approved ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Submit it for review on{" "}
          <Link href="/profile/api-management" className="text-brand-500 underline">
            WhatsApp templates
          </Link>
          . Until Meta approves it, new leads are queued and skipped rather than messaged.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={onSubmit} className="mt-5 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-white/90">
              Send after
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={settings.min_delay_seconds}
                max={settings.max_delay_seconds}
                step={1}
                value={form.delay}
                onChange={(event) => setForm({ ...form, delay: event.target.value })}
                className={field}
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">seconds</span>
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-white/90">
              Daily limit
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={5000}
              step={1}
              value={form.cap}
              onChange={(event) => setForm({ ...form, cap: event.target.value })}
              className={field}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-white/90">
              Only leads newer than
            </span>
            <span className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={1440}
                step={5}
                value={form.age}
                onChange={(event) => setForm({ ...form, age: event.target.value })}
                className={field}
              />
              <span className="text-sm text-gray-600 dark:text-gray-300">minutes</span>
            </span>
          </label>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Older leads, people who opted out, anyone already chatting with you and repeat
          enquiries from the same number are never messaged.
        </p>

        <label className="mt-4 flex items-start gap-3">
          <input
            type="checkbox"
            checked={settings.call_if_no_reply}
            disabled={saving}
            onChange={(event) =>
              void save(
                { call_if_no_reply: event.target.checked },
                event.target.checked
                  ? "The AI will phone leads who don't reply."
                  : "No phone call after the template.",
              )
            }
            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-200">
            If they don&apos;t reply, let the AI phone them
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Uses your AI Callback wait and settings, and collects budget, BHK, locality and
              move-in date on the call.
            </span>
          </span>
        </label>
      </form>

      {activity?.items.length ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            Recent new leads
          </h4>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {activity.items.slice(0, 10).map((item) => (
              <ActivityRow key={item.id} item={item} />
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
