"use client";

/**
 * The customer files that are past the retention window the page promises.
 *
 * "Customer files kept for 24 months after the last contact" was printed under
 * *What the product is enforcing* while nothing enforced it — no job, no query,
 * nothing deleted anything on age. This panel is the half of that fix a person
 * can look at.
 *
 * It previews and it never sweeps. Each purge is one named person, after an
 * admin has read who they are and when they last made contact, and the server
 * recomputes eligibility before deleting anything — so a stale screen cannot
 * erase a live customer. This is the only path in the product that erases
 * somebody who did not ask, which is exactly why it is a list and a button
 * rather than a nightly job.
 *
 * Loaded on demand rather than with the page: finding cold files is a scan, and
 * a compliance screen should open fast.
 */

import { useState } from "react";
import { failureText } from "@/lib/api";
import {
  getRetentionDue,
  purgeRetained,
  RETENTION_REFUSAL,
  shortDate,
  type RetentionCandidate,
  type RetentionDue,
} from "@/lib/compliance";

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";

export default function RetentionPanel({ onPurged }: { onPurged: (message: string) => void }) {
  const [due, setDue] = useState<RetentionDue | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState<RetentionCandidate | null>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      setDue(await getRetentionDue());
    } catch (err) {
      setError(failureText(err, "Could not work out which files are past the window."));
    } finally {
      setLoading(false);
    }
  };

  const purge = async (person: RetentionCandidate) => {
    if (!person.phone) return;
    setBusy(true);
    setError("");
    try {
      const result = await purgeRetained(person.phone);
      if (!result.purged) {
        setError(RETENTION_REFUSAL[result.reason] || "Nothing was deleted.");
      } else {
        onPurged(
          `Deleted ${result.receipt?.deleted_total ?? 0} records for ${
            person.name || person.phone
          }, kept ${result.receipt?.redacted_total ?? 0} with their details removed.`,
        );
      }
      setConfirming(null);
      await load();
    } catch (err) {
      setError(failureText(err, "Could not complete that deletion."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Files past your retention window
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            You tell customers their details are kept for a limited time. This is who is
            past it. Nothing is deleted automatically — each one is yours to review.
          </p>
        </div>
        <button
          type="button"
          disabled={loading}
          onClick={() => void load()}
          className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
        >
          {loading ? "Checking…" : due ? "Check again" : "Check"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {due ? (
        due.total === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing is past your {due.window_months}-month window. Anyone whose last
            contact is before {shortDate(due.cutoff)} would appear here.
            {due.without_phone
              ? ` ${due.without_phone} old ${
                  due.without_phone === 1 ? "file has" : "files have"
                } no usable number, so they cannot be matched or deleted from here.`
              : ""}
          </p>
        ) : (
          <>
            <p className="mt-4 text-sm text-gray-700 dark:text-gray-200">
              {due.total} {due.total === 1 ? "file is" : "files are"} past your{" "}
              {due.window_months}-month window — last contact before{" "}
              {shortDate(due.cutoff)}.
              {due.without_phone
                ? ` A further ${due.without_phone} have no usable number and cannot be deleted from here.`
                : ""}
            </p>
            <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-800/60">
              {due.people.map((person) => (
                <li
                  key={person.contact_id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {person.name || person.phone}
                      {person.name && person.phone ? (
                        <span className="ml-2 font-normal text-gray-500 dark:text-gray-400">
                          {person.phone}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Last contact {shortDate(person.last_contact_at)} · {person.months_since}{" "}
                      months ago
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirming(person)}
                    className="h-9 rounded-lg border border-error-300 px-3 text-sm font-medium text-error-600 disabled:opacity-50 dark:border-error-500/40 dark:text-error-500"
                  >
                    Review and delete
                  </button>
                </li>
              ))}
            </ul>
            {due.total > due.people.length ? (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                Showing the {due.people.length} oldest. Work through these and check again.
              </p>
            ) : null}
          </>
        )
      ) : (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Finding cold files reads across your whole book, so it runs when you ask rather
          than every time this page opens.
        </p>
      )}

      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Delete {confirming.name || confirming.phone}&apos;s data?
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              They last made contact {shortDate(confirming.last_contact_at)}, which is past
              your retention window. This cannot be undone. Their contact, conversation,
              visits and calls are removed; commission registrations and billing lines are
              kept with their name and number taken out.
            </p>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This customer has not asked to be deleted — your retention policy has. The
              deletion is recorded against your name either way.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium dark:border-gray-700 dark:text-white/90"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void purge(confirming)}
                className="h-10 rounded-lg bg-error-500 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
