"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ContactsAssistantChat from "@/components/campaigns/ContactsAssistantChat";
import Badge from "@/components/ui/badge/Badge";
import { CheckCircleIcon, GroupIcon, ShootingStarIcon } from "@/icons";
import { ApiError } from "@/lib/api";
import {
  analyzeContacts,
  createContactDataset,
  dropDatasetDuplicates,
  getContactStats,
  getDatasetDuplicateReport,
  inspectGoogleSheet,
  listContactDatasets,
  previewDatasetMerge,
  type AvailableColumn,
  type ContactDataset,
  type ContactDatasetSummary,
  type ContactDatasetWriteResult,
  type ContactIntelligenceResult,
  type ContactStats,
  type DatasetDuplicateReport,
  type DatasetMergePreview,
  type GoogleWorksheetInfo,
  type MatchingDatasetPreview,
} from "@/lib/contactIntelligence";

function GoogleSheetsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
        fill="#0F9D58"
      />
      <path d="M14 2V8H20" fill="#87CEAC" />
      <path
        d="M8 12H16M8 15H16M8 18H13"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type SourceMode = "csv" | "sheet";
type MergeMode = "create_new" | "merge";

export default function ContactsPage() {
  const [csvPayload, setCsvPayload] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSizeLabel, setFileSizeLabel] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [worksheets, setWorksheets] = useState<GoogleWorksheetInfo[]>([]);
  const [selectedSheetTitles, setSelectedSheetTitles] = useState<string[]>([]);
  const [selectAllSheets, setSelectAllSheets] = useState(false);
  const [loadingSheets, setLoadingSheets] = useState(false);
  const [lastSourceMode, setLastSourceMode] = useState<SourceMode>("csv");
  const [tableName, setTableName] = useState("");
  const [notice, setNotice] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [analysis, setAnalysis] = useState<ContactIntelligenceResult | null>(null);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [mergePreview, setMergePreview] = useState<DatasetMergePreview | null>(null);
  const [mergeMode, setMergeMode] = useState<MergeMode>("create_new");
  const [targetDatasetId, setTargetDatasetId] = useState<string>("");
  const [columnMapping, setColumnMapping] = useState<Record<string, string | null>>({});
  const [addUnmappedColumns, setAddUnmappedColumns] = useState(true);
  const [alsoImportToContacts, setAlsoImportToContacts] = useState(false);
  const [writeResult, setWriteResult] = useState<ContactDatasetWriteResult | null>(null);
  const [droppingDuplicates, setDroppingDuplicates] = useState(false);
  const [createdDataset, setCreatedDataset] = useState<ContactDataset | null>(null);
  const [datasets, setDatasets] = useState<ContactDatasetSummary[]>([]);
  const [duplicateReport, setDuplicateReport] = useState<DatasetDuplicateReport | null>(
    null,
  );
  const [stats, setStats] = useState<ContactStats | null>(null);
  const [droppingDatasetId, setDroppingDatasetId] = useState<string | null>(null);

  const plan = analysis?.import_plan;
  const availableColumns: AvailableColumn[] = useMemo(() => {
    if (plan?.available_columns?.length) return plan.available_columns;
    return Object.values(analysis?.inferred_mapping || {}).map((item) => ({
      name: item.column,
      field: item.field,
      confidence: item.confidence,
      status: item.status,
      suggested: item.status === "accepted" || item.status === "review",
    }));
  }, [analysis, plan]);

  const selectedMatch: MatchingDatasetPreview | null = useMemo(() => {
    if (!mergePreview || !targetDatasetId) return null;
    return mergePreview.matches.find((item) => item.id === targetDatasetId) || null;
  }, [mergePreview, targetDatasetId]);

  const refreshLists = useCallback(async () => {
    setLoadingList(true);
    try {
      const [datasetList, contactStats, dupReport] = await Promise.all([
        listContactDatasets(),
        getContactStats(),
        getDatasetDuplicateReport(),
      ]);
      setDatasets(datasetList);
      setStats(contactStats);
      setDuplicateReport(dupReport);
    } catch (error) {
      setNotice(
        error instanceof ApiError
          ? error.message
          : "Could not load datasets from the API.",
      );
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const formatBytes = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  const resetMergeState = () => {
    setMergePreview(null);
    setMergeMode("create_new");
    setTargetDatasetId("");
    setColumnMapping({});
    setAddUnmappedColumns(true);
    setAlsoImportToContacts(false);
    setWriteResult(null);
  };

  const acceptCsvFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv") {
      setNotice("Only CSV files are supported. Export Excel/Sheets as CSV first.");
      return;
    }

    // Keep payload in memory for API calls only — never render raw CSV in the UI.
    const text = await file.text();
    setCsvPayload(text);
    setFileName(file.name);
    setFileSizeLabel(formatBytes(file.size));
    setTableName(file.name.replace(/\.csv$/i, ""));
    setAnalysis(null);
    setSelectedColumns([]);
    setCreatedDataset(null);
    resetMergeState();
    setNotice(`${file.name} ready. File contents stay hidden — analyze with LLM next.`);
  };

  const handleFileInput = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await acceptCsvFile(file);
    event.target.value = "";
  };

  const handleDrop = async (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (!file) return;
    await acceptCsvFile(file);
  };

  const clearCsvFile = () => {
    setCsvPayload(null);
    setFileName(null);
    setFileSizeLabel(null);
  };

  const loadGoogleSheets = async () => {
    const url = sheetUrl.trim();
    if (!url.includes("docs.google.com/spreadsheets")) {
      setNotice("Enter a valid Google Spreadsheet URL first.");
      return;
    }
    setLoadingSheets(true);
    setWorksheets([]);
    setSelectedSheetTitles([]);
    setSelectAllSheets(false);
    setAnalysis(null);
    setSelectedColumns([]);
    resetMergeState();
    try {
      const result = await inspectGoogleSheet(url);
      setWorksheets(result.worksheets);
      if (result.worksheets[0]) {
        setSelectedSheetTitles([result.worksheets[0].title]);
      }
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Could not load worksheets.");
    } finally {
      setLoadingSheets(false);
    }
  };

  const toggleSheetTitle = (title: string) => {
    setSelectAllSheets(false);
    setSelectedSheetTitles((current) =>
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title],
    );
  };

  const runAnalysis = async (source: SourceMode) => {
    setAnalyzing(true);
    setAnalysis(null);
    setSelectedColumns([]);
    setCreatedDataset(null);
    resetMergeState();
    setLastSourceMode(source);

    try {
      let result: ContactIntelligenceResult;

      if (source === "sheet") {
        const url = sheetUrl.trim();
        if (!url.includes("docs.google.com/spreadsheets")) {
          throw new ApiError("Enter a valid Google Spreadsheet URL.", 400);
        }
        if (!worksheets.length) {
          throw new ApiError("Load worksheets first, then select sheet number(s).", 400);
        }
        if (!selectAllSheets && selectedSheetTitles.length === 0) {
          throw new ApiError("Select at least one worksheet, or choose all sheets.", 400);
        }
        result = await analyzeContacts({
          google_sheet_url: url,
          worksheet_tabs: selectAllSheets ? undefined : selectedSheetTitles,
          all_worksheets: selectAllSheets,
          auto_import: false,
        });
      } else {
        if (!csvPayload || !fileName) {
          throw new ApiError("Drop or choose a CSV file first.", 400);
        }
        result = await analyzeContacts({
          raw_csv: csvPayload,
          file_name: fileName,
          auto_import: false,
        });
      }

      setAnalysis(result);
      const columns = result.import_plan.available_columns?.length
        ? result.import_plan.available_columns
        : Object.values(result.inferred_mapping || {}).map((item) => ({
            name: item.column,
            suggested: item.status === "accepted" || item.status === "review",
          }));

      const suggested = columns
        .filter((column) => column.suggested)
        .map((column) => column.name);
      setSelectedColumns(suggested.length ? suggested : columns.map((column) => column.name));
      setNotice(
        source === "sheet"
          ? "Google Sheet analyzed with LLM metadata mapping. Choose columns to store."
          : "CSV analyzed with LLM metadata mapping. Choose columns to store — raw rows stay hidden.",
      );
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleColumn = (column: string) => {
    setSelectedColumns((current) =>
      current.includes(column)
        ? current.filter((item) => item !== column)
        : [...current, column],
    );
    resetMergeState();
  };

  const selectAllColumns = () => {
    setSelectedColumns(availableColumns.map((column) => column.name));
    resetMergeState();
  };

  const selectSuggestedColumns = () => {
    const suggested = availableColumns
      .filter((column) => column.suggested)
      .map((column) => column.name);
    setSelectedColumns(suggested.length ? suggested : availableColumns.map((c) => c.name));
    resetMergeState();
  };

  const applyMatch = (match: MatchingDatasetPreview) => {
    setMergeMode("merge");
    setTargetDatasetId(match.id);
    const mapping: Record<string, string | null> = {};
    for (const item of match.mappings) {
      mapping[item.source_column] = item.target_column;
    }
    setColumnMapping(mapping);
  };

  const continueToMergeOptions = async () => {
    if (!selectedColumns.length) {
      setNotice("Select at least one column first.");
      return;
    }
    setPreviewing(true);
    try {
      const preview = await previewDatasetMerge({
        selected_columns: selectedColumns,
        name: tableName.trim() || undefined,
      });
      setMergePreview(preview);
      if (preview.has_matches && preview.matches[0]) {
        applyMatch(preview.matches[0]);
        setNotice(preview.message);
      } else {
        setMergeMode("create_new");
        setTargetDatasetId("");
        setColumnMapping({});
        setNotice("No similar tables found. You can create a new table.");
      }
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Merge preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const sourcePayload = () =>
    lastSourceMode === "sheet"
      ? {
          google_sheet_url: sheetUrl.trim(),
          worksheet_tabs: selectAllSheets ? undefined : selectedSheetTitles,
          all_worksheets: selectAllSheets,
        }
      : {
          raw_csv: csvPayload || "",
          file_name: fileName || "uploaded-contacts.csv",
        };

  const createOrMergeTable = async () => {
    if (!selectedColumns.length) {
      setNotice("Select at least one column to create a table.");
      return;
    }
    if (mergeMode === "merge" && !targetDatasetId) {
      setNotice("Pick an existing table to merge into, or choose Create new table.");
      return;
    }
    if (lastSourceMode === "csv" && !csvPayload) {
      setNotice("Drop a CSV file before creating or merging a table.");
      return;
    }

    setCreating(true);
    try {
      const result = await createContactDataset({
        name: tableName.trim() || undefined,
        selected_columns: selectedColumns,
        ...sourcePayload(),
        merge_mode: mergeMode,
        target_dataset_id: mergeMode === "merge" ? targetDatasetId : undefined,
        column_mapping: mergeMode === "merge" ? columnMapping : undefined,
        add_unmapped_columns: addUnmappedColumns,
        also_import_to_contacts: alsoImportToContacts,
      });

      setWriteResult(result);
      setCreatedDataset(result.dataset);

      const parts = [
        result.action === "merged"
          ? `Merged ${result.rows_added} rows into “${result.dataset.name}”.`
          : `Created table “${result.dataset.name}” with ${result.rows_added} rows.`,
      ];
      if (result.columns_added.length) {
        parts.push(`Added columns: ${result.columns_added.join(", ")}.`);
      }
      if (result.unmapped_columns_skipped.length) {
        parts.push(`Skipped unmapped: ${result.unmapped_columns_skipped.join(", ")}.`);
      }
      if (result.also_imported_to_contacts) {
        parts.push(`CRM contacts created: ${result.contacts_created}.`);
      }
      if (result.duplicates.has_duplicates && result.duplicates.warning) {
        parts.push(result.duplicates.warning);
      }
      setNotice(parts.join(" "));
      await refreshLists();
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Failed to create/merge table.");
    } finally {
      setCreating(false);
    }
  };

  const keepDuplicates = () => {
    setNotice("Duplicates kept in the table. You can drop them later from this warning.");
  };

  const dropDuplicates = async (datasetId?: string) => {
    const id = datasetId || createdDataset?.id;
    if (!id) {
      setNotice("No table available to drop duplicates from.");
      return;
    }
    setDroppingDuplicates(true);
    setDroppingDatasetId(id);
    try {
      const result = await dropDatasetDuplicates(id);
      if (createdDataset?.id === id) {
        setCreatedDataset(result.dataset);
        setWriteResult((current) =>
          current
            ? {
                ...current,
                dataset: result.dataset,
                duplicates: {
                  ...current.duplicates,
                  has_duplicates: false,
                  duplicate_count: 0,
                  duplicates_against_existing: [],
                  duplicates_within_import: [],
                  warning: null,
                },
              }
            : current,
        );
      }
      setNotice(result.message);
      await refreshLists();
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Failed to drop duplicates.",
      );
    } finally {
      setDroppingDuplicates(false);
      setDroppingDatasetId(null);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Contacts" />

      <ContactsAssistantChat />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-1 text-sm font-medium text-brand-500">Contact Intelligence</p>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Select columns, then merge or create.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            If a similar table already exists, choose how to merge (or skip merging). Map
            columns, optionally add to CRM contacts, and get duplicate warnings after save.
          </p>
        </div>
        <Badge color="info" size="sm">
          Analyze · Select · Merge/Create
        </Badge>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          [String(plan?.source_columns ?? "—"), "Columns found"],
          [String(selectedColumns.length || "—"), "Selected"],
          [String(createdDataset?.row_count ?? datasets[0]?.row_count ?? "—"), "Latest rows"],
          [
            String(duplicateReport?.total_duplicate_rows ?? "—"),
            "Duplicates in DB",
          ],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">{value}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-6 xl:col-span-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#E8F5E9]">
                <GoogleSheetsIcon />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white/90">
                  Google Spreadsheet
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Paste link → choose sheet number(s) or all → analyze with LLM.
                </p>
              </div>
            </div>

            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Spreadsheet URL
            </label>
            <input
              value={sheetUrl}
              onChange={(event) => {
                setSheetUrl(event.target.value);
                setWorksheets([]);
                setSelectedSheetTitles([]);
                setSelectAllSheets(false);
              }}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="mb-4 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
            />

            <button
              type="button"
              disabled={loadingSheets}
              onClick={() => void loadGoogleSheets()}
              className="mb-4 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#0F9D58] px-4 py-2.5 text-sm font-medium text-[#0F9D58] transition hover:bg-[#E8F5E9] disabled:opacity-50"
            >
              {loadingSheets ? "Loading sheets…" : "Load worksheets"}
            </button>

            {!!worksheets.length && (
              <div className="mb-4 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    Choose sheet number(s)
                  </p>
                  <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={selectAllSheets}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setSelectAllSheets(checked);
                        setSelectedSheetTitles(
                          checked ? worksheets.map((sheet) => sheet.title) : [],
                        );
                      }}
                    />
                    Select all sheets
                  </label>
                </div>
                <div className="space-y-2">
                  {worksheets.map((sheet) => {
                    const checked =
                      selectAllSheets || selectedSheetTitles.includes(sheet.title);
                    return (
                      <label
                        key={`${sheet.index}-${sheet.gid}`}
                        className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 hover:bg-gray-50 dark:hover:bg-white/[0.03]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={selectAllSheets}
                          onChange={() => toggleSheetTitle(sheet.title)}
                          className="mt-0.5"
                        />
                        <span className="text-sm">
                          <span className="font-medium text-gray-900 dark:text-white/90">
                            Sheet {sheet.index}: {sheet.title}
                          </span>
                          <span className="mt-0.5 block text-xs text-gray-500">
                            {typeof sheet.row_count === "number"
                              ? `${sheet.row_count} sample rows`
                              : `gid ${sheet.gid}`}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={analyzing || !worksheets.length}
              onClick={() => void runAnalysis("sheet")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#0F9D58] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0B8043] disabled:opacity-50"
            >
              <ShootingStarIcon className="h-5 w-5" />
              {analyzing ? "Analyzing with LLM…" : "Analyze selected sheets"}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/10">
                <GroupIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white/90">
                  CSV file import
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Drop a CSV from your files. Raw rows are never shown in the UI —
                  LLM uses headers and column metadata only.
                </p>
              </div>
            </div>

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
              onDrop={(event) => void handleDrop(event)}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-10 text-center transition ${
                isDragging
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-300 bg-gray-50 hover:border-brand-400 dark:border-gray-700 dark:bg-white/[0.02]"
              }`}
            >
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => void handleFileInput(event)}
                className="hidden"
              />
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                Drop CSV here, or click to browse
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Folders/files from disk only · no paste · contents stay hidden
              </p>
            </label>

            {fileName && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 dark:border-gray-700">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                    {fileName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {fileSizeLabel || "Ready"} · contents not displayed
                  </p>
                </div>
                <button
                  type="button"
                  onClick={clearCsvFile}
                  className="shrink-0 text-xs font-medium text-error-500 hover:underline"
                >
                  Remove
                </button>
              </div>
            )}

            <button
              type="button"
              disabled={analyzing || !csvPayload}
              onClick={() => void runAnalysis("csv")}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              <ShootingStarIcon className="h-5 w-5" />
              {analyzing ? "Analyzing with LLM…" : "Analyze with LLM"}
            </button>
          </section>
        </div>

        <div className="col-span-12 space-y-6 xl:col-span-8">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-white/90">
                  1. All columns
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose which columns to store.
                </p>
              </div>
              {!!availableColumns.length && (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectSuggestedColumns}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Suggested
                  </button>
                  <button
                    type="button"
                    onClick={selectAllColumns}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Select all
                  </button>
                </div>
              )}
            </div>

            {!availableColumns.length ? (
              <div className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">
                Drop a CSV or analyze a Google Sheet to list columns (raw row data stays hidden).
              </div>
            ) : (
              <>
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-gray-500">
                      <tr>
                        <th className="py-2 pr-3 font-medium">Store</th>
                        <th className="py-2 pr-3 font-medium">Column</th>
                        <th className="py-2 pr-3 font-medium">Suggested map</th>
                        <th className="py-2 font-medium">Confidence</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {availableColumns.map((column) => {
                        const checked = selectedColumns.includes(column.name);
                        return (
                          <tr key={column.name}>
                            <td className="py-3 pr-3">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleColumn(column.name)}
                                className="h-4 w-4 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                              />
                            </td>
                            <td className="py-3 pr-3 font-medium text-gray-800 dark:text-white/90">
                              {column.name}
                            </td>
                            <td className="py-3 pr-3 text-gray-500">{column.field || "—"}</td>
                            <td className="py-3 text-gray-500">
                              {typeof column.confidence === "number"
                                ? `${Math.round(column.confidence * 100)}%`
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-end dark:border-gray-800">
                  <label className="flex-1 text-sm font-medium text-gray-700 dark:text-gray-300">
                    Table name
                    <input
                      value={tableName}
                      onChange={(event) => setTableName(event.target.value)}
                      placeholder="e.g. March buyer list"
                      className="mt-2 h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={previewing || selectedColumns.length === 0}
                    onClick={() => void continueToMergeOptions()}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
                  >
                    {previewing ? "Checking…" : "Continue to merge options"}
                  </button>
                </div>
              </>
            )}
          </section>

          {mergePreview && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-white/90">
                  2. Merge or create new
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {mergePreview.message}
                </p>
              </div>

              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <input
                    type="radio"
                    name="mergeMode"
                    checked={mergeMode === "create_new"}
                    onChange={() => {
                      setMergeMode("create_new");
                      setTargetDatasetId("");
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-gray-900 dark:text-white/90">
                      Do not merge
                    </span>
                    <span className="text-sm text-gray-500">
                      Create a fresh table with the selected columns.
                    </span>
                  </span>
                </label>
                <label className="flex cursor-pointer gap-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <input
                    type="radio"
                    name="mergeMode"
                    checked={mergeMode === "merge"}
                    disabled={!mergePreview.has_matches}
                    onChange={() => {
                      if (mergePreview.matches[0]) applyMatch(mergePreview.matches[0]);
                    }}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-gray-900 dark:text-white/90">
                      Merge into existing table
                    </span>
                    <span className="text-sm text-gray-500">
                      Map columns into a similar saved table.
                    </span>
                  </span>
                </label>
              </div>

              {mergeMode === "merge" && (
                <>
                  <div className="mb-4 space-y-2">
                    {mergePreview.matches.map((match) => (
                      <button
                        key={match.id}
                        type="button"
                        onClick={() => applyMatch(match)}
                        className={`w-full rounded-xl border px-4 py-3 text-left text-sm transition ${
                          targetDatasetId === match.id
                            ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                            : "border-gray-200 hover:border-gray-300 dark:border-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium text-gray-900 dark:text-white/90">
                            {match.name}
                          </span>
                          <Badge size="sm" color="info">
                            {Math.round(match.overlap_score * 100)}% overlap
                          </Badge>
                        </div>
                        <p className="mt-1 text-gray-500">
                          {match.row_count} rows · {match.selected_columns.join(", ")}
                        </p>
                        {!!match.unmappable_source_columns.length && (
                          <p className="mt-1 text-warning-600">
                            Unmappable: {match.unmappable_source_columns.join(", ")}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>

                  {selectedMatch && (
                    <div className="mb-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-gray-500">
                          <tr>
                            <th className="py-2 pr-3 font-medium">Incoming column</th>
                            <th className="py-2 font-medium">Map to existing column</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                          {selectedColumns.map((source) => (
                            <tr key={source}>
                              <td className="py-3 pr-3 text-gray-800 dark:text-white/90">
                                {source}
                              </td>
                              <td className="py-3">
                                <select
                                  value={columnMapping[source] ?? ""}
                                  onChange={(event) => {
                                    const value = event.target.value;
                                    setColumnMapping((current) => ({
                                      ...current,
                                      [source]: value || null,
                                    }));
                                  }}
                                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                >
                                  <option value="">
                                    {addUnmappedColumns
                                      ? "Add as new column"
                                      : "Skip (cannot map)"}
                                  </option>
                                  {selectedMatch.selected_columns.map((target) => (
                                    <option key={target} value={target}>
                                      {target}
                                    </option>
                                  ))}
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <label className="mb-4 flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={addUnmappedColumns}
                      onChange={(event) => setAddUnmappedColumns(event.target.checked)}
                      className="mt-0.5"
                    />
                    <span>
                      Add unmapped incoming columns as new columns on the existing table.
                      Turn off to skip columns that cannot be mapped.
                    </span>
                  </label>
                </>
              )}

              <label className="mb-4 flex items-start gap-3 rounded-xl bg-gray-50 p-4 text-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={alsoImportToContacts}
                  onChange={(event) => setAlsoImportToContacts(event.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  Also put new contacts into the shared CRM Contacts table (name / phone /
                  email when detectable). Existing CRM phones are skipped as duplicates.
                </span>
              </label>

              <button
                type="button"
                disabled={creating}
                onClick={() => void createOrMergeTable()}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-40"
              >
                <CheckCircleIcon className="h-5 w-5" />
                {creating
                  ? "Saving…"
                  : mergeMode === "merge"
                    ? "Merge into selected table"
                    : "Create new table"}
              </button>
            </section>
          )}

          {writeResult?.duplicates.has_duplicates && (
            <section className="rounded-2xl border border-warning-200 bg-warning-50 p-5 dark:border-warning-500/30 dark:bg-warning-500/10">
              <h2 className="font-semibold text-warning-800 dark:text-warning-300">
                Duplicate warning
              </h2>
              <p className="mt-2 text-sm text-warning-800 dark:text-warning-200">
                {writeResult.duplicates.warning ||
                  `${writeResult.duplicates.duplicate_count} duplicate(s) detected after save.`}
              </p>
              <p className="mt-2 text-xs text-warning-700 dark:text-warning-300">
                Table duplicates: {writeResult.duplicates.duplicate_count}. CRM contacts
                skipped: {writeResult.duplicates.contacts_skipped_as_duplicates}.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={droppingDuplicates}
                  onClick={() => void dropDuplicates()}
                  className="inline-flex items-center justify-center rounded-lg bg-warning-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-warning-700 disabled:opacity-50"
                >
                  {droppingDuplicates ? "Dropping…" : "Drop duplicates"}
                </button>
                <button
                  type="button"
                  disabled={droppingDuplicates}
                  onClick={keepDuplicates}
                  className="inline-flex items-center justify-center rounded-lg border border-warning-400 px-4 py-2.5 text-sm font-medium text-warning-800 hover:bg-warning-100 dark:border-warning-500/40 dark:text-warning-200 dark:hover:bg-warning-500/10"
                >
                  Keep duplicates
                </button>
              </div>
              <p className="mt-2 text-xs text-warning-700 dark:text-warning-300">
                Drop keeps the first matching phone/email and removes later duplicates
                (including after merge).
              </p>
            </section>
          )}

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                {createdDataset ? createdDataset.name : "Result table"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {createdDataset
                  ? `${createdDataset.row_count} rows stored · ${createdDataset.selected_columns.length} columns${
                      writeResult ? ` · ${writeResult.action}` : ""
                    } · showing first 3 rows only`
                  : "After create/merge, column schema appears here (not the full sheet)."}
              </p>
            </div>
            <div className="overflow-x-auto">
              {!createdDataset ? (
                <div className="px-5 py-10 text-center text-sm text-gray-500">
                  No table yet.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02]">
                    <tr>
                      {createdDataset.selected_columns.map((column) => (
                        <th key={column} className="whitespace-nowrap px-5 py-3 font-medium">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {createdDataset.rows.slice(0, 3).map((row) => (
                      <tr key={row.id}>
                        {createdDataset.selected_columns.map((column) => (
                          <td
                            key={`${row.id}-${column}`}
                            className="max-w-[180px] truncate whitespace-nowrap px-5 py-3 text-gray-700 dark:text-gray-300"
                            title="Stored on server"
                          >
                            {row.data[column] ? "••••" : "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Duplicates in database
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Scanned from saved tables on load. Drop extras while keeping the first
                phone/email match.
              </p>
            </div>
            <div className="overflow-x-auto">
              {!duplicateReport || duplicateReport.items.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  {loadingList ? "Scanning duplicates…" : "No saved tables to scan."}
                </div>
              ) : duplicateReport.total_duplicate_rows === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-gray-500">
                  No duplicate contacts found in saved tables.
                </div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02]">
                    <tr>
                      <th className="px-5 py-3 font-medium">Table</th>
                      <th className="px-5 py-3 font-medium">Rows</th>
                      <th className="px-5 py-3 font-medium">Duplicates</th>
                      <th className="px-5 py-3 font-medium">Sample keys</th>
                      <th className="px-5 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {duplicateReport.items
                      .filter((item) => item.has_duplicates)
                      .map((item) => (
                        <tr key={item.dataset_id}>
                          <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                            {item.name}
                          </td>
                          <td className="px-5 py-4 text-gray-500">{item.row_count}</td>
                          <td className="px-5 py-4">
                            <Badge color="warning" size="sm">
                              {item.duplicate_count}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-gray-500">
                            {item.samples
                              .slice(0, 3)
                              .map((sample) => sample.phone || sample.email || sample.key)
                              .join(", ") || "—"}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              type="button"
                              disabled={droppingDuplicates}
                              onClick={() => void dropDuplicates(item.dataset_id)}
                              className="rounded-lg bg-warning-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-warning-700 disabled:opacity-50"
                            >
                              {droppingDatasetId === item.dataset_id
                                ? "Dropping…"
                                : "Drop duplicates"}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Saved tables
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                CRM contacts: {stats?.total ?? "—"} · Tables with duplicates:{" "}
                {duplicateReport?.tables_with_duplicates ?? 0}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Columns</th>
                    <th className="px-5 py-3 font-medium">Rows</th>
                    <th className="px-5 py-3 font-medium">Duplicates</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loadingList ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                        Loading tables…
                      </td>
                    </tr>
                  ) : datasets.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-gray-500">
                        No tables yet.
                      </td>
                    </tr>
                  ) : (
                    datasets.map((dataset) => (
                      <tr key={dataset.id}>
                        <td className="px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                          {dataset.name}
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          {dataset.selected_columns.join(", ")}
                        </td>
                        <td className="px-5 py-4 text-gray-500">{dataset.row_count}</td>
                        <td className="px-5 py-4">
                          {dataset.has_duplicates ? (
                            <Badge color="warning" size="sm">
                              {dataset.duplicate_count}
                            </Badge>
                          ) : (
                            <span className="text-gray-500">0</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-gray-500">
                          {dataset.source_file || dataset.source_type}
                        </td>
                        <td className="px-5 py-4">
                          {dataset.has_duplicates ? (
                            <button
                              type="button"
                              disabled={droppingDuplicates}
                              onClick={() => void dropDuplicates(dataset.id)}
                              className="rounded-lg border border-warning-400 px-3 py-1.5 text-xs font-medium text-warning-700 hover:bg-warning-50 disabled:opacity-50 dark:text-warning-300"
                            >
                              {droppingDatasetId === dataset.id
                                ? "Dropping…"
                                : "Drop duplicates"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>

      {notice && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl bg-gray-900 px-4 py-3 text-sm text-white shadow-theme-lg dark:bg-white dark:text-gray-900"
        >
          {notice}
        </div>
      )}
    </div>
  );
}
