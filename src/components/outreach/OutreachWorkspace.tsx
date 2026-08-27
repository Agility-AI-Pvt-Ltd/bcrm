"use client";

/**
 * WhatsApp Outreach — pick a list, write the message, send to everyone, watch it land.
 *
 * The flow deliberately mirrors what a broker actually does: the list comes from a
 * file — one upload is one tracked table, named after the file. There is
 * deliberately only that one way in, because a second, always-syncing source made
 * the page harder to understand than it made it useful.
 *
 * Nothing here treats a missing Temporal worker as an error. Every create/start
 * call returns `scheduled: false` in that case and the work stays queued in
 * Postgres, so the copy says "queued" and the "Send one batch now" button on each
 * campaign is the manual escape hatch.
 *
 * The list's columns are shown as soon as a list is picked, and the placeholder
 * mapping is a picker rather than a text box. Both exist for the same reason: the
 * mapping is looked up by exact column name against the row kept on each
 * recipient, so a guessed or mistyped header does not fail loudly — it sends an
 * empty parameter and Meta rejects the message.
 *
 * The AI box in step 2 fills those same boxes from one instruction, via the
 * campaign-composer graph. It needs a list chosen first, because the backend
 * proves every placeholder it keeps against that list's column names — and it
 * sends only those names, never a customer's details.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import CampaignCard from "@/components/outreach/CampaignCard";
import OfficeShiftCard from "@/components/outreach/OfficeShiftCard";
import { ApiError } from "@/lib/api";
import {
  listContactDatasets,
  type ContactDatasetSummary,
} from "@/lib/contactIntelligence";
import {
  createCampaign,
  draftCampaignMessage,
  listCampaigns,
  uploadSpreadsheet,
  SKIP_REASON_LABELS,
  type CampaignCreateResponse,
  type CampaignSummary,
  type ComposerDraft,
} from "@/lib/outreach";

type VariableRow = { placeholder: string; column: string };

/** Same shape the backend's `placeholder_names` looks for: `{{1}}`, `{{name}}`. */
const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g;

/**
 * Keys every recipient carries whatever the sheet's headers are called.
 *
 * The importer normalises a person's name and number out of whichever columns
 * held them, and the send merges both over the row's own cells — so these resolve
 * even when the file says "Full Name" or "Mobile No". Offered alongside the real
 * columns, never instead of them.
 */
const ALWAYS_AVAILABLE = ["name", "phone"] as const;

/** Keep the composer inside the backend's Field(ge=…, le=…) bounds so a typo in a
 *  number box comes back as a nudge here rather than a 422 from the API. */
const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, Number.isFinite(value) ? value : low));

