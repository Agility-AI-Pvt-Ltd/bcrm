"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { failureText } from "@/lib/api";
import {
  disconnectZoho,
  formatWhen,
  getZohoConnectUrl,
  getZohoStatus,
  syncZohoNow,
  zohoPhase,
  type ZohoStatus,
} from "@/lib/zoho";
import LeadFirstTouchCard from "./LeadFirstTouchCard";
import ZohoFieldMapping from "./ZohoFieldMapping";
import ZohoLeadsTable from "./ZohoLeadsTable";

const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";
const primary =
  "rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50";
const secondary =
  "rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]";

const RETURN_MESSAGES: Record<string, string> = {
  connected: "Zoho CRM connected. Your leads are being imported in the background.",
  cancelled: "Connection cancelled in Zoho. Nothing was changed.",
};

const n = (value: number) => value.toLocaleString();

export default function ZohoIntegrationPage() {
  const params = useSearchParams();
  const returned = params.get("zoho");
  const returnedReason = params.get("reason");
  const [status, setStatus] = useState<ZohoStatus | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(returned && RETURN_MESSAGES[returned] ? RETURN_MESSAGES[returned] : "");
  const [busy, setBusy] = useState<"" | "connect" | "sync" | "disconnect">("");
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await getZohoStatus();
      if (mounted.current) {
        setStatus(next);
        setError("");
      }
    } catch (err) {
      if (mounted.current) setError(failureText(err, "Could not load the Zoho connection."));
    }
  }, []);

  const phase = zohoPhase(status);
  // Not "connecting": that only means a consent page was opened, maybe abandoned.
  const live = phase === "syncing";

  // Poll fast while a sync runs, slowly otherwise, so progress moves on screen
  // and a sync started by the schedule or a webhook still shows up.
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(() => void load(), live ? 3000 : 30000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load, live]);

  const connect = async () => {
    setBusy("connect");
    setError("");
    try {
      const { authorize_url } = await getZohoConnectUrl();
      // Zoho's own sign-in and consent page. EstateFlow never sees the password.
      window.location.assign(authorize_url);
    } catch (err) {
      setError(failureText(err, "Could not start the Zoho connection."));
      setBusy("");
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    setError("");
    try {
      const result = await syncZohoNow();
      setNotice(
        result.started
          ? "Sync started."
          : result.reason === "already_syncing"
            ? "A sync is already running."
            : "Sync could not start — see the status below.",
      );
      await load();
    } catch (err) {
      setError(failureText(err, "Could not start a sync."));
    } finally {
      setBusy("");
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError("");
    try {
      setStatus(await disconnectZoho());
      setNotice("Zoho CRM disconnected. Imported leads were kept.");
      setConfirmDisconnect(false);
    } catch (err) {
      setError(failureText(err, "Could not disconnect Zoho CRM."));
    } finally {
      setBusy("");
    }
  };

  const run = status?.sync ?? null;

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Zoho CRM</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Connect your Zoho CRM to EstateFlow. Leads from 99acres, MagicBricks, Housing.com,
              your website and ads that already flow into Zoho are imported automatically —
              their original source is kept — and stay in sync.
            </p>
          </div>
          {status?.connected ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-sm font-medium text-success-700 dark:bg-success-500/15 dark:text-success-500">
              Connected ✓
            </span>
          ) : null}
        </div>

        {returned === "error" ? (
          <p className="mt-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/15 dark:text-error-500">
            {returnedReason || "Zoho did not complete the connection. Please try again."}
          </p>
        ) : null}
        {notice ? <p className="mt-4 text-sm text-success-600">{notice}</p> : null}
        {error ? <p className="mt-4 text-sm text-error-500">{error}</p> : null}

        {!status ? (
          <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">{error ? "" : "Loading…"}</p>
        ) : !status.connected ? (
          <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50 p-5 dark:border-gray-800 dark:bg-white/[0.02]">
            {phase === "reconnect" ? (
              <p className="mb-3 text-sm text-warning-600">
                Zoho no longer accepts the saved connection (it may have been revoked in Zoho).
                Reconnect to resume syncing — your imported leads are still here.
              </p>
            ) : null}
            <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-gray-600 dark:text-gray-300">
              <li>You sign in on Zoho’s own page — EstateFlow never sees your Zoho password.</li>
              <li>Read-only access to Leads, plus notifications so new leads arrive in seconds.</li>
              <li>Disconnect any time; imported leads stay in EstateFlow.</li>
            </ul>
            <button
              type="button"
              className={primary}
              disabled={busy !== "" || !status.configured}
              onClick={() => void connect()}
            >
              {busy === "connect"
                ? "Opening Zoho…"
                : phase === "reconnect"
                  ? "Reconnect Zoho CRM"
                  : "Connect Zoho CRM"}
            </button>
            {status.leads_synced > 0 ? (
              <p className="mt-3 text-xs text-gray-500">
                {n(status.leads_synced)} leads from an earlier connection are kept. Reconnecting
                updates them instead of creating duplicates.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Zoho account" value={status.zoho_org_name || "Zoho CRM"} />
              <Stat label="Leads synced" value={n(status.leads_synced)} />
              <Stat label="Last successful sync" value={formatWhen(status.last_successful_sync_at)} />
              <Stat
                label="Status"
                value={
                  phase === "syncing"
                    ? "Syncing…"
                    : phase === "failed"
                      ? "Last sync failed"
                      : "Up to date"
                }
              />
            </dl>

            {phase === "syncing" && run ? <SyncProgress run={run} /> : null}

            {phase === "failed" && run?.last_error ? (
              <p className="rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/15 dark:text-error-500">
                {run.last_error}
              </p>
            ) : null}

            {phase === "completed" && run ? (
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Last run: {n(run.total_fetched)} checked · {n(run.created)} new · {n(run.updated)} updated
                {run.deleted ? ` · ${n(run.deleted)} archived` : ""}
                {run.failed ? ` · ${n(run.failed)} failed` : ""}.
              </p>
            ) : null}

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Next sync: automatic, every {status.sync_interval_minutes} minutes
              {status.realtime ? ", plus instant updates from Zoho" : ""}.
            </p>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                className={primary}
                disabled={busy !== "" || phase === "syncing"}
                onClick={() => void syncNow()}
              >
                {busy === "sync" ? "Starting…" : "Sync now"}
              </button>
              {confirmDisconnect ? (
                <>
                  <button
                    type="button"
                    className="rounded-lg bg-error-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-error-600 disabled:opacity-50"
                    disabled={busy !== ""}
                    onClick={() => void disconnect()}
                  >
                    {busy === "disconnect" ? "Disconnecting…" : "Yes, disconnect"}
                  </button>
                  <button type="button" className={secondary} onClick={() => setConfirmDisconnect(false)}>
                    Keep connected
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={secondary}
                  disabled={busy !== ""}
                  onClick={() => setConfirmDisconnect(true)}
                >
                  Disconnect
                </button>
              )}
            </div>
          </div>
        )}

        {status?.warnings.length ? (
          <ul className="mt-5 space-y-1">
            {status.warnings.map((warning) => (
              <li key={warning} className="text-sm text-warning-600">
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {status?.connected ? (
        <>
          <LeadFirstTouchCard refreshKey={status.last_successful_sync_at ?? ""} />
          <ZohoFieldMapping refreshKey={status.last_successful_sync_at ?? ""} onSaved={() => void load()} />
          <ZohoLeadsTable refreshKey={`${status.leads_synced}:${status.last_successful_sync_at ?? ""}`} />
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-gray-100 p-3 dark:border-gray-800">
      <dt className="text-xs text-gray-500 dark:text-gray-400">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold text-gray-800 dark:text-white/90">{value}</dd>
    </div>
  );
}

function SyncProgress({ run }: { run: NonNullable<ZohoStatus["sync"]> }) {
  const total = run.total_estimate;
  const percent = total ? Math.min(100, Math.round((run.processed / Math.max(total, 1)) * 100)) : null;
  const label =
    run.phase === "mapping"
      ? "Reading your Zoho fields…"
      : run.phase === "deleted"
        ? "Checking for leads deleted in Zoho…"
        : total
          ? `${n(run.processed)} / ${n(total)}`
          : `${n(run.processed)} leads synced so far…`;
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-25 p-4 dark:border-brand-500/20 dark:bg-brand-500/[0.06]">
      <p className="text-sm font-medium text-gray-800 dark:text-white/90">{label}</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
        <div
          className={`h-full rounded-full bg-brand-500 transition-all ${percent === null ? "w-1/3 animate-pulse" : ""}`}
          style={percent === null ? undefined : { width: `${percent}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {n(run.created)} created · {n(run.updated)} updated · {n(run.skipped)} unchanged ·{" "}
        {n(run.failed)} failed
      </p>
    </div>
  );
}
