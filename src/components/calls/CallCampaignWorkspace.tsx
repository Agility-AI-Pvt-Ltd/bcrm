"use client";

/**
 * AI Calling — pick who to ring, decide how the AI should talk, send it off.
 *
 * The audience comes from the same contact lists the rest of the product already
 * uses: an uploaded spreadsheet, or a group built on the Messages screen. Both are
 * the same thing underneath, so a group a broker made from their WhatsApp
 * conversations shows up in this dropdown with no extra work.
 *
 * The script is the part that makes this feature different from WhatsApp outreach.
 * A template is text that gets sent verbatim; a call script is a standing
 * instruction the AI improvises against while a real person interrupts it. The
 * dealer can write it themselves or generate one from a sentence, and either way
 * they see the exact words before a single number is dialled.
 *
 * Nothing here treats a missing Temporal worker as an error. Create returns
 * `started: false` in that case and the calls stay queued in Postgres, so the copy
 * says "queued" rather than showing a failure.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import CallCampaignCard from "@/components/calls/CallCampaignCard";
import { ApiError } from "@/lib/api";
import {
  listContactDatasets,
  type ContactDatasetSummary,
} from "@/lib/contactIntelligence";
import { uploadSpreadsheet } from "@/lib/outreach";
import {
  createCallCampaign,
  draftCallScript,
  describeDuration,
  getCallCapacity,
  listCallCampaigns,
  type CallCampaign,
  type CallCapacity,
} from "@/lib/calls";

const LANGUAGES = ["English", "Hinglish", "Hindi", "Marathi", "Tamil", "Telugu", "Kannada"];

/** Mirrors the backend's own ceiling; the server still has the final say. */
const MAX_BATCH = 2000;

/**
 * `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time, and the API wants an
 * ISO instant. Converting through `Date` is what makes "10am" mean 10am where the
 * dealer is sitting rather than 10am UTC.
 */
