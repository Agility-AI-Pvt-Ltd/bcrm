"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getAiCallback,
  updateAiCallback,
  type AiCallbackSettings,
} from "@/lib/aiCallback";

const fieldClass =
  "h-11 w-28 rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";

const STEPS = [
  "A customer messages you on WhatsApp — even just “hi” — and the AI replies.",
  "If they go quiet for the wait below, the AI asks them on WhatsApp whether it may call, with three buttons: call now, call later, or no.",
  "“Call now” — the phone rings about a minute later. “No”, or they carry on chatting instead — nobody is called.",
  "“Call later” — the AI sends a short list of times to choose from, confirms the exact time back to them (“we’ll call you today at 6:00 PM”), and rings then.",
  "The moment a customer picks a time, everyone on your team with a personal WhatsApp number saved gets a message: who, their number, and when — so you can take the call yourself if you’d rather.",
  "On the call it asks 3–4 quick questions: budget, BHK, locality and move-in date, in whatever language the customer speaks.",
  "It tells them their requirements are noted and complete details are coming on WhatsApp.",
  "Right after the call, matching options are sent to their WhatsApp number.",
];

export default function AiCallbackForm() {
  const [settings, setSettings] = useState<AiCallbackSettings | null>(null);
  const [minutes, setMinutes] = useState("5");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await getAiCallback();
        setSettings(loaded);
        setMinutes(String(loaded.delay_minutes));
      } catch (err) {
        setError(failureText(err, "Failed to load AI callback settings."));
      }
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (payload: { enabled?: boolean; delay_minutes?: number }, done: string) => {
    setSaving(true);
    setError("");
    try {
      const updated = await updateAiCallback(payload);
      setSettings(updated);
      setMinutes(String(updated.delay_minutes));
      setNotice(done);
    } catch (err) {
      setError(failureText(err, "Could not save AI callback settings."));
    } finally {
      setSaving(false);
    }
  };

  // The switch saves on click, like the status picker on the Availability page.
  // It does nothing at all while the account is not allowed AI calling: the
  // button is disabled, and this is the second guard in case it is clicked
  // through anyway. The API refuses it too — the switch being grey is a
  // courtesy, not the rule.
  const toggle = () => {
    if (!settings || saving || !settings.admin_allowed) return;
    const enabled = !settings.enabled;
    void save({ enabled }, enabled ? "AI callback switched on." : "AI callback switched off.");
  };

  const onSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings) return;
    const value = Number.parseInt(minutes, 10);
    if (
      !Number.isFinite(value) ||
      value < settings.min_delay_minutes ||
      value > settings.max_delay_minutes
    ) {
      setError(
        `Enter a whole number of minutes between ${settings.min_delay_minutes} and ${settings.max_delay_minutes}.`,
      );
      return;
    }
    void save({ delay_minutes: value }, `Wait set to ${value} minute${value === 1 ? "" : "s"}.`);
  };

  if (!settings) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || "Loading AI callback settings…"}
        </p>
      </section>
    );
  }

  const allowed = settings.admin_allowed;
  const live = allowed && settings.enabled && settings.voice_ready;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">AI callback</h3>
          <p className="mt-1 max-w-xl text-sm text-gray-500 dark:text-gray-400">
            Phone new WhatsApp enquiries that go quiet, collect their requirements in a
            short call, and send the details on WhatsApp.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={allowed && settings.enabled}
          aria-label="AI callback"
          disabled={saving || !allowed}
          title={allowed ? undefined : settings.not_allowed_reason || undefined}
          onClick={toggle}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60 ${
            allowed && settings.enabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
          }`}
        >
          <span
            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${
              allowed && settings.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <span
          className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
            !allowed
              ? "bg-gray-400"
              : live
                ? "bg-success-500"
                : settings.enabled
                  ? "bg-warning-500"
                  : "bg-gray-400"
          }`}
        />
        <p className="text-sm text-gray-700 dark:text-gray-200">
          {!allowed
            ? settings.not_allowed_reason ||
              "AI calling is not enabled for your account. Contact BCRM support to have it switched on."
            : live
              ? `On. A quiet new enquiry is asked for permission to call ${
                  settings.delay_minutes
                } minute${
                  settings.delay_minutes === 1 ? "" : "s"
                } after the AI’s reply, and only called if they say yes — at any time, unless your status is Available.`
              : settings.enabled
                ? "Switched on, but calls can’t be placed yet — see below."
                : "Off. Nobody is asked and nobody is called; enquiries are handled on WhatsApp only."}
        </p>
      </div>

      {!allowed && settings.enabled ? (
        // Their own switch is on and stored; it simply has no effect right now.
        // Said out loud so that being allowed again is not a surprise.
        <p className="mt-3 text-xs text-gray-500">
          Your own setting is still switched on and will take effect as soon as AI calling is
          enabled for your account.
        </p>
      ) : null}

      {allowed && settings.enabled && settings.warnings.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {settings.warnings.map((warning) => (
            <li key={warning} className="text-sm text-warning-600">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}

      {allowed && settings.advisories?.length ? (
        <ul className="mt-3 space-y-1">
          {settings.advisories.map((note) => (
            <li key={note} className="text-sm text-warning-600">
              {note}
            </li>
          ))}
        </ul>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={onSave} className="mt-6 rounded-xl border border-gray-100 p-4 dark:border-gray-800">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-gray-800 dark:text-white/90">
            Ask to call after
          </span>
          <span className="flex flex-wrap items-center gap-3">
            <input
              name="delay_minutes"
              type="number"
              inputMode="numeric"
              min={settings.min_delay_minutes}
              max={settings.max_delay_minutes}
              step={1}
              value={minutes}
              disabled={!allowed}
              onChange={(event) => setMinutes(event.target.value)}
              className={`${fieldClass} disabled:opacity-60`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              minutes without a reply to the AI
            </span>
            <button
              type="submit"
              disabled={!allowed || saving || minutes === String(settings.delay_minutes)}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </span>
        </label>
        <p className="mt-2 text-xs text-gray-500">
          Between {settings.min_delay_minutes} and {settings.max_delay_minutes} minutes. If the
          customer replies on WhatsApp first they are never asked, and nobody is called without
          their yes.
        </p>
      </form>

      <div className="mt-6">
        <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">How it works</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-gray-500">
          Team alerts go to the personal WhatsApp number each person saved for their{" "}
          <Link href="/profile" className="text-brand-500 underline">
            daily digest
          </Link>
          . Calls go out from your Vobiz number, so no personal number is needed. The AI calls in
          every{" "}
          <Link href="/profile/availability" className="text-brand-500 underline">
            status
          </Link>{" "}
          except Available — when you&rsquo;re Available, you handle new enquiries yourself. Each
          enquiry is called at most once. A number is not called again within 7 days if that earlier
          call already collected their requirements — missed or empty calls do not count. Customers who
          opted out or are being handled by a person are never called.
        </p>
      </div>
    </section>
  );
}
