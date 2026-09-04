"use client";

import { FormEvent, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  DAY_LABELS,
  MODE_OPTIONS,
  TIMEZONE_OPTIONS,
  describeLiveState,
  getAvailability,
  updateAvailability,
  type Availability,
  type AvailabilityMode,
} from "@/lib/availability";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";

export default function AvailabilityForm() {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Which mode is mid-save. The picker writes on click, so the row the user
  // pressed needs to look busy without freezing the whole card.
  const [switching, setSwitching] = useState<AvailabilityMode | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await getAvailability();
        setAvailability(loaded);
        setWeekdays(loaded.weekdays);
      } catch (err) {
        setError(failureText(err, "Failed to load availability."));
      }
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Picking a status saves immediately, the way a chat app's status menu does.
  // Making someone press Save after choosing "Away" is how you end up still
  // marked available an hour later.
  const chooseMode = async (mode: AvailabilityMode) => {
    if (!availability || availability.mode === mode || switching) return;
    setSwitching(mode);
    setError("");
    try {
      const updated = await updateAvailability({ mode });
      setAvailability(updated);
      setWeekdays(updated.weekdays);
      setNotice(`Status set to ${MODE_OPTIONS.find((m) => m.value === mode)?.label}.`);
    } catch (err) {
      setError(failureText(err, "Could not change your status."));
    } finally {
      setSwitching(null);
    }
  };

  const toggleDay = (day: number) => {
    setWeekdays((current) =>
      current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day].sort((a, b) => a - b),
    );
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      const updated = await updateAvailability({
        human_phone: String(form.get("human_phone") || "").trim() || null,
        online_start: String(form.get("online_start") || ""),
        online_end: String(form.get("online_end") || ""),
        timezone: String(form.get("timezone") || ""),
        weekdays,
        offer_callback: form.get("offer_callback") === "on",
        away_message: String(form.get("away_message") || "").trim() || null,
      });
      setAvailability(updated);
      setWeekdays(updated.weekdays);
      setNotice("Availability saved.");
    } catch (err) {
      setError(failureText(err, "Could not save your availability."));
    } finally {
      setSaving(false);
    }
  };

  if (!availability) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || "Loading your availability…"}
        </p>
      </section>
    );
  }

  const activeDot =
    MODE_OPTIONS.find((option) => option.value === availability.mode)?.dot ?? "bg-gray-400";
  const scheduleActive = availability.mode === "scheduled";

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Availability</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Decide when customers reach you and when the AI answers on your behalf. This
        applies to WhatsApp chats and AI calls alike.
      </p>

      {/* What is happening right now, in words. The status you picked matters less
          than what a customer messaging this second would actually be told. */}
      <div className="mt-4 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
        <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${activeDot}`} />
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Right now: {availability.human_online ? "you're on" : "the AI is on"}
          </p>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {describeLiveState(availability)}
          </p>
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <div className="mt-5">
        <p className="mb-2 text-sm font-medium text-gray-800 dark:text-white/90">Status</p>
        <div
          role="radiogroup"
          aria-label="Availability status"
          className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800"
        >
          {MODE_OPTIONS.map((option) => {
            const selected = availability.mode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={switching !== null}
                onClick={() => void chooseMode(option.value)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 dark:hover:bg-white/[0.04] ${
                  selected ? "bg-brand-50 dark:bg-brand-500/10" : ""
                }`}
              >
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`} />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                    {option.label}
                    {switching === option.value ? (
                      <span className="ml-2 text-xs font-normal text-gray-400">saving…</span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                    {option.description}
                  </span>
                </span>
                {selected ? (
                  <span className="mt-0.5 text-xs font-medium text-brand-500">Selected</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {availability.warnings.map((warning) => (
        <p key={warning} className="mt-3 text-sm text-warning-600">
          {warning}
        </p>
      ))}

      <form onSubmit={(event) => void onSave(event)} className="mt-6 space-y-4">
        <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
            <p className="font-medium text-gray-800 dark:text-white/90">Working hours</p>
            {/* The schedule stays editable in every mode — a broker setting up
                "AI only" today still wants their hours saved for when they switch
                back — but it is worth saying when it is not being consulted. */}
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {scheduleActive
                ? "In use"
                : "Saved, but not in use while your status is set manually"}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-600 dark:text-gray-300">
                Start
              </span>
              <input
                name="online_start"
                type="time"
                defaultValue={availability.online_start}
                key={`start-${availability.online_start}`}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-600 dark:text-gray-300">End</span>
              <input
                name="online_end"
                type="time"
                defaultValue={availability.online_end}
                key={`end-${availability.online_end}`}
                className={fieldClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-gray-600 dark:text-gray-300">
                Timezone
              </span>
              <select
                name="timezone"
                defaultValue={availability.timezone}
                key={`tz-${availability.timezone}`}
                className={fieldClass}
              >
                {/* The stored zone may not be in the shortlist — a value set
                    before this screen existed, say — so it is added rather than
                    silently reset to the first option on save. */}
                {(TIMEZONE_OPTIONS.includes(availability.timezone)
                  ? TIMEZONE_OPTIONS
                  : [availability.timezone, ...TIMEZONE_OPTIONS]
                ).map((zone) => (
                  <option key={zone} value={zone}>
                    {zone}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-xs text-gray-600 dark:text-gray-300">
              Working days
            </span>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((label, day) => {
                const on = weekdays.includes(day);
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                    className={`h-9 w-14 rounded-lg border text-xs font-medium transition ${
                      on
                        ? "border-brand-500 bg-brand-500 text-white"
                        : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          <p className="mb-3 border-b border-gray-100 pb-3 font-medium text-gray-800 dark:border-gray-800 dark:text-white/90">
            What customers are told
          </p>

          <label className="block">
            <span className="mb-1.5 block text-xs text-gray-600 dark:text-gray-300">
              Phone number to share
            </span>
            <input
              name="human_phone"
              type="tel"
              placeholder="+91 98765 43210"
              defaultValue={availability.human_phone ?? ""}
              key={`phone-${availability.human_phone ?? ""}`}
              className={fieldClass}
            />
            <span className="mt-1.5 block text-xs text-gray-500">
              {availability.human_phone
                ? "Given to customers when a chat is handed over."
                : availability.effective_phone
                  ? `Blank, so your profile number ${availability.effective_phone} is used.`
                  : "Blank, and there is no profile number to fall back on."}
            </span>
          </label>

          <label className="mt-4 block">
            <span className="mb-1.5 block text-xs text-gray-600 dark:text-gray-300">
              Away message <span className="text-gray-400">(optional)</span>
            </span>
            <input
              name="away_message"
              type="text"
              maxLength={280}
              placeholder="Back Monday morning — the AI can help meanwhile."
              defaultValue={availability.away_message ?? ""}
              key={`away-${availability.away_message ?? ""}`}
              className={fieldClass}
            />
            <span className="mt-1.5 block text-xs text-gray-500">
              Replaces the default &ldquo;away right now&rdquo; line when you&rsquo;re
              unreachable.
            </span>
          </label>

          <label className="mt-4 flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              name="offer_callback"
              defaultChecked={availability.offer_callback}
              key={`callback-${availability.offer_callback}`}
              className="mt-1"
            />
            <span>
              Let the AI promise a callback
              <span className="mt-0.5 block text-xs text-gray-500">
                Off by default. Only turn this on if someone will actually make the call.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save availability"}
        </button>
      </form>
    </section>
  );
}
