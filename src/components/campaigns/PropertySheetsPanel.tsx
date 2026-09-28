"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError } from "@/lib/api";
import GoogleAccountSection from "@/components/campaigns/GoogleAccountSection";
import { PROPERTY_FIELD_LABELS, type PropertyImportColumn } from "@/lib/properties";
import {
  analyzeSheet,
  createSheetConnection,
  deleteSheetConnection,
  listSheetConnections,
  checkSheetAccess,
  listSheetWorksheets,
  relativeTime,
  resolveSheetConflicts,
  syncSheetConnection,
  updateSheetConnection,
  type ManualConflictPolicy,
  type SheetAccessCheck,
  type SheetAnalyze,
  type SheetConnection,
  type SheetSyncResult,
  type SheetWorksheet,
} from "@/lib/propertySheets";

type Props = {
  onSynced: () => Promise<void> | void;
};

function confidenceTone(confidence: number, status: string) {
  if (status === "ignored" || !status) return "text-gray-400";
  if (confidence >= 0.9) return "text-success-600";
  if (confidence >= 0.7) return "text-amber-600";
  return "text-error-500";
}

function statusChip(status: string) {
  const map: Record<string, string> = {
    ok: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400",
    error: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
    syncing: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
    pending: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-300",
  };
  return map[status] || map.pending;
}

const inputClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";

