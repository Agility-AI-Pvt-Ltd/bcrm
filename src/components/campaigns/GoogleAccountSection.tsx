"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getGoogleCredential,
  testGoogleCredential,
  type GoogleCredentialStatus,
} from "@/lib/propertySheets";

/**
 * How to let BCRM read a private spreadsheet — explained where it is done.
 *
 * There is one Google service account for the whole BCRM server, so an agency
 * configures nothing: it shares its sheet with one address, as Viewer, and
 * connects it. That address is the entire setup, which is why it is the
 * largest thing here.
 *
 * Two audiences read this box. The agent connecting a sheet needs the three
 * steps. Whoever runs the server needs to know whether the key is installed and
 * how it got there — in particular that a GitHub secret only matters for
 * deploys made through GitHub Actions, and a server deployed by copying files
 * (rsync, scp) already uses the key on it. That part sits in a collapsed
 * "For administrators" section so it never gets in the agent's way.
 */

const KEY_SOURCE: Record<string, string> = {
  file: "a key file on the server",
  env: "the GOOGLE_SERVICE_ACCOUNT_KEY setting on the server",
};

export default function GoogleAccountSection({
  onStatus,
}: {
  /** Lets the connect form word its own hint for the state the server is in. */
  onStatus?: (status: GoogleCredentialStatus | null) => void;
}) {
  const [status, setStatus] = useState<GoogleCredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const publish = useCallback(
    (next: GoogleCredentialStatus | null) => {
      setStatus(next);
      onStatus?.(next);
    },
    [onStatus],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      publish(await getGoogleCredential());
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load Google status.");
    } finally {
      setLoading(false);
    }
  }, [publish]);

  useEffect(() => {
    void load();
  }, [load]);

  const onTest = async () => {
    setTesting(true);
    setError("");
    try {
      publish(await testGoogleCredential());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Test failed.");
    } finally {
      setTesting(false);
    }
  };

  const onCopy = async () => {
    if (!status?.client_email) return;
    try {
      await navigator.clipboard.writeText(status.client_email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Could not copy — select the address and copy it manually.");
    }
  };

  if (loading) {
    return (
      <div className="mb-5 rounded-xl border border-gray-200 p-4 text-sm text-gray-500 dark:border-gray-800">
        Checking Google access…
      </div>
    );
  }

  // Not switched on for this server: say what still works, and tell whoever runs
  // the server exactly how to switch it on, rather than showing an agent setup
  // steps they cannot complete.
  if (!status?.configured) {
    return (
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Private spreadsheets are not switched on for this BCRM server yet
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          Until they are, you can connect a spreadsheet shared as “Anyone with the
          link can view”. Once your administrator installs the Google key, this box
          shows the address to share private sheets with.
        </p>
        {status?.error && status.error !== DEFAULT_UNCONFIGURED ? (
          <p className="mt-1 text-xs text-error-500">{status.error}</p>
        ) : null}
        <AdminDetails>
          <p>
            BCRM reads private sheets with one Google <b>service account</b> for the
            whole server. Its key has to be on the server; agencies then share
            their sheets with the account&apos;s email as Viewer.
          </p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              <b>Server deployed by copying files</b> (rsync, scp): put the key JSON
              at <Code>secrets/google-service-account.json</Code> in the deploy
              folder, <Code>chmod 600</Code> it, and restart the containers. No
              GitHub secret is needed.
            </li>
            <li>
              <b>Server deployed through GitHub Actions</b>: add the key JSON as the
              environment secret <Code>GOOGLE_SERVICE_ACCOUNT_KEY</Code> (Settings →
              Environments → production) and deploy. The deploy writes it to the
              same file.
            </li>
            <li>
              Check the API startup log for{" "}
              <Code>google_sheets_private_access_ready</Code>, then reload this page.
            </li>
          </ol>
          <p className="mt-2">
            The Google Sheets API must be enabled in the key&apos;s Google Cloud
            project. Full steps: <Code>GOOGLE_SHEETS.md</Code> in the backend
            repository.
          </p>
        </AdminDetails>
        {error ? <p className="mt-2 text-xs text-error-500">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Connect a private spreadsheet in three steps
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Your sheet stays private — no need to publish it or make it “Anyone
            with the link”. BCRM only ever reads it; it never edits your sheet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onTest()}
          disabled={testing}
          title="Checks with Google that BCRM's key works"
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>

      <ol className="mt-3 space-y-3">
        <Step n={1} title="Share the sheet with BCRM as Viewer">
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1 text-sm text-gray-800 ring-1 ring-gray-200 dark:bg-white/10 dark:text-gray-100 dark:ring-gray-700">
              {status.client_email}
            </code>
            <button
              type="button"
              onClick={() => void onCopy()}
              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
            >
              {copied ? "Copied" : "Copy address"}
            </button>
          </div>
          <p className="mt-1.5">
            In Google Sheets: <b>Share</b> (top right) → paste this address → set it
            to <b>Viewer</b> → untick “Notify people” → <b>Share</b>. Google may warn
            that the address is outside your organisation; that is expected. Do this
            for every sheet you want to connect, including test sheets.
          </p>
        </Step>
        <Step n={2} title="Connect it here">
          Press <b>Connect a spreadsheet</b>, paste the sheet&apos;s link and press{" "}
          <b>Check access</b>. It should say <i>“shared correctly”</i>; if it says
          BCRM cannot read it, the sharing in step 1 has not been saved yet.
        </Step>
        <Step n={3} title="Map the columns and sync">
          Choose the worksheets, press <b>Analyze columns with AI</b>, check the
          Title and Location columns, then connect. The first sync runs straight
          away and then repeats on the schedule you pick; the WhatsApp assistant
          answers from what it brings in.
        </Step>
      </ol>

      {status.verified === true ? (
        <p className="mt-3 text-xs text-success-600">Connection to Google verified.</p>
      ) : null}
      {status.error ? <p className="mt-3 text-xs text-error-500">{status.error}</p> : null}
      {error ? <p className="mt-3 text-xs text-error-500">{error}</p> : null}

      <AdminDetails>
        <p>
          Private access is <b>on</b>. BCRM&apos;s Google key is loaded from{" "}
          {KEY_SOURCE[status.source] ?? "the server's configuration"}
          {status.project_id ? (
            <>
              {" "}
              (Google Cloud project <Code>{status.project_id}</Code>)
            </>
          ) : null}
          . Nothing else needs setting up — agencies only share their sheets with
          the address above.
        </p>
        <p className="mt-2">
          A GitHub secret (<Code>GOOGLE_SERVICE_ACCOUNT_KEY</Code>) is only needed if
          this server is deployed through GitHub Actions. A server deployed by
          copying files (rsync, scp) already uses the key on it. To rotate the key,
          replace it in the same place and restart; the address does not change, so
          nobody has to re-share.
        </p>
      </AdminDetails>
    </div>
  );
}

/** The backend's wording for "no key"; the amber box already says it better. */
const DEFAULT_UNCONFIGURED =
  "No Google service account is configured on this deployment. Only spreadsheets shared as “Anyone with the link can view” can be synced.";

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-500 text-[11px] font-semibold text-white">
        {n}
      </span>
      <div className="min-w-0 text-xs leading-relaxed text-gray-600 dark:text-gray-300">
        <p className="text-sm font-medium text-gray-800 dark:text-white/90">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </li>
  );
}

function AdminDetails({ children }: { children: React.ReactNode }) {
  return (
    <details className="group mt-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs leading-relaxed text-gray-600 open:pb-3 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
      <summary className="cursor-pointer select-none font-medium text-gray-700 marker:text-gray-400 dark:text-gray-200">
        For administrators — how this is set up on the server
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-gray-100 px-1 py-0.5 text-[11px] text-gray-800 dark:bg-white/10 dark:text-gray-100">
      {children}
    </code>
  );
}
