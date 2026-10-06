"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  getVisitSettings,
  saveVisitSettings,
  WEEKDAY_LABELS,
  type VisitSettings,
} from "@/lib/siteVisits";

const input =
  "h-10 w-24 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";
const label = "mb-1.5 block text-sm font-medium text-gray-800 dark:text-white/90";

type Props = { onSaved?: (settings: VisitSettings) => void };

/**
 * The grid the AI books against, and what goes out around a visit. Everything the
 * assistant is allowed to promise a customer is decided here — it never invents a
 * time of its own.
 */
export default function VisitSettingsPanel({ onSaved }: Props) {
  const [settings, setSettings] = useState<VisitSettings | null>(null);
  const [form, setForm] = useState({
    day_start: "10:00",
    day_end: "19:00",
    slot_minutes: "60",
    capacity_per_slot: "2",
    min_lead_minutes: "120",
    max_days_ahead: "14",
    feedback_delay_minutes: "120",
  });
  const [weekdays, setWeekdays] = useState<number[]>([0, 1, 2, 3, 4, 5]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const apply = (next: VisitSettings) => {
    setSettings(next);
    setWeekdays(next.weekdays);
    setForm({
      day_start: next.day_start,
      day_end: next.day_end,
      slot_minutes: String(next.slot_minutes),
      capacity_per_slot: String(next.capacity_per_slot),
      min_lead_minutes: String(next.min_lead_minutes),
      max_days_ahead: String(next.max_days_ahead),
      feedback_delay_minutes: String(next.feedback_delay_minutes),
    });
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await getVisitSettings();
        if (alive) apply(loaded);
      } catch (err) {
        if (alive) setError(failureText(err, "Could not load visit settings."));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (payload: Parameters<typeof saveVisitSettings>[0], done: string) => {
    setSaving(true);
    setError("");
    try {
      const next = await saveVisitSettings(payload);
      apply(next);
      setNotice(done);
      onSaved?.(next);
    } catch (err) {
      setError(failureText(err, "Could not save visit settings."));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!weekdays.length) {
      setError("Choose at least one day when visits can happen.");
      return;
    }
    void save(
      {
        weekdays,
        day_start: form.day_start,
        day_end: form.day_end,
        slot_minutes: Number(form.slot_minutes),
        capacity_per_slot: Number(form.capacity_per_slot),
        min_lead_minutes: Number(form.min_lead_minutes),
        max_days_ahead: Number(form.max_days_ahead),
        feedback_delay_minutes: Number(form.feedback_delay_minutes),
      },
      "Visit settings saved.",
    );
  };

  if (!settings) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || "Loading visit settings…"}
        </p>
      </section>
    );
  }

  const toggle = (
    key: "enabled" | "auto_confirm" | "reminder_24h" | "reminder_2h" | "send_pin_with_reminder" | "ask_for_feedback",
    text: string,
    hint: string,
  ) => (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        checked={settings[key]}
        disabled={saving}
        onChange={(event) => void save({ [key]: event.target.checked }, "Saved.")}
        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-500"
      />
      <span className="text-sm text-gray-700 dark:text-gray-200">
        {text}
        <span className="block text-xs text-gray-500 dark:text-gray-400">{hint}</span>
      </span>
    </label>
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Visit slots and follow-up
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            The AI offers only the slots this grid produces, so it can never promise a time you
            do not work. Reminders, the location pin and the feedback question follow from it.
          </p>
        </div>
      </div>

      {settings.warnings.length ? (
        <ul className="mt-4 space-y-1">
          {settings.warnings.map((warning) => (
            <li key={warning} className="text-sm text-warning-600">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
      {settings.reminder_template_status !== "APPROVED" ||
      settings.feedback_template_status !== "APPROVED" ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Submit the <code>site_visit_reminder</code> and <code>post_visit_feedback</code>{" "}
          templates on{" "}
          <Link href="/profile/api-management" className="text-brand-500 underline">
            WhatsApp templates
          </Link>{" "}
          so these also reach customers who have not messaged you in the last 24 hours.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={onSubmit} className="mt-5 space-y-4">
        <div>
          <span className={label}>Days you do visits</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAY_LABELS.map((day, index) => {
              const on = weekdays.includes(index);
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setWeekdays(
                      on ? weekdays.filter((value) => value !== index) : [...weekdays, index].sort(),
                    )
                  }
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                    on
                      ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15"
                      : "border-gray-300 text-gray-600 dark:border-gray-700 dark:text-gray-300"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <label>
            <span className={label}>Open</span>
            <input
              type="time"
              value={form.day_start}
              onChange={(event) => setForm({ ...form, day_start: event.target.value })}
              className={input}
            />
          </label>
          <label>
            <span className={label}>Close</span>
            <input
              type="time"
              value={form.day_end}
              onChange={(event) => setForm({ ...form, day_end: event.target.value })}
              className={input}
            />
          </label>
          <label>
            <span className={label}>Slot length (min)</span>
            <input
              type="number"
              min={15}
              max={240}
              step={15}
              value={form.slot_minutes}
              onChange={(event) => setForm({ ...form, slot_minutes: event.target.value })}
              className={input}
            />
          </label>
          <label>
            <span className={label}>Visits per slot</span>
            <input
              type="number"
              min={1}
              max={20}
              value={form.capacity_per_slot}
              onChange={(event) => setForm({ ...form, capacity_per_slot: event.target.value })}
              className={input}
            />
          </label>
          <label>
            <span className={label}>Notice needed (min)</span>
            <input
              type="number"
              min={0}
              max={2880}
              step={30}
              value={form.min_lead_minutes}
              onChange={(event) => setForm({ ...form, min_lead_minutes: event.target.value })}
              className={input}
            />
          </label>
          <label>
            <span className={label}>Book up to (days)</span>
            <input
              type="number"
              min={1}
              max={60}
              value={form.max_days_ahead}
              onChange={(event) => setForm({ ...form, max_days_ahead: event.target.value })}
              className={input}
            />
          </label>
          <label>
            <span className={label}>Ask for feedback after (min)</span>
            <input
              type="number"
              min={0}
              max={1440}
              step={30}
              value={form.feedback_delay_minutes}
              onChange={(event) => setForm({ ...form, feedback_delay_minutes: event.target.value })}
              className={input}
            />
          </label>
          <button type="submit" disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            {saving ? "Saving…" : "Save grid"}
          </button>
        </div>

        <div className="grid gap-3 rounded-xl border border-gray-100 p-4 sm:grid-cols-2 dark:border-gray-800">
          {toggle("enabled", "Take site visit bookings", "Off means the AI stops offering visits.")}
          {toggle(
            "auto_confirm",
            "Confirm automatically",
            "Off means every visit waits for you to accept it.",
          )}
          {toggle("reminder_24h", "Remind the day before", "Gives them time to rearrange.")}
          {toggle("reminder_2h", "Remind 2 hours before", "When people actually set off.")}
          {toggle(
            "send_pin_with_reminder",
            "Send the location with that reminder",
            "A real WhatsApp pin, not a link.",
          )}
          {toggle(
            "ask_for_feedback",
            "Ask how the visit went",
            "Only to people who actually turned up.",
          )}
        </div>
      </form>
    </section>
  );
}
