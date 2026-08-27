"use client";

import { useCallback, useMemo, useState, type DragEvent } from "react";
import { CheckCircleIcon, ShootingStarIcon } from "@/icons";
import { ApiError } from "@/lib/api";
import {
  analyzePropertyImport,
  commitPropertyImport,
  PROPERTY_FIELD_LABELS,
  type PropertyImportAnalyze,
  type PropertyImportColumn,
  type PropertyImportCommit,
} from "@/lib/properties";

type Props = {
  onImported: () => Promise<void> | void;
};

function fileLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function confidenceTone(confidence: number, status: string) {
  if (status === "ignored" || !status) return "text-gray-400";
  if (confidence >= 0.9) return "text-success-600";
  if (confidence >= 0.7) return "text-amber-600";
  return "text-error-500";
}

export default function PropertyImportPanel({ onImported }: Props) {
  const [open, setOpen] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<PropertyImportAnalyze | null>(null);
  const [columns, setColumns] = useState<PropertyImportColumn[]>([]);
  const [result, setResult] = useState<PropertyImportCommit | null>(null);

  const mapping = useMemo(
    () =>
      Object.fromEntries(columns.map((column) => [column.column, column.field])) as Record<
        string,
        string | null
      >,
    [columns],
  );
  const mappedTitle = Object.values(mapping).includes("title");
  const mappedLocation = Object.values(mapping).includes("location");
  const canImport = Boolean(file && mappedTitle && mappedLocation && !analyzing && !importing);

  const resetFlow = useCallback(() => {
    setFile(null);
    setAnalysis(null);
    setColumns([]);
    setError("");
  }, []);

  const runAnalyze = useCallback(async (nextFile: File) => {
    setAnalyzing(true);
    setError("");
    setResult(null);
    setAnalysis(null);
    setColumns([]);
    try {
      const next = await analyzePropertyImport(nextFile);
      setAnalysis(next);
      setColumns(next.columns);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not map columns from that file.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const takeFile = useCallback(
    (next: File | null) => {
      if (!next) return;
      setOpen(true);
      setFile(next);
      void runAnalyze(next);
    },
    [runAnalyze],
  );

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    takeFile(event.dataTransfer.files?.[0] ?? null);
  };

  const setField = (columnName: string, field: string | null) => {
    setColumns((current) =>
      current.map((column) => {
        if (column.column === columnName) {
          return {
            ...column,
            field,
            confidence: field ? 1 : 0,
            status: field ? "accepted" : "ignored",
            source: "user",
            reason: field ? "Confirmed in the mapping review" : "Skipped",
          };
        }
        if (field && column.field === field) {
          return {
            ...column,
            field: null,
            status: "needs_user",
            reason: "Cleared — each inventory field can only be used once",
          };
        }
        return column;
      }),
    );
  };

  const runImport = async () => {
    if (!file || !canImport) return;
    setImporting(true);
    setError("");
    try {
      const committed = await commitPropertyImport(file, mapping);
      setResult(committed);
      await onImported();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed. Check the mapping and try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white/90">Mass upload</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Drop a CSV or Excel file. AI maps spreadsheet columns to inventory fields, then writes a
            completion note.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
        >
          {open ? "Hide upload" : "Mass upload"}
        </button>
      </div>

      {open ? (
        <div className="space-y-5 px-5 py-5">
          <label
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setIsDragging(false);
            }}
            onDrop={handleDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center transition ${
              isDragging
                ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                : "border-gray-300 bg-gray-50 hover:border-brand-400 dark:border-gray-700 dark:bg-white/[0.02]"
            }`}
          >
            <input
              type="file"
              accept=".csv,.tsv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(event) => {
                takeFile(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
              className="hidden"
            />
            <ShootingStarIcon className="h-7 w-7 text-brand-500" />
            <p className="mt-3 text-sm font-medium text-gray-800 dark:text-white/90">
              Drop CSV or Excel here, or click to browse
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Headers are mapped with an LLM. Title and location are required.
            </p>
          </label>

          {file ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                  {file.name}
                </p>
                <p className="text-xs text-gray-500">
                  {fileLabel(file.size)}
                  {analysis
                    ? ` · ${analysis.source_rows} rows · ${analysis.source_columns} columns`
                    : analyzing
                      ? " · AI is mapping columns…"
                      : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={resetFlow}
                className="shrink-0 text-xs font-medium text-error-500 hover:underline"
              >
                Remove
              </button>
            </div>
          ) : null}

          {analyzing ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              EstateFlow AI is reading headers and mapping them to the property database…
            </p>
          ) : null}

          {error ? <p className="text-sm text-error-500">{error}</p> : null}

          {result ? (
            <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-4 dark:border-success-500/20 dark:bg-success-500/10">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircleIcon className="h-5 w-5 text-success-600" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white/90">
                  AI import note
                </p>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-success-700 dark:bg-white/10 dark:text-success-400">
                  {result.note_source === "llm" ? "Generated by AI" : "Import summary"}
                </span>
              </div>
              <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">{result.note}</p>
              <p className="mt-3 text-xs text-gray-500">
                Saved {result.imported} listing{result.imported === 1 ? "" : "s"}
                {result.skipped ? ` · skipped ${result.skipped}` : ""} · {result.stats.rent} rent ·{" "}
                {result.stats.sale} sale
              </p>
            </div>
          ) : null}

          {columns.length ? (
            <div>
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    Column mapping
                  </h3>
                  <p className="text-xs text-gray-500">
                    Confirm each spreadsheet column. Title and location must be mapped.
                    {analysis?.llm.used ? " AI suggestions are marked below." : ""}
                  </p>
                </div>
                {!mappedTitle || !mappedLocation ? (
                  <p className="text-xs font-medium text-amber-600">
                    Map Title and Location to continue
                  </p>
                ) : null}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-xs uppercase text-gray-500">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Spreadsheet</th>
                      <th className="py-2 pr-3 font-medium">Sample</th>
                      <th className="py-2 pr-3 font-medium">Inventory field</th>
                      <th className="py-2 font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {columns.map((column) => (
                      <tr key={column.column}>
                        <td className="py-3 pr-3">
                          <p className="font-medium text-gray-800 dark:text-white/90">
                            {column.column}
                          </p>
                          <p className="text-xs text-gray-400">
                            {column.source === "llm"
                              ? "AI mapped"
                              : column.source === "user"
                                ? "You confirmed"
                                : column.reason}
                          </p>
                        </td>
                        <td className="max-w-[180px] truncate py-3 pr-3 text-gray-500">
                          {column.examples?.[0] || "—"}
                        </td>
                        <td className="py-3 pr-3">
                          <select
                            value={column.field || ""}
                            onChange={(event) =>
                              setField(column.column, event.target.value || null)
                            }
                            className="h-10 w-full min-w-[180px] rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
                          >
                            <option value="">Don’t import</option>
                            {(analysis?.allowed_fields || Object.keys(PROPERTY_FIELD_LABELS)).map(
                              (field) => (
                                <option key={field} value={field}>
                                  {PROPERTY_FIELD_LABELS[field] || field}
                                </option>
                              ),
                            )}
                          </select>
                        </td>
                        <td className={`py-3 ${confidenceTone(column.confidence, column.status)}`}>
                          {column.field ? `${Math.round(column.confidence * 100)}%` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {analysis?.preview?.length ? (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
                    Preview of mapped listings
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Title</th>
                          <th className="px-3 py-2 font-medium">Location</th>
                          <th className="px-3 py-2 font-medium">BHK</th>
                          <th className="px-3 py-2 font-medium">Listing</th>
                          <th className="px-3 py-2 font-medium">Price</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {analysis.preview.map((row, index) => (
                          <tr key={`${String(row.title)}-${index}`}>
                            <td className="px-3 py-2 text-gray-800 dark:text-white/90">
                              {String(row.title || "—")}
                            </td>
                            <td className="px-3 py-2 text-gray-500">{String(row.location || "—")}</td>
                            <td className="px-3 py-2 text-gray-500">{String(row.bhk || "—")}</td>
                            <td className="px-3 py-2 text-gray-500">
                              {String(row.listing_type || "—")}
                            </td>
                            <td className="px-3 py-2 text-gray-500">
                              {String(row.price_label || "—")}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                disabled={!canImport}
                onClick={() => void runImport()}
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                <ShootingStarIcon className="h-5 w-5" />
                {importing
                  ? "Importing listings…"
                  : `Import ${analysis?.source_rows ?? ""} listings`}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