const CAMPAIGN_FILTERS = [
  { value: "", label: "All" },
  { value: "running", label: "Running" },
  { value: "queued", label: "Queued" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Done" },
  { value: "draft", label: "Drafts" },
] as const;

export default function OutreachWorkspace() {
  // --- lists -----------------------------------------------------------------
  const [datasets, setDatasets] = useState<ContactDatasetSummary[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const deepLinkUsed = useRef(false);

  // --- composer --------------------------------------------------------------
  const [name, setName] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("en_US");
  const [templateBody, setTemplateBody] = useState("");
  const [variables, setVariables] = useState<VariableRow[]>([
    { placeholder: "1", column: "" },
  ]);
  const [messageBody, setMessageBody] = useState("");
  const [batchSize, setBatchSize] = useState(25);
  const [throttleSeconds, setThrottleSeconds] = useState(2);
  const [limit, setLimit] = useState("");
  const [onlyNotMessaged, setOnlyNotMessaged] = useState(true);
  const [excludeOtherCampaigns, setExcludeOtherCampaigns] = useState(true);
  const [autoNurture, setAutoNurture] = useState(true);
  const [startNow, setStartNow] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CampaignCreateResponse | null>(null);

  // --- the AI that fills the composer ----------------------------------------
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSummary, setAiSummary] = useState("");
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  /** `ready`, `fallback` (written without the model) or `empty`. */
  const [aiStatus, setAiStatus] = useState("");

  // --- campaigns -------------------------------------------------------------
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [notice, setNotice] = useState("");

  const say = useCallback((message: string) => setNotice(message), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadDatasets = useCallback(async () => {
    try {
      const items = await listContactDatasets();
      setDatasets(items);
      // A group built on the Messages screen links here as ?dataset=<id>, so the
      // list it just made is already chosen. Honoured once: reloading after an
      // upload must not drag the picker back to a stale query string.
      let preferred = "";
      if (!deepLinkUsed.current) {
        deepLinkUsed.current = true;
        const requested = new URLSearchParams(window.location.search).get("dataset");
        if (requested && items.some((item) => item.id === requested)) preferred = requested;
      }
      setDatasetId((current) => preferred || current || items[0]?.id || "");
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not load your lists.");
    }
  }, [say]);

  const loadCampaigns = useCallback(async () => {
    setLoadingCampaigns(true);
    try {
      setCampaigns(await listCampaigns({ status: statusFilter || undefined }));
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not load campaigns.");
    } finally {
      setLoadingCampaigns(false);
    }
  }, [statusFilter, say]);

  useEffect(() => {
    void loadDatasets();
  }, [loadDatasets]);

  useEffect(() => {
    void loadCampaigns();
  }, [loadCampaigns]);

  const reloadEverything = useCallback(() => {
    void loadCampaigns();
    void loadDatasets();
  }, [loadCampaigns, loadDatasets]);

  // --- upload ----------------------------------------------------------------

  const takeFile = async (file: File | null | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const result = await uploadSpreadsheet(file);
      await loadDatasets();
      setDatasetId(result.dataset.id);
      const duplicate = result.duplicates?.has_duplicates
        ? ` ${result.duplicates.duplicate_count} duplicate row(s) in the file — they will be sent once.`
        : "";
      say(
        `"${result.dataset.name}" is ready: ${result.rows_added} row(s), ` +
          `${result.contacts_created} new customer(s).${duplicate}`,
      );
    } catch (error) {
      say(error instanceof ApiError ? error.message : "That file could not be read.");
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  // --- create ----------------------------------------------------------------

  const selectedDataset = datasets.find((item) => item.id === datasetId);

  /**
   * Columns a placeholder can be filled from, for the list currently chosen.
   *
   * These are the sheet's own headers, kept on every recipient as `context`, which
   * is what the send looks the mapping up in. Showing them is the whole point:
   * a template cannot be written against columns you cannot see, and a mistyped
   * header does not fail loudly — it sends an empty parameter and Meta rejects
   * the message.
   */
  const columnOptions = useMemo(() => {
    const columns = (selectedDataset?.selected_columns ?? []).filter(Boolean);
    const taken = new Set(columns.map((column) => column.toLowerCase()));
    const extras: string[] = ALWAYS_AVAILABLE.filter((key) => !taken.has(key));
    return { columns, extras };
  }, [selectedDataset]);

  const templateVariables = useMemo(() => {
    const map: Record<string, string> = {};
    for (const row of variables) {
      const key = row.placeholder.trim();
      const column = row.column.trim();
      if (key && column) map[key] = column;
    }
    return map;
  }, [variables]);

  /** Placeholders actually written in the template text, in order of appearance. */
  const usedPlaceholders = useMemo(() => {
    const found: string[] = [];
    for (const match of templateBody.matchAll(PLACEHOLDER_RE)) {
      if (match[1] && !found.includes(match[1])) found.push(match[1]);
    }
    return found;
  }, [templateBody]);

  /**
   * Where the text and the mapping disagree. Both directions are real send bugs.
   *
   * When the template text is set, the backend takes the parameter order from the
   * text — so a placeholder with no column becomes an empty parameter, which Meta
   * rejects for the whole message, and a column mapped to a placeholder the text
   * never mentions is silently dropped. Neither shows up until the send fails.
   */
  const mappingProblems = useMemo(() => {
    if (!templateBody.trim()) return { missing: [] as string[], unused: [] as string[] };
    return {
      missing: usedPlaceholders.filter((token) => !templateVariables[token]),
      unused: Object.keys(templateVariables).filter(
        (token) => !usedPlaceholders.includes(token),
      ),
    };
  }, [templateBody, usedPlaceholders, templateVariables]);

  const canCreate =
    Boolean(datasetId) &&
    (Boolean(templateName.trim()) || Boolean(messageBody.trim())) &&
    !creating;

  const create = async () => {
    if (!datasetId) {
      say("Choose the list to send to.");
      return;
    }
    if (!templateName.trim() && !messageBody.trim()) {
      say("Add an approved template name, or write the message text.");
      return;
    }
    setCreating(true);
    setCreated(null);
    try {
      const parsedLimit = Number.parseInt(limit, 10);
      const result = await createCampaign({
        dataset_id: datasetId,
        name: name.trim() || undefined,
        template_name: templateName.trim() || undefined,
        template_language: templateName.trim() ? templateLanguage.trim() : undefined,
        template_body: templateBody.trim() || undefined,
        template_variables: Object.keys(templateVariables).length
          ? templateVariables
          : undefined,
        message_body: messageBody.trim() || undefined,
        batch_size: clamp(batchSize, 1, 200),
        throttle_seconds: clamp(throttleSeconds, 0, 60),
        auto_nurture: autoNurture,
        only_not_messaged: onlyNotMessaged,
        exclude_other_campaigns: excludeOtherCampaigns,
        limit:
          Number.isFinite(parsedLimit) && parsedLimit > 0
            ? clamp(parsedLimit, 1, 100_000)
            : undefined,
        start_now: startNow,
      });
      setCreated(result);
      say(result.message);
      await loadCampaigns();
    } catch (error) {
      say(error instanceof ApiError ? error.message : "The campaign was not created.");
    } finally {
      setCreating(false);
    }
  };

  const replaceCampaign = useCallback((updated: CampaignSummary) => {
    setCampaigns((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }, []);

  // --- the AI that fills the composer ----------------------------------------

  /** What the AI returns lands in the same boxes you would have typed in. */
  const applyDraft = (draft: ComposerDraft) => {
    setName(draft.campaign_name);
    setTemplateName(draft.template_name);
    setTemplateLanguage(draft.template_language || "en_US");
    setTemplateBody(draft.template_body);
    setMessageBody(draft.message_body);
    // The backend renumbers survivors 1, 2, 3…, so numeric order is the order they
    // appear in the text. The string compare is only a guard against a stray name.
    const rows = Object.entries(draft.variables ?? {})
      .sort(([a], [b]) => Number(a) - Number(b) || a.localeCompare(b))
      .map(([placeholder, column]) => ({ placeholder, column }));
    setVariables(rows.length ? rows : [{ placeholder: "1", column: "" }]);
  };

  /**
   * Write the whole step from one instruction.
   *
   * The list is required rather than optional: placeholders are resolved against
   * that list's column names, and a message written blind sends empty values that
   * WhatsApp rejects for the whole send. Whatever is already in the boxes goes
   * along as `current`, so "make it shorter" has something to shorten.
   */
  const writeWithAi = async () => {
    if (!datasetId) {
      say("Pick the list first — the AI writes against its columns.");
      return;
    }
    if (!aiPrompt.trim()) {
      say("Tell the AI what the message should say.");
      return;
    }
    setAiBusy(true);
    try {
      const result = await draftCampaignMessage({
        instruction: aiPrompt.trim(),
        dataset_id: datasetId,
        current: {
          campaign_name: name.trim(),
          template_name: templateName.trim(),
          template_body: templateBody.trim(),
          variables: templateVariables,
          message_body: messageBody.trim(),
        },
      });
      // An empty status means no message came back, so the boxes are left alone
      // rather than wiped by a draft that has nothing in it.
      if (result.status !== "empty") applyDraft(result.draft);
      setAiStatus(result.status);
      setAiSummary(result.summary);
      setAiWarnings(result.warnings ?? []);
    } catch (error) {
      setAiStatus("error");
      setAiSummary("");
      setAiWarnings([]);
      say(error instanceof ApiError ? error.message : "The AI could not write that.");
    } finally {
      setAiBusy(false);
    }
  };

  // --- header numbers --------------------------------------------------------

  const totals = useMemo(() => {
    const sum = (pick: (item: CampaignSummary) => number) =>
      campaigns.reduce((carry, item) => carry + (pick(item) || 0), 0);
    return {
      live: campaigns.filter((item) =>
        ["running", "queued", "paused"].includes(item.status),
      ).length,
      sent: sum((item) => item.sent_count),
      replied: sum((item) => item.replied_count),
      waiting: sum((item) => item.outstanding),
    };
  }, [campaigns]);

  return (
    <div>
      <PageBreadcrumb pageTitle="WhatsApp Outreach" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Send to everyone, follow up with the quiet ones
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            One upload is one tracked list. Every message keeps a status, so a lead
            can never quietly go missing.
          </p>
        </div>
        <button
          type="button"
          onClick={reloadEverything}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Live campaigns", value: totals.live },
          { label: "Messages sent", value: totals.sent },
          { label: "Replies", value: totals.replied },
          { label: "Still to send", value: totals.waiting },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {stat.value}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* ---------------- left: set up the send ---------------- */}
        <div className="col-span-12 space-y-6 xl:col-span-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              1. Pick the list
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              The file name becomes the table name, so you can always tell two
              uploads apart.
            </p>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void takeFile(event.dataTransfer.files?.[0]);
              }}
              onClick={() => fileInput.current?.click()}
              className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragging
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-300 hover:border-brand-400 dark:border-gray-700"
              }`}
            >
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx,.xlsm,.csv,.tsv"
                className="hidden"
                onChange={(event) => void takeFile(event.target.files?.[0])}
              />
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {uploading ? "Reading the file…" : "Drop a spreadsheet, or click to choose"}
              </p>
              <p className="mt-1 text-xs text-gray-500">.xlsx, .xlsm, .csv or .tsv</p>
            </div>

            <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Send to
            </label>
            <select
              value={datasetId}
              onChange={(event) => setDatasetId(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Choose a list…</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} · {dataset.row_count} row(s)
                </option>
              ))}
            </select>
            {selectedDataset ? (
              <p className="mt-2 text-xs text-gray-500">
                {selectedDataset.row_count} row(s)
                {selectedDataset.has_duplicates
                  ? ` · ${selectedDataset.duplicate_count ?? 0} duplicate(s) will be sent once`
                  : ""}
                {selectedDataset.crm_imported_count
                  ? ` · ${selectedDataset.crm_imported_count} already in the CRM`
                  : ""}
              </p>
            ) : null}

            {/* The columns are here because the next step needs them. You cannot
                write a template against headers you cannot see, and the file's
                own wording is rarely what you would guess. */}
            {selectedDataset ? (
              <div className="mt-3 rounded-xl bg-gray-50 px-3.5 py-3 dark:bg-white/[0.03]">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Columns in this list
                </p>
                {columnOptions.columns.length ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {columnOptions.columns.map((column) => (
                      <span
                        key={column}
                        className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    None recorded for this list — use name and phone below.
                  </p>
                )}
                <p className="mt-2 text-xs leading-relaxed text-gray-500">
                  Use these names in step 2 to fill your template. Every message can
                  also use <span className="font-medium">name</span> and{" "}
                  <span className="font-medium">phone</span>, which are worked out on
                  import however the file spells them.
                </p>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              2. Write the message
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Send to any list you choose. An approved template reaches everyone on
              it; free text only lands with people who wrote to you in the last 24
              hours, and the AI handles those replies itself.
            </p>

            {/* Write the fields from one instruction. A proposal, not a send: the
                columns come from the list picked above, so the AI cannot invent a
                placeholder no recipient row can fill. */}
            <div className="mt-4 rounded-xl border border-brand-500/30 bg-brand-50/70 p-4 dark:border-brand-500/25 dark:bg-brand-500/[0.06]">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="ai-brief"
                  className="text-xs font-semibold text-brand-600 dark:text-brand-400"
                >
                  Ask the AI to write it
                </label>
                {aiStatus === "fallback" && (
                  <Badge color="warning" size="sm">
                    skeleton only
                  </Badge>
                )}
              </div>
              <textarea
                id="ai-brief"
                value={aiPrompt}
                onChange={(event) => setAiPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void writeWithAi();
                  }
                }}
                rows={2}
                placeholder={
                  selectedDataset
                    ? `Invite everyone on ${selectedDataset.name} to Sunday's site visit, greet them by name.`
                    : "Pick a list above, then say what the message should do."
                }
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Only your column names are sent — never a name, number or any cell.
                </p>
                <button
                  type="button"
                  disabled={aiBusy || !datasetId || !aiPrompt.trim()}
                  onClick={() => void writeWithAi()}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {aiBusy ? "Writing…" : "Fill the fields below"}
                </button>
              </div>

              {!selectedDataset && (
                <p className="mt-2 text-xs leading-relaxed text-warning-600 dark:text-warning-400">
                  Pick a list in step 1 first. Placeholders are filled from that
                  list&apos;s columns, and a message written without them sends blank
                  values WhatsApp rejects.
                </p>
              )}

              {aiSummary && (
                <div className="mt-3 space-y-1.5 border-t border-brand-500/20 pt-3">
                  <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                    {aiStatus !== "empty" && (
                      <span className="font-medium text-gray-800 dark:text-white/90">
                        Filled in below.{" "}
                      </span>
                    )}
                    {aiSummary}
                  </p>
                  {aiWarnings.map((warning) => (
                    <p
                      key={warning}
                      className="text-xs leading-relaxed text-warning-600 dark:text-warning-400"
                    >
                      {warning}
                    </p>
                  ))}
                  {templateName.trim() && messageBody.trim() && (
                    <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      It also wrote plain text for the 24-hour window. Clear the
                      template name to see and edit that version instead.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Campaign name
                </label>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Left blank: named after the file"
                  className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Approved template name
                  </label>
                  <input
                    value={templateName}
                    onChange={(event) => setTemplateName(event.target.value)}
                    placeholder="e.g. property_intro_v1"
                    className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Language
                  </label>
                  <input
                    value={templateLanguage}
                    onChange={(event) => setTemplateLanguage(event.target.value)}
                    className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
              </div>

              {templateName.trim() ? (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Fill the template placeholders from columns
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setVariables((rows) => [
                          ...rows,
                          { placeholder: String(rows.length + 1), column: "" },
                        ])
                      }
                      className="text-xs font-medium text-brand-500 hover:text-brand-600"
                    >
                      + Add
                    </button>
                  </div>
                  <div className="mt-2 space-y-2">
                    {variables.map((row, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <input
                          value={row.placeholder}
                          onChange={(event) =>
                            setVariables((rows) =>
                              rows.map((item, i) =>
                                i === index
                                  ? { ...item, placeholder: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          placeholder="1"
                          className="h-10 w-16 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        />
                        <span className="text-xs text-gray-400">←</span>
                        <select
                          value={row.column}
                          disabled={!selectedDataset}
                          onChange={(event) =>
                            setVariables((rows) =>
                              rows.map((item, i) =>
                                i === index
                                  ? { ...item, column: event.target.value }
                                  : item,
                              ),
                            )
                          }
                          className="h-10 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-sm text-gray-800 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                        >
                          <option value="">
                            {selectedDataset ? "Choose a column…" : "Pick a list first"}
                          </option>
                          {columnOptions.columns.length > 0 && (
                            <optgroup label="From this list">
                              {columnOptions.columns.map((column) => (
                                <option key={column} value={column}>
                                  {column}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {columnOptions.extras.length > 0 && (
                            <optgroup label="Always available">
                              {columnOptions.extras.map((column) => (
                                <option key={column} value={column}>
                                  {column}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {/* A column kept from a different list would otherwise
                              render as blank and be lost on the next change. */}
                          {row.column &&
                            !columnOptions.columns.includes(row.column) &&
                            !columnOptions.extras.includes(row.column) && (
                              <option value={row.column}>
                                {row.column} — not in this list
                              </option>
                            )}
                        </select>
                        <button
                          type="button"
                          onClick={() =>
                            setVariables((rows) => rows.filter((_, i) => i !== index))
                          }
                          className="px-1 text-sm text-gray-400 hover:text-error-500"
                          aria-label="Remove"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3">
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                      Template text (for your own record and for the AI&apos;s context)
                    </label>
                    <textarea
                      value={templateBody}
                      onChange={(event) => setTemplateBody(event.target.value)}
                      rows={2}
                      placeholder="Hi {{1}}, we have a 2BHK in {{2}} that matches what you were after."
                      className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                    />
                    {mappingProblems.missing.length > 0 && (
                      <p className="mt-1.5 text-xs text-warning-600 dark:text-warning-400">
                        {mappingProblems.missing.map((token) => `{{${token}}}`).join(", ")}{" "}
                        {mappingProblems.missing.length === 1 ? "has" : "have"} no column
                        above. WhatsApp rejects a template with an empty value, so add a
                        row for {mappingProblems.missing.length === 1 ? "it" : "each"} or
                        take {mappingProblems.missing.length === 1 ? "it" : "them"} out of
                        the text.
                      </p>
                    )}
                    {mappingProblems.unused.length > 0 && (
                      <p className="mt-1.5 text-xs text-gray-500">
                        {mappingProblems.unused.map((token) => `{{${token}}}`).join(", ")}{" "}
                        {mappingProblems.unused.length === 1 ? "is" : "are"} mapped above
                        but never used in the text, so{" "}
                        {mappingProblems.unused.length === 1 ? "it" : "they"} will be
                        ignored.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Message text
                  </label>
                  <textarea
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                    rows={4}
                    placeholder="Only reaches people who have written to you in the last 24 hours."
                    className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                  <p className="mt-1 text-xs text-warning-600 dark:text-warning-400">
                    No template name set — cold numbers will be recorded as skipped
                    rather than silently dropped.
                  </p>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowAdvanced((value) => !value)}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                {showAdvanced ? "Hide" : "Show"} pace and audience settings
              </button>

              {showAdvanced && (
                <div className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs text-gray-500">Batch size</label>
                      <input
                        type="number"
                        min={1}
                        value={batchSize}
                        onChange={(event) =>
                          setBatchSize(Number(event.target.value) || 1)
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">
                        Seconds between
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={throttleSeconds}
                        onChange={(event) =>
                          setThrottleSeconds(Number(event.target.value) || 0)
                        }
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500">Cap (blank = all)</label>
                      <input
                        type="number"
                        min={1}
                        value={limit}
                        onChange={(event) => setLimit(event.target.value)}
                        className="mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                      />
                    </div>
                  </div>
                  {[
                    {
                      checked: onlyNotMessaged,
                      set: setOnlyNotMessaged,
                      label: "Skip anyone already messaged",
                    },
                    {
                      checked: excludeOtherCampaigns,
                      set: setExcludeOtherCampaigns,
                      label: "Skip anyone in another live campaign",
                    },
                    {
                      checked: autoNurture,
                      set: setAutoNurture,
                      label: "Follow up automatically if they stay quiet",
                    },
                    {
                      checked: startNow,
                      set: setStartNow,
                      label: "Start sending as soon as it is created",
                    },
                  ].map((option) => (
                    <label
                      key={option.label}
                      className="flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                    >
                      <input
                        type="checkbox"
                        checked={option.checked}
                        onChange={(event) => option.set(event.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}

              <button
                type="button"
                disabled={!canCreate}
                onClick={() => void create()}
                className="w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {creating
                  ? "Building the audience…"
                  : startNow
                    ? "Create and start sending"
                    : "Create as a draft"}
              </button>

              {created && (
                <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge color="success" size="sm">
                      {created.queued} queued
                    </Badge>
                    {created.skipped > 0 && (
                      <Badge color="warning" size="sm">
                        {created.skipped} skipped
                      </Badge>
                    )}
                    <Badge color={created.scheduled ? "primary" : "light"} size="sm">
                      {created.scheduled ? "worker picked it up" : "queued for the next shift"}
                    </Badge>
                  </div>
                  {Object.keys(created.skipped_reasons || {}).length > 0 && (
                    <ul className="mt-3 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                      {Object.entries(created.skipped_reasons).map(([reason, count]) => (
                        <li key={reason} className="flex justify-between gap-3">
                          <span>{SKIP_REASON_LABELS[reason] || reason.replace(/_/g, " ")}</span>
                          <span className="font-medium">{count}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="mt-3 text-xs text-gray-500">
                    Skipped rows are kept with a reason, so you can see exactly who was
                    left out and why.
                  </p>
                </div>
              )}
            </div>
          </section>

          <OfficeShiftCard onWorkDone={reloadEverything} />
        </div>

        {/* ---------------- right: what is happening ---------------- */}
        <div className="col-span-12 space-y-4 xl:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">Campaigns</h2>
            <div className="flex flex-wrap gap-1.5">
              {CAMPAIGN_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => setStatusFilter(filter.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    statusFilter === filter.value
                      ? "bg-brand-500 text-white"
                      : "border border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          {loadingCampaigns ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.03]">
              Loading campaigns…
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center dark:border-gray-700 dark:bg-white/[0.03]">
              <p className="font-medium text-gray-700 dark:text-gray-300">
                No campaigns yet
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Pick a list on the left, write the message, and send.
              </p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onChanged={replaceCampaign}
                onNotice={say}
              />
            ))
          )}
        </div>
      </div>

      {notice && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {notice}
        </div>
      )}
    </div>
  );
}