function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function defaultScheduleValue(): string {
  const soon = new Date(Date.now() + 60 * 60 * 1000);
  soon.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}T${pad(soon.getHours())}:${pad(soon.getMinutes())}`;
}

export default function CallCampaignWorkspace() {
  const [datasets, setDatasets] = useState<ContactDatasetSummary[]>([]);
  const [datasetId, setDatasetId] = useState("");
  const [campaigns, setCampaigns] = useState<CallCampaign[]>([]);
  const [capacity, setCapacity] = useState<CallCapacity | null>(null);

  const [name, setName] = useState("");
  const [agentPrompt, setAgentPrompt] = useState("");
  const [language, setLanguage] = useState("English");
  const [instruction, setInstruction] = useState("");
  const [openingLine, setOpeningLine] = useState("");
  const [goals, setGoals] = useState<string[]>([]);

  const [startWhen, setStartWhen] = useState<"now" | "later">("now");
  const [scheduleAt, setScheduleAt] = useState(defaultScheduleValue);
  const [limit, setLimit] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [concurrency, setConcurrency] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const [aiWarnings, setAiWarnings] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const selectedDataset = useMemo(
    () => datasets.find((item) => item.id === datasetId) ?? null,
    [datasets, datasetId],
  );

  const reload = useCallback(async () => {
    try {
      const [lists, page, cap] = await Promise.all([
        listContactDatasets(),
        listCallCampaigns({ limit: 25 }),
        getCallCapacity().catch(() => null),
      ]);
      setDatasets(lists);
      setCampaigns(page.items);
      if (cap) setCapacity(cap);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your calling data");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 8000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Deep link from the Messages screen: making a group there sends the broker
  // straight here with that group already chosen.
  useEffect(() => {
    const fromUrl = new URLSearchParams(window.location.search).get("dataset");
    if (fromUrl) setDatasetId(fromUrl);
  }, []);

  const takeFile = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const result = await uploadSpreadsheet(file, { importToContacts: true });
      await reload();
      setDatasetId(result.dataset.id);
      setNotice(`Loaded ${result.dataset.name} — ${result.dataset.row_count} row(s).`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not read that file");
    } finally {
      setUploading(false);
    }
  };

  const writeWithAi = async () => {
    if (!instruction.trim()) {
      setError("Tell the AI what this call is about first.");
      return;
    }
    setAiBusy(true);
    setError("");
    try {
      const result = await draftCallScript({
        instruction: instruction.trim(),
        campaign_name: name.trim(),
        language,
        current_prompt: agentPrompt.trim(),
      });
      if (result.draft.agent_prompt) setAgentPrompt(result.draft.agent_prompt);
      setOpeningLine(result.draft.opening_line);
      setGoals(result.draft.goals ?? []);
      setAiWarnings(result.warnings ?? []);
      setAiNote(
        result.status === "fallback"
          ? result.summary || "Written without AI. Edit it before calling."
          : result.summary,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The AI could not write a script");
    } finally {
      setAiBusy(false);
    }
  };

  const targetCount = selectedDataset?.row_count ?? 0;
  const plannedLines = Number(concurrency) || capacity?.organization_limit || 1;
  const plannedCalls = Math.min(Number(limit) || targetCount, targetCount);
  const estimate = plannedCalls ? Math.ceil(plannedCalls / plannedLines) * 2 : 0;

  const canStart = Boolean(datasetId) && !creating && targetCount > 0;

  const start = async () => {
    if (!datasetId) {
      setError("Choose who to call first.");
      return;
    }
    setCreating(true);
    setError("");
    try {
      const response = await createCallCampaign({
        name: name.trim() || selectedDataset?.name || "Call campaign",
        dataset_id: datasetId,
        agent_prompt: agentPrompt.trim() || undefined,
        scheduled_at: startWhen === "later" ? localInputToIso(scheduleAt) : undefined,
        limit: Number(limit) || undefined,
        max_attempts: maxAttempts,
        concurrency: Number(concurrency) || undefined,
      });
      const skipped: string[] = [];
      if (response.skipped_no_phone) {
        skipped.push(`${response.skipped_no_phone} row(s) had no phone number`);
      }
      if (response.skipped_duplicate) {
        skipped.push(`${response.skipped_duplicate} duplicate(s) will be called once`);
      }
      setNotice(
        [response.message, skipped.join(" · ")].filter(Boolean).join(" "),
      );
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the campaign");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="AI Calling" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Let the AI make the calls
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Pick a group, say how the AI should talk, and it works through the list a
            few calls at a time. Every conversation comes back with a summary.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Refresh
        </button>
      </div>

      {notice ? (
        <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700 dark:bg-green-500/10 dark:text-green-400">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-12 gap-6">
        {/* ------------------ left: build the campaign ------------------ */}
        <div className="col-span-12 space-y-6 xl:col-span-5">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              1. Who should the AI call?
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Groups you make on the Messages screen show up here, alongside any
              spreadsheet you upload.
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
              className={`mt-4 cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center transition ${
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
              Call this group
            </label>
            <select
              value={datasetId}
              onChange={(event) => setDatasetId(event.target.value)}
              className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              <option value="">Choose a group or list…</option>
              {datasets.map((dataset) => (
                <option key={dataset.id} value={dataset.id}>
                  {dataset.name} · {dataset.row_count} contact(s)
                </option>
              ))}
            </select>
            {selectedDataset ? (
              <p className="mt-2 text-xs text-gray-500">
                {selectedDataset.row_count} contact(s).
                {selectedDataset.row_count > MAX_BATCH
                  ? ` Only the first ${MAX_BATCH} will be called — split the list for the rest.`
                  : " Anyone without a phone number is skipped automatically."}
              </p>
            ) : null}

            <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-400">
              Campaign name
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={selectedDataset?.name || "Diwali follow-ups"}
              className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              2. How should the AI talk?
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              These are instructions, not a speech to read out. The AI follows them
              while the customer talks back.
            </p>

            <div className="mt-4 rounded-xl border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                Describe the call and let AI write it
              </label>
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                rows={2}
                placeholder="Follow up with people who visited the Whitefield 3BHK last week and ask if they want a second visit"
                className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              />
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <select
                  value={language}
                  onChange={(event) => setLanguage(event.target.value)}
                  className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                >
                  {LANGUAGES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void writeWithAi()}
                  disabled={aiBusy}
                  className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {aiBusy ? "Writing…" : agentPrompt ? "Rewrite with AI" : "Write with AI"}
                </button>
                {aiNote ? (
                  <span className="text-xs text-gray-600 dark:text-gray-400">{aiNote}</span>
                ) : null}
              </div>
            </div>

            <label className="mt-4 block text-xs font-medium text-gray-600 dark:text-gray-400">
              What the AI will follow
            </label>
            <textarea
              value={agentPrompt}
              onChange={(event) => setAgentPrompt(event.target.value)}
              rows={10}
              placeholder="Write it yourself, or use the box above. Leave this blank to use your default script."
              className="mt-1.5 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 font-mono text-xs leading-relaxed text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            />

            {openingLine ? (
              <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
                <span className="font-medium">Opens with:</span> “{openingLine}”
              </p>
            ) : null}
            {goals.length ? (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400">
                  Aiming to find out
                </p>
                <ul className="mt-1 list-inside list-disc text-xs text-gray-600 dark:text-gray-400">
                  {goals.map((goal) => (
                    <li key={goal}>{goal}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {aiWarnings.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                {aiWarnings.map((warning) => (
                  <li key={warning}>• {warning}</li>
                ))}
              </ul>
            ) : null}
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              3. When should it start?
            </h2>

            <div className="mt-4 flex gap-2">
              {(["now", "later"] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStartWhen(option)}
                  className={`rounded-lg border px-4 py-2 text-sm font-medium transition ${
                    startWhen === option
                      ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400"
                      : "border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                  }`}
                >
                  {option === "now" ? "Start now" : "Schedule it"}
                </button>
              ))}
            </div>

            {startWhen === "later" ? (
              <>
                <input
                  type="datetime-local"
                  value={scheduleAt}
                  onChange={(event) => setScheduleAt(event.target.value)}
                  className="mt-3 h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Your local time. Nobody is called before then, and you can still
                  cancel in the meantime.
                </p>
              </>
            ) : null}

            <button
              type="button"
              onClick={() => setShowAdvanced((value) => !value)}
              className="mt-4 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              {showAdvanced ? "Hide options" : "More options"}
            </button>

            {showAdvanced ? (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Lines at once
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={concurrency}
                    onChange={(event) => setConcurrency(event.target.value)}
                    placeholder={String(capacity?.organization_limit ?? 5)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Tries per person
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={maxAttempts}
                    onChange={(event) => setMaxAttempts(Number(event.target.value) || 1)}
                    className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                    Call at most
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={limit}
                    onChange={(event) => setLimit(event.target.value)}
                    placeholder="everyone"
                    className="mt-1.5 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
                  />
                </div>
                <p className="col-span-3 text-xs text-gray-500">
                  More lines means more calls at once. Your plan allows{" "}
                  {capacity?.organization_limit ?? 5}; asking for more will be capped.
                </p>
              </div>
            ) : null}

            {plannedCalls > 0 ? (
              <p className="mt-4 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:bg-white/[0.03] dark:text-gray-400">
                {plannedCalls} call{plannedCalls === 1 ? "" : "s"} on {plannedLines} line
                {plannedLines === 1 ? "" : "s"} takes {describeDuration(estimate)}. That is
                normal — the AI works through the list steadily.
              </p>
            ) : null}

            <button
              type="button"
              onClick={() => void start()}
              disabled={!canStart}
              className="mt-4 w-full rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {creating
                ? "Setting up…"
                : startWhen === "later"
                  ? "Schedule the calls"
                  : "Start calling"}
            </button>
          </section>
        </div>

        {/* ------------------ right: what is happening ------------------ */}
        <div className="col-span-12 space-y-4 xl:col-span-7">
          {capacity ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white/90">
                    {capacity.organization_active} of {capacity.organization_limit} lines busy
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {capacity.accepting
                      ? "There is room to start another campaign."
                      : "All lines are in use. New calls will wait their turn rather than fail."}
                  </p>
                </div>
                <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-brand-500"
                    style={{
                      width: `${Math.min(100, Math.round((capacity.organization_active / Math.max(1, capacity.organization_limit)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ) : null}

          {campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center dark:border-gray-700">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No call campaigns yet. Pick a group on the left to start one.
              </p>
            </div>
          ) : (
            campaigns.map((campaign) => (
              <CallCampaignCard
                key={campaign.id}
                campaign={campaign}
                onChanged={() => void reload()}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
