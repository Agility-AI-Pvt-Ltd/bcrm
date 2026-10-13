"use client";

import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { failureText } from "@/lib/api";
import {
  intakeStateLabel,
  intakeStateTone,
  listIntakeSessions,
  listIntakeStaff,
  setIntakeStaff,
  type IntakeSession,
  type IntakeStaff,
} from "@/lib/propertyIntake";

/**
 * Who may file listings from their own WhatsApp, and what they have filed.
 *
 * The switch is the first of two gates and the only one an agency controls. The
 * number it recognises people by is the one they saved themselves for the daily
 * digest, and nobody ever sent a code to it — so turning this on is deliberately
 * a separate act, and nothing a broker sends goes live until they confirm the
 * summary we send back.
 */
export default function PropertyIntakePanel() {
  const [staff, setStaff] = useState<IntakeStaff[]>([]);
  const [sessions, setSessions] = useState<IntakeSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [people, recent] = await Promise.all([listIntakeStaff(), listIntakeSessions(10)]);
      setStaff(people);
      setSessions(recent);
    } catch (err) {
      setStaff([]);
      setSessions([]);
      setError(failureText(err, "Could not load the staff WhatsApp settings."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (person: IntakeStaff) => {
    setBusy(person.user_id);
    setError("");
    try {
      const updated = await setIntakeStaff(person.user_id, !person.enabled);
      setStaff((current) =>
        current.map((row) => (row.user_id === updated.user_id ? updated : row)),
      );
    } catch (err) {
      setError(failureText(err, "Could not change that."));
    } finally {
      setBusy("");
    }
  };

  const enabledCount = staff.filter((row) => row.enabled).length;

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Listings from staff WhatsApp
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            A broker sends the details and photos to your business number, replies DONE, and
            gets a summary back. Nothing appears on the site until they confirm it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.04]"
        >
          {open ? "Hide" : enabledCount ? `${enabledCount} enabled` : "Set up"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {open ? (
        <div className="mt-5 space-y-6">
          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Who may file listings
            </h4>
            {loading ? (
              <p className="mt-2 text-sm text-gray-500">Loading…</p>
            ) : staff.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">No active people in this account.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                {staff.map((person) => (
                  <li
                    key={person.user_id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-white/90">
                        {person.name}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {person.whatsapp
                          ? `Recognised by ${person.whatsapp}`
                          : "No WhatsApp number saved — they can add one on their profile"}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={!person.can_enable || busy === person.user_id}
                      onClick={() => void toggle(person)}
                      className={
                        person.enabled
                          ? "h-9 rounded-lg bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                          : "h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.04]"
                      }
                    >
                      {busy === person.user_id ? "…" : person.enabled ? "Enabled" : "Enable"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              We recognise a broker by the WhatsApp number they saved for their daily digest.
              That number was never verified by us, which is why every listing still has to be
              confirmed by the person who sent it before it goes live.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200">
              Recent submissions
            </h4>
            {sessions.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                Nothing yet. Ask an enabled broker to message your business number.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2 dark:border-gray-800"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm text-gray-800 dark:text-white/90">
                        {session.staff_name}
                      </p>
                      <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                        {session.photos_stored} photo
                        {session.photos_stored === 1 ? "" : "s"}
                        {session.media_failed ? ` · ${session.media_failed} failed` : ""}
                        {session.missing.length
                          ? ` · waiting on ${session.missing.join(", ")}`
                          : ""}
                      </p>
                    </div>
                    <Badge color={intakeStateTone(session.state)}>
                      {intakeStateLabel(session.state)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </section>
  );
}
