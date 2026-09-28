"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  getGoogleCredential,
  testGoogleCredential,
  type GoogleCredentialStatus,
} from "@/lib/propertySheets";

/**
 * How to let BCRM read a private spreadsheet.
 *
 * There is one service account for the whole deployment, so there is nothing
 * here for a customer to configure — only an address to copy and a sharing step
 * to follow. That address is the entire setup, which is why it is the largest
 * thing on the panel.
 */
export default function GoogleAccountSection() {
  const [status, setStatus] = useState<GoogleCredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getGoogleCredential());
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load Google status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onTest = async () => {
    setTesting(true);
    try {
      setStatus(await testGoogleCredential());
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

  // Nothing configured on the deployment: say so plainly and tell the user what
  // still works, rather than showing setup steps they cannot complete.
  if (!status?.configured) {
    return (
      <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
          Private spreadsheets are not available on this deployment
        </p>
        <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
          You can still sync any spreadsheet shared as “Anyone with the link can
          view”. Ask your BCRM administrator to configure a Google service account
          to enable private sheets.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Using a private spreadsheet
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            You do not need to publish your sheet to the web. Share it with the
            address below and BCRM can read it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onTest()}
          disabled={testing}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
        >
          {testing ? "Testing…" : "Test connection"}
        </button>
      </div>

      <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center gap-2">
          <code className="break-all rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 dark:bg-white/10 dark:text-gray-100">
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
        <ol className="mt-3 list-decimal space-y-1 pl-4 text-xs text-gray-600 dark:text-gray-300">
          <li>Open your spreadsheet in Google Sheets.</li>
          <li>
            Click <b>Share</b>, top right.
          </li>
          <li>Paste the address above and set it to <b>Viewer</b>.</li>
          <li>
            Click <b>Send</b>. Google may warn it is outside your organisation —
            that is expected.
          </li>
          <li>Come back here, paste the sheet link, and press Check access.</li>
        </ol>
      </div>

      {status.verified === true ? (
        <p className="mt-2 text-xs text-success-600">
          Connection to Google verified.
        </p>
      ) : null}
      {status.error ? (
        <p className="mt-2 text-xs text-error-500">{status.error}</p>
      ) : null}
      {error ? <p className="mt-2 text-xs text-error-500">{error}</p> : null}
    </div>
  );
}