export default function PropertySheetsPanel({ onSynced }: Props) {
  const [connections, setConnections] = useState<SheetConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");

  // --- add flow ---
  const [adding, setAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [interval, setIntervalMinutes] = useState(5);
  const [worksheets, setWorksheets] = useState<SheetWorksheet[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<string[]>([]);
  const [allWorksheets, setAllWorksheets] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [access, setAccess] = useState<SheetAccessCheck | null>(null);
  const [analysis, setAnalysis] = useState<SheetAnalyze | null>(null);
  const [columns, setColumns] = useState<PropertyImportColumn[]>([]);

  const mapping = useMemo(
    () =>
      Object.fromEntries(columns.map((c) => [c.column, c.field])) as Record<
        string,
        string | null
      >,
    [columns],
  );
  const fields = Object.values(mapping);
  const canConnect =
    Boolean(analysis) &&
    fields.includes("title") &&
    fields.includes("location") &&
    !connecting;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setConnections(await listSheetConnections());
      setError("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load sheet connections.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Connections move on their own every few minutes, so the list refreshes
  // itself rather than showing a sync that finished minutes ago.
  useEffect(() => {
    const timer = window.setInterval(() => {
      void listSheetConnections()
        .then(setConnections)
        .catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const resetAdd = useCallback(() => {
    setUrl("");
    setName("");
    setIntervalMinutes(5);
    setWorksheets([]);
    setSelectedTabs([]);
    setAllWorksheets(false);
    setAnalysis(null);
    setColumns([]);
    setAccess(null);
    setAdding(false);
  }, []);

  const onCheckAccess = async () => {
    if (!url.trim()) return;
    setChecking(true);
    setError("");
    setAccess(null);
    try {
      const result = await checkSheetAccess(url.trim());
      setAccess(result);
      // A readable sheet already told us its worksheets, so skip a second
      // round trip and let the user go straight to picking tabs.
      if (result.readable) {
        setWorksheets(result.worksheets);
        setSelectedTabs(result.worksheets.length ? [result.worksheets[0].title] : []);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not check this sheet.");
    } finally {
      setChecking(false);
    }
  };

  const onLoadWorksheets = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError("");
    try {
      const data = await listSheetWorksheets(url.trim());
      setWorksheets(data.worksheets);
      setSelectedTabs(data.worksheets.length ? [data.worksheets[0].title] : []);
    } catch (err) {
      setWorksheets([]);
      setError(err instanceof ApiError ? err.message : "Could not read this spreadsheet.");
    } finally {
      setAnalyzing(false);
    }
  };

  const onAnalyze = async () => {
    if (!url.trim()) return;
    setAnalyzing(true);
    setError("");
    try {
      const data = await analyzeSheet({
        spreadsheet_url: url.trim(),
        worksheet_tabs: allWorksheets ? [] : selectedTabs,
        all_worksheets: allWorksheets,
      });
      setAnalysis(data);
      setColumns(data.columns);
      if (!name.trim() && data.worksheets.length) setName(data.worksheets.join(", "));
    } catch (err) {
      setAnalysis(null);
      setError(err instanceof ApiError ? err.message : "Could not analyze this spreadsheet.");
    } finally {
      setAnalyzing(false);
    }
  };

  const onConnect = async () => {
    if (!analysis) return;
    setConnecting(true);
    setError("");
    try {
      const { sync } = await createSheetConnection({
        name: name.trim(),
        spreadsheet_url: url.trim(),
        worksheet_tabs: allWorksheets ? [] : selectedTabs,
        all_worksheets: allWorksheets,
        column_mapping: mapping,
        sync_interval_minutes: interval,
        sync_now: true,
      });
      setNotice(syncSummary(sync) || "Spreadsheet connected.");
      resetAdd();
      await load();
      await onSynced();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not connect this spreadsheet.");
    } finally {
      setConnecting(false);
    }
  };

  const onSyncNow = async (connection: SheetConnection) => {
    setBusyId(connection.id);
    setError("");
    try {
      const { sync } = await syncSheetConnection(connection.id);
      setNotice(syncSummary(sync) || "Sync finished.");
      await load();
      await onSynced();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Sync failed.");
    } finally {
      setBusyId("");
    }
  };

  const onToggle = async (connection: SheetConnection) => {
    setBusyId(connection.id);
    try {
      await updateSheetConnection(connection.id, { sync_enabled: !connection.sync_enabled });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this connection.");
    } finally {
      setBusyId("");
    }
  };

  const onResolveConflicts = async (connection: SheetConnection) => {
    setBusyId(connection.id);
    setError("");
    try {
      const { resolved, sync } = await resolveSheetConflicts(connection.id);
      setNotice(
        `${resolved} listing${resolved === 1 ? "" : "s"} handed to the sheet. ${
          syncSummary(sync) || ""
        }`.trim(),
      );
      await load();
      await onSynced();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not resolve conflicts.");
    } finally {
      setBusyId("");
    }
  };

  const onPolicyChange = async (
    connection: SheetConnection,
    policy: ManualConflictPolicy,
  ) => {
    setBusyId(connection.id);
    setError("");
    try {
      await updateSheetConnection(connection.id, { manual_conflict_policy: policy });
      setNotice(
        policy === "take_sheet"
          ? "This sheet will now overwrite matching listings you added by hand."
          : "Listings you added by hand will now be kept when this sheet matches them.",
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update the policy.");
    } finally {
      setBusyId("");
    }
  };

  const onDisconnect = async (connection: SheetConnection) => {
    setBusyId(connection.id);
    try {
      // Listings are kept and become ordinary manual rows, so disconnecting
      // never empties the inventory the bot answers from.
      await deleteSheetConnection(connection.id, false);
      setNotice(`Disconnected ${connection.name}. Its listings were kept.`);
      await load();
      await onSynced();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect.");
    } finally {
      setBusyId("");
    }
  };

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Google Sheets sync
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Connect one or more property spreadsheets. Each is mirrored into the
            database every few minutes, duplicates are dropped, and the bot
            answers customers from the result.
          </p>
        </div>
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Connect a spreadsheet
          </button>
        ) : null}
      </div>

      <GoogleAccountSection />

      {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-success-600">{notice}</p> : null}

      {/* ---------- add flow ---------- */}
      {adding ? (
        <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <label className="block text-sm lg:col-span-2">
              <span className="mb-1.5 block text-gray-500">Spreadsheet link</span>
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://docs.google.com/spreadsheets/d/…"
                className={inputClass}
              />
              <span className="mt-1 block text-xs text-gray-400">
                Share it as “Anyone with the link can view”, then paste it here.
              </span>
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Name (optional)</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Noida inventory"
                className={inputClass}
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Sync every</span>
              <select
                value={interval}
                onChange={(event) => setIntervalMinutes(Number(event.target.value))}
                className={inputClass}
              >
                <option value={5}>5 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
                <option value={60}>1 hour</option>
                <option value={360}>6 hours</option>
                <option value={1440}>1 day</option>
              </select>
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void onCheckAccess()}
              disabled={!url.trim() || checking}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
            >
              {checking ? "Checking…" : "Check access"}
            </button>
            <button
              type="button"
              onClick={() => void onLoadWorksheets()}
              disabled={!url.trim() || analyzing}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
            >
              {analyzing ? "Reading…" : "Reload worksheets"}
            </button>
            <button
              type="button"
              onClick={() => void onAnalyze()}
              disabled={!url.trim() || analyzing}
              className="rounded-lg bg-brand-500 px-3 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {analyzing ? "Analyzing…" : "Analyze columns with AI"}
            </button>
            <button
              type="button"
              onClick={resetAdd}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Cancel
            </button>
          </div>

          {access ? (
            <div
              className={`mt-3 rounded-lg border p-3 ${
                access.readable
                  ? "border-success-200 bg-success-50 dark:border-success-500/30 dark:bg-success-500/10"
                  : "border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10"
              }`}
            >
              {access.readable ? (
                <>
                  <p className="text-xs font-medium text-success-700 dark:text-success-400">
                    BCRM can read this spreadsheet
                    {access.access === "private"
                      ? " — shared correctly."
                      : " — it is published to the web."}
                  </p>
                  <p className="mt-1 text-xs text-success-700/80 dark:text-success-400/80">
                    {access.worksheets.length} worksheet
                    {access.worksheets.length === 1 ? "" : "s"} found.
                    {access.access === "public"
                      ? " If you would rather keep it private, share it with the address above and unpublish it."
                      : ""}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                    BCRM cannot read this spreadsheet yet
                  </p>
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                    {access.error}
                  </p>
                  {access.share_with ? (
                    <p className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
                      Share it with{" "}
                      <code className="break-all rounded bg-amber-100 px-1 py-0.5 dark:bg-amber-500/20">
                        {access.share_with}
                      </code>{" "}
                      as a Viewer, then check again.
                    </p>
                  ) : null}
                </>
              )}
            </div>
          ) : null}

          {worksheets.length ? (
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
                Worksheets
              </p>
              <label className="mb-2 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={allWorksheets}
                  onChange={(event) => setAllWorksheets(event.target.checked)}
                />
                Use every worksheet
              </label>
              {!allWorksheets ? (
                <div className="flex flex-wrap gap-2">
                  {worksheets.map((sheet) => {
                    const active = selectedTabs.includes(sheet.title);
                    return (
                      <button
                        key={sheet.gid}
                        type="button"
                        onClick={() =>
                          setSelectedTabs((prev) =>
                            active
                              ? prev.filter((item) => item !== sheet.title)
                              : [...prev, sheet.title],
                          )
                        }
                        className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                          active
                            ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15"
                            : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {sheet.title}
                        {sheet.row_count != null ? ` · ${sheet.row_count}` : ""}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {analysis ? (
            <div className="mt-5">
              <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
                <span className="text-gray-600 dark:text-gray-300">
                  {analysis.source_rows} rows · {analysis.source_columns} columns
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    analysis.llm.used
                      ? "bg-brand-50 text-brand-600 dark:bg-brand-500/15"
                      : "bg-gray-100 text-gray-500 dark:bg-white/10"
                  }`}
                >
                  {analysis.llm.used
                    ? `AI mapped from ${analysis.llm.sample_rows ?? 0} sample rows`
                    : "Rule-based mapping (AI unavailable)"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-white/[0.03]">
                    <tr>
                      <th className="px-3 py-2">Sheet column</th>
                      <th className="px-3 py-2">Sample values</th>
                      <th className="px-3 py-2">Maps to</th>
                      <th className="px-3 py-2">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {columns.map((column, index) => (
                      <tr key={column.column}>
                        <td className="px-3 py-2 font-medium text-gray-800 dark:text-white/90">
                          {column.column}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">
                          {(column.examples || []).slice(0, 2).join(", ") || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={column.field ?? ""}
                            onChange={(event) => {
                              const field = event.target.value || null;
                              setColumns((prev) =>
                                prev.map((item, i) =>
                                  i === index
                                    ? { ...item, field, source: "user", confidence: 1 }
                                    : // One field cannot claim two columns.
                                      field && item.field === field
                                      ? { ...item, field: null }
                                      : item,
                                ),
                              );
                            }}
                            className="w-full rounded-md border border-gray-300 bg-transparent px-2 py-1 text-sm dark:border-gray-700 dark:text-white/90"
                          >
                            <option value="">Ignore (keep as extra info)</option>
                            {analysis.allowed_fields.map((field) => (
                              <option key={field} value={field}>
                                {PROPERTY_FIELD_LABELS[field] || field}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td
                          className={`px-3 py-2 text-xs ${confidenceTone(
                            column.confidence,
                            column.status,
                          )}`}
                        >
                          {Math.round((column.confidence || 0) * 100)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Ignored columns are still stored with each listing and searched by
                the bot — they just do not fill a specific field.
              </p>

              {!canConnect && !connecting ? (
                <p className="mt-2 text-xs text-amber-600">
                  Map both Title and Location to continue.
                </p>
              ) : null}

              <button
                type="button"
                onClick={() => void onConnect()}
                disabled={!canConnect}
                className="mt-3 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect and sync now"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* ---------- connection list ---------- */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading connections…</p>
      ) : connections.length === 0 && !adding ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No spreadsheets connected yet.
        </p>
      ) : (
        <div className="space-y-3">
          {connections.map((connection) => (
            <div
              key={connection.id}
              className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-medium text-gray-800 dark:text-white/90">
                      {connection.name}
                    </p>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusChip(
                        connection.sync_status,
                      )}`}
                    >
                      {connection.sync_status}
                    </span>
                    {!connection.sync_enabled ? (
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500 dark:bg-white/10">
                        paused
                      </span>
                    ) : null}
                  </div>
                  <a
                    href={connection.spreadsheet_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 block truncate text-xs text-brand-500 hover:underline"
                  >
                    {connection.spreadsheet_url}
                  </a>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {connection.property_count} listings · every{" "}
                    {connection.sync_interval_minutes} min · last{" "}
                    {relativeTime(connection.last_sync_at)} · next{" "}
                    {connection.sync_enabled ? relativeTime(connection.next_sync_at) : "—"}
                  </p>
                  {connection.last_sync_at ? (
                    <p className="mt-1 text-xs text-gray-400">
                      {connection.last_row_count} rows read · {connection.last_created} added ·{" "}
                      {connection.last_updated} updated · {connection.last_removed} removed ·{" "}
                      {connection.last_duplicates} duplicates dropped
                      {connection.last_adopted > 0
                        ? ` · ${connection.last_adopted} taken over`
                        : ""}
                    </p>
                  ) : null}
                  {connection.last_error ? (
                    <p className="mt-1 text-xs text-error-500">{connection.last_error}</p>
                  ) : null}

                  {connection.last_blocked > 0 ? (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                      <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                        {connection.last_blocked} row
                        {connection.last_blocked === 1 ? "" : "s"} in this sheet
                        match{connection.last_blocked === 1 ? "es" : ""} a listing you
                        added by hand, so {connection.last_blocked === 1 ? "it was" : "they were"}{" "}
                        not imported.
                      </p>
                      <ul className="mt-2 space-y-0.5">
                        {connection.last_conflicts.map((conflict) => (
                          <li
                            key={conflict.property_id}
                            className="text-xs text-amber-700 dark:text-amber-400"
                          >
                            • {conflict.title}
                            {conflict.location ? ` — ${conflict.location}` : ""}
                          </li>
                        ))}
                        {connection.last_blocked > connection.last_conflicts.length ? (
                          <li className="text-xs text-amber-700 dark:text-amber-400">
                            • and{" "}
                            {connection.last_blocked - connection.last_conflicts.length} more
                          </li>
                        ) : null}
                      </ul>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onResolveConflicts(connection)}
                          disabled={busyId === connection.id}
                          className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                        >
                          Use the sheet&rsquo;s version
                        </button>
                        <span className="text-xs text-amber-700 dark:text-amber-400">
                          or keep yours and edit the sheet.
                        </span>
                      </div>
                    </div>
                  ) : null}

                  <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                    <span>When a row matches a listing I added by hand:</span>
                    <select
                      value={connection.manual_conflict_policy}
                      onChange={(event) =>
                        void onPolicyChange(
                          connection,
                          event.target.value as ManualConflictPolicy,
                        )
                      }
                      disabled={busyId === connection.id}
                      className="rounded-md border border-gray-300 bg-transparent px-2 py-1 text-xs disabled:opacity-50 dark:border-gray-700 dark:text-white/90"
                    >
                      <option value="keep_manual">keep mine</option>
                      <option value="take_sheet">let the sheet win</option>
                    </select>
                  </label>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void onSyncNow(connection)}
                    disabled={busyId === connection.id}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    {busyId === connection.id ? "Syncing…" : "Sync now"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onToggle(connection)}
                    disabled={busyId === connection.id}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/5"
                  >
                    {connection.sync_enabled ? "Pause" : "Resume"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDisconnect(connection)}
                    disabled={busyId === connection.id}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-error-500 hover:bg-error-50 disabled:opacity-50 dark:hover:bg-error-500/10"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function syncSummary(sync: SheetSyncResult | null): string {
  if (!sync) return "";
  if (sync.error) return `Sync failed: ${sync.error}`;
  const parts = [
    `${sync.created ?? 0} added`,
    `${sync.updated ?? 0} updated`,
    `${sync.removed ?? 0} removed`,
    `${sync.duplicates ?? 0} duplicates dropped`,
  ];
  if (sync.adopted) parts.push(`${sync.adopted} taken over`);
  // Surfaced in the summary, not just the banner: this is the one outcome
  // where rows the user expected to see are deliberately absent.
  if (sync.blocked) parts.push(`${sync.blocked} held back by your own listings`);
  return `Synced ${sync.rows ?? 0} rows — ${parts.join(", ")}.`;
}
