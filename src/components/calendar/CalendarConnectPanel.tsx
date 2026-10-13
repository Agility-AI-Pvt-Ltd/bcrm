"use client";

/**
 * Getting the visits out of this product and into the calendar a broker uses.
 *
 * Two routes, deliberately unequal in prominence:
 *
 * **Subscribe** is first, because it needs nothing from anybody — a URL the
 * phone re-reads, so a reschedule follows on its own. It works with Google,
 * Apple and Outlook alike, and the honest warning next to it is that the URL is
 * a password: anyone holding it can read the calendar, and rotating is the only
 * way to take it back.
 *
 * **Connect Google** is second and optional. It buys one thing the subscription
 * cannot: reading the broker's *other* commitments so a busy hour stops being
 * bookable. Its two switches are separate because writing into somebody's diary
 * and hiding their bookable slots are different intrusions.
 *
 * Hidden entirely when the deployment has no Google OAuth client, rather than
 * showing a button that cannot work.
 */

import { useCallback, useEffect, useState } from "react";
import { API_BASE_URL, failureText } from "@/lib/api";
import {
  disconnectCalendar,
  getCalendarFeed,
  getCalendarStatus,
  rotateCalendarFeed,
  saveCalendarSettings,
  type CalendarFeed,
  type CalendarStatus,
} from "@/lib/siteVisits";

const STATUS_WORDS: Record<string, string> = {
  connected: "Connected",
  disconnected: "Not connected",
  revoked: "Permission withdrawn — connect again",
};

export default function CalendarConnectPanel({
  onNotice,
}: {
  onNotice: (message: string) => void;
}) {
  const [feed, setFeed] = useState<CalendarFeed | null>(null);
  const [google, setGoogle] = useState<CalendarStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setGoogle(await getCalendarStatus());
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not read your calendar settings."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // The .ics file is served by the API, not this Next app. Using the page
  // origin produced a Vercel URL that 404s when a phone tries to subscribe.
  const subscribeUrl = feed ? `${API_BASE_URL}${feed.path}` : "";

  const reveal = async () => {
    setBusy(true);
    try {
      setFeed(await getCalendarFeed());
      setOpen(true);
    } catch (err) {
      setError(failureText(err, "Could not create your calendar link."));
    } finally {
      setBusy(false);
    }
  };

  const rotate = async () => {
    setBusy(true);
    try {
      setFeed(await rotateCalendarFeed());
      onNotice("New link created. The old one has stopped working.");
    } catch (err) {
      setError(failureText(err, "Could not replace the link."));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(subscribeUrl);
      onNotice("Link copied. Add it in your calendar app as a subscription, not an import.");
    } catch {
      // Clipboard access is refused in some browsers and contexts; the input
      // below is selectable, so this is a convenience and not the only way.
      onNotice("Select the link and copy it.");
    }
  };

  const toggle = async (payload: { push_events?: boolean; block_slots?: boolean }) => {
    setBusy(true);
    try {
      setGoogle(await saveCalendarSettings(payload));
    } catch (err) {
      setError(failureText(err, "Could not save that."));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    try {
      setGoogle(await disconnectCalendar());
      onNotice("Google Calendar disconnected. Nothing more will be written to it.");
    } catch (err) {
      setError(failureText(err, "Could not disconnect."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Put these visits in your own calendar
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A link your phone re-reads, so a rescheduled visit moves there too.
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => (open ? setOpen(false) : void reveal())}
          className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white disabled:opacity-50"
        >
          {open ? "Hide link" : "Subscribe"}
        </button>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {open && feed ? (
        <div className="mt-4 space-y-2">
          <input
            readOnly
            value={subscribeUrl}
            onFocus={(event) => event.currentTarget.select()}
            className="h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 font-mono text-xs dark:border-gray-700 dark:text-white/90"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void copy()}
              className="h-9 rounded-lg border border-gray-300 px-3 text-xs font-medium dark:border-gray-700 dark:text-white/90"
            >
              Copy
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void rotate()}
              className="h-9 rounded-lg border border-error-300 px-3 text-xs font-medium text-error-600 disabled:opacity-50 dark:border-error-500/40 dark:text-error-500"
            >
              Replace link
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Treat this like a password: anyone who has it can read your visits, including
            customer names and numbers. Replacing it is how you take it back — a calendar
            app cannot be asked to forget a link.
          </p>
        </div>
      ) : null}

      {google?.available ? (
        <div className="mt-5 border-t border-gray-200 pt-5 dark:border-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                Google Calendar
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {STATUS_WORDS[google.status] || google.status}
                {google.account_email ? ` · ${google.account_email}` : ""}
              </p>
              <p className="mt-1 max-w-xl text-xs text-gray-500 dark:text-gray-400">
                Optional. The link above already puts visits in your calendar; connecting
                Google adds the other direction — it can see when you are busy elsewhere
                and stop those hours being bookable.
              </p>
            </div>
            {google.status === "connected" ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void disconnect()}
                className="h-9 rounded-lg border border-gray-300 px-3 text-xs font-medium disabled:opacity-50 dark:border-gray-700 dark:text-white/90"
              >
                Disconnect
              </button>
            ) : google.authorize_url ? (
              <a
                href={google.authorize_url}
                className="flex h-9 items-center rounded-lg border border-gray-300 px-3 text-xs font-medium dark:border-gray-700 dark:text-white/90"
              >
                Connect Google Calendar
              </a>
            ) : null}
          </div>

          {google.last_error ? (
            <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-500">
              {google.last_error}
            </p>
          ) : null}

          {google.status === "connected" ? (
            <div className="mt-3 space-y-2">
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={google.push_events}
                  disabled={busy}
                  onChange={(event) => void toggle({ push_events: event.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-700"
                />
                <span>
                  Write my visits into this calendar
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Only visits assigned to me. A cancelled one is marked cancelled rather
                    than deleted, so you can see it was called off.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                <input
                  type="checkbox"
                  checked={google.block_slots}
                  disabled={busy}
                  onChange={(event) => void toggle({ block_slots: event.target.checked })}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-700"
                />
                <span>
                  Stop customers booking when I am busy
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    Reads your busy times only, never what the appointments are. Your
                    administrator also has to switch this on for the whole account.
                  </span>
                </span>
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
