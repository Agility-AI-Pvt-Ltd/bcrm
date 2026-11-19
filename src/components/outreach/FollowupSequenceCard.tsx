"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import { templateStatusLabel } from "@/lib/firstTouch";
import {
  getFollowupActivity,
  getFollowupSettings,
  LANGUAGE_LABEL,
  leadFollowupLine,
  updateFollowupSettings,
  type FollowupActivityItem,
  type FollowupSequenceSettings,
  type FollowupSequenceUpdate,
} from "@/lib/followupSequence";
import { submitStarter } from "@/lib/whatsappTemplates";

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";
const input =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90";
const HOURS = Array.from({ length: 25 }, (_, hour) => hour);

function chip(status: string): string {
  if (status === "APPROVED") return "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500";
  if (status === "PENDING") return "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-orange-400";
  if (status === "REJECTED") return "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500";
  return "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300";
}

function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/**
 * The 5-touch follow-up on the Follow-ups page: switch it on, set the days and
 * sending hours, get the ten templates approved, and see who it is working on.
 */
export default function FollowupSequenceCard() {
  const [settings, setSettings] = useState<FollowupSequenceSettings | null>(null);
  const [activity, setActivity] = useState<FollowupActivityItem[]>([]);
  const [days, setDays] = useState("1, 3, 7, 10, 14");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const apply = useCallback((next: FollowupSequenceSettings) => {
    setSettings(next);
    setDays(next.days.join(", "));
  }, []);

  const load = useCallback(async () => {
    try {
      const [loaded, recent] = await Promise.all([getFollowupSettings(), getFollowupActivity()]);
      if (!mounted.current) return;
      apply(loaded);
      setActivity(recent);
      setError("");
    } catch (err) {
      if (mounted.current) setError(failureText(err, "Could not load the follow-up settings."));
    }
  }, [apply]);

  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (payload: FollowupSequenceUpdate, done: string) => {
    setBusy(true);
    setError("");
    try {
      apply(await updateFollowupSettings(payload));
      setNotice(done);
    } catch (err) {
      setError(failureText(err, "Could not save."));
    } finally {
      setBusy(false);
    }
  };

  const saveDays = () => {
    const parsed = days
      .split(/[\s,]+/)
      .filter(Boolean)
      .map((value) => Number(value));
    if (parsed.some((value) => !Number.isInteger(value))) {
      setError("Days must be whole numbers, e.g. 1, 3, 7, 10, 14.");
      return;
    }
    void save({ days: parsed }, "Follow-up days saved.");
  };

  const unsubmitted =
    settings?.touches.flatMap((touch) =>
      touch.languages.filter((item) => item.status === "NOT_SUBMITTED" && item.catalog_template_id),
    ) ?? [];

  const submit = async (catalogIds: string[]) => {
    setBusy(true);
    setError("");
    let failed = 0;
    for (const id of catalogIds) {
      try {
        await submitStarter(id);
      } catch {
        failed += 1;
      }
    }
    setBusy(false);
    if (failed) setError(`${failed} of ${catalogIds.length} could not be submitted. Check the Templates page.`);
    else setNotice(catalogIds.length === 1 ? "Sent to Meta for review." : `${catalogIds.length} templates sent to Meta for review.`);
    void load();
  };

  if (!settings) {
    return (
      <div className={`${card} mb-6`}>
        <p className="text-sm text-gray-500">{error || "Loading follow-up sequence…"}</p>
      </div>
    );
  }

  const counts = settings.counts ?? {};
  return (
    <div className={`${card} mb-6`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h2 className="font-semibold text-gray-900 dark:text-white/90">5-touch follow-up</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            A lead who messaged you on WhatsApp and then went quiet gets an approved template on
            days {settings.days.join(", ")} after their last message, in Hindi or English, whichever
            they write in. If they reply, the AI answers and the days start over. It stops for good
            on STOP, a booked site visit, or “Not a lead”.
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-3">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {settings.enabled ? "On" : "Off"}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            aria-label="5-touch follow-up"
            disabled={busy}
            onClick={() =>
              void save(
                { enabled: !settings.enabled },
                settings.enabled ? "Follow-ups switched off." : "Follow-ups switched on.",
              )
            }
            className={`relative h-6 w-11 rounded-full transition ${settings.enabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"}`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${settings.enabled ? "left-[22px]" : "left-0.5"}`}
            />
          </button>
        </label>
      </div>

      {settings.enabled && !settings.ready ? (
        <p className="mt-4 rounded-lg bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-orange-400">
          On, but some follow-ups have no approved template yet. Those wait until Meta approves
          one, and are skipped if the next follow-up&apos;s day comes first.
        </p>
      ) : null}
      {settings.enabled && settings.enabled_at ? (
        <p className="mt-3 text-xs text-gray-400">
          Only customers who message after it was switched on (
          {new Date(settings.enabled_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          ) are followed up. Nobody from before gets a surprise day-7 message.
        </p>
      ) : null}

      <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["In progress", counts.active ?? 0],
          ["Sent, last 7 days", counts.sent_last_7_days ?? 0],
          ["Finished all", counts.completed ?? 0],
          ["Stopped", counts.stopped ?? 0],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl bg-gray-50 px-4 py-3 dark:bg-white/[0.03]">
            <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-900 dark:text-white/90">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <label className="text-sm">
          <span className="mb-1 block text-gray-600 dark:text-gray-400">Days after their last message</span>
          <span className="flex gap-2">
            <input
              className={`${input} w-44`}
              value={days}
              onChange={(event) => setDays(event.target.value)}
              aria-label="Follow-up days"
            />
            <button
              type="button"
              disabled={busy || days === settings.days.join(", ")}
              onClick={saveDays}
              className="rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            >
              Save
            </button>
          </span>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-gray-600 dark:text-gray-400">Send between</span>
          <span className="flex items-center gap-2">
            <select
              className={input}
              value={settings.send_start_hour}
              disabled={busy}
              aria-label="Earliest send hour"
              onChange={(event) =>
                void save({ send_start_hour: Number(event.target.value) }, "Sending hours saved.")
              }
            >
              {HOURS.slice(0, 23).map((hour) => (
                <option key={hour} value={hour}>{hourLabel(hour)}</option>
              ))}
            </select>
            <span className="text-gray-500">and</span>
            <select
              className={input}
              value={settings.send_end_hour}
              disabled={busy}
              aria-label="Latest send hour"
              onChange={(event) =>
                void save({ send_end_hour: Number(event.target.value) }, "Sending hours saved.")
              }
            >
              {HOURS.slice(2).map((hour) => (
                <option key={hour} value={hour}>{hourLabel(hour)}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400">{settings.timezone}</span>
          </span>
        </label>
      </div>

      <div className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Templates</h3>
          {unsubmitted.length ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit(unsubmitted.map((item) => item.catalog_template_id as string))}
              className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Submit {unsubmitted.length} for Meta review
            </button>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          WhatsApp only allows approved templates after 24 hours of silence. These are Marketing
          templates (Meta bills each one) and each ends with “Reply STOP to stop these messages”.
          A follow-up goes in English if its Hindi version is not approved yet, and the other way round.
          {" "}
          <Link href="/whatsapp-templates" className="text-brand-500 hover:underline">
            See the wording on Templates
          </Link>
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="text-xs text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-4 font-medium">Follow-up</th>
                {["en_US", "hi"].map((language) => (
                  <th key={language} className="py-2 pr-4 font-medium">{LANGUAGE_LABEL[language]}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {settings.touches.map((touch) => (
                <tr key={touch.step}>
                  <td className="py-2 pr-4 text-gray-800 dark:text-white/90">
                    {touch.step}. Day {touch.day}
                    <span className="ml-2 font-mono text-xs text-gray-400">{touch.template}</span>
                  </td>
                  {touch.languages.map((item) => (
                    <td key={item.language} className="py-2 pr-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip(item.status)}`}>
                        {templateStatusLabel(item.status)}
                      </span>
                      {item.status === "NOT_SUBMITTED" && item.catalog_template_id ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void submit([item.catalog_template_id as string])}
                          className="ml-2 text-xs font-medium text-brand-500 hover:underline disabled:opacity-50"
                        >
                          Submit
                        </button>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {activity.length ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">Recent</h3>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {activity.map((item, index) => (
              <li key={`${item.contact_id}-${index}`} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                    {item.customer_name || item.customer_phone || "Lead"}
                  </p>
                  {item.last_error && item.status === "active" ? (
                    <p className="mt-0.5 text-xs text-warning-700 dark:text-orange-400">{item.last_error}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
                  {leadFollowupLine(item) || item.status}
                  {item.language ? ` · ${LANGUAGE_LABEL[item.language] ?? item.language}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 min-h-5 text-sm" aria-live="polite">
        {error ? <span className="text-error-500">{error}</span> : null}
        {!error && notice ? <span className="text-success-600">{notice}</span> : null}
      </div>
    </div>
  );
}
