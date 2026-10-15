"use client";

import { useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  getDigestPreferences,
  updateDigestPreferences,
  type DigestPreferences,
} from "@/lib/digest";

type Props = { onChanged?: () => void };

/**
 * What goes in *your* digest.
 *
 * Personal rather than agency-wide, like the number above it. A visits
 * coordinator and a cold-calling agent want different messages, and before this
 * they got the same one — so each switch here changes only your own 9am message.
 *
 * Each toggle saves on click, like the AI callback switch: there is no Save
 * button to forget, and the preview below re-reads straight after.
 */
export default function DigestSectionsCard({ onChanged }: Props) {
  const [preferences, setPreferences] = useState<DigestPreferences | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await getDigestPreferences();
        if (alive) setPreferences(loaded);
      } catch (err) {
        if (alive) setError(failureText(err, "Could not load your digest settings."));
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const toggle = async (key: string, enabled: boolean) => {
    setBusy(key);
    setError("");
    try {
      setPreferences(await updateDigestPreferences({ [key]: enabled }));
      onChanged?.();
    } catch (err) {
      setError(failureText(err, "Could not save that."));
    } finally {
      setBusy(null);
    }
  };

  if (!preferences) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {error || "Loading your digest settings…"}
        </p>
      </section>
    );
  }

  const chosen = preferences.sections.filter((section) => section.enabled).length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            What&rsquo;s in your digest
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Your own message, not the team&rsquo;s. Switching a line off here changes nothing
            for your colleagues.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
          {chosen} of {preferences.sections.length} on
        </span>
      </div>

      <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800">
        {preferences.sections.map((section) => (
          <li key={section.key} className="flex items-start justify-between gap-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {section.label}
              </p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {section.description}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={section.enabled}
              aria-label={section.label}
              disabled={busy !== null}
              onClick={() => void toggle(section.key, !section.enabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
                section.enabled ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
                  section.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>

      {preferences.template_applies ? (
        // Said plainly rather than left for somebody to discover at 9am. A Meta
        // template is approved as one fixed body, so it cannot drop a line.
        <p className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-white/[0.02] dark:text-gray-300">
          Your morning digest goes out on a template Meta has approved, and an approved
          template has one fixed wording — so the 9am message carries every line whatever you
          choose here. These choices shape the message you get when you press “Send me one
          now”, and the preview below.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
    </section>
  );
}
