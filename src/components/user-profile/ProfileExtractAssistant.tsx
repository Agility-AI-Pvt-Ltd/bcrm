"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/auth";
import {
  analyzeProfileIntelligence,
  applyProfileIntelligence,
  type ProfileAnalyzeResult,
  type ProfileFocus,
  type ProfileProposal,
} from "@/lib/profileIntelligence";

type Props = {
  focus?: ProfileFocus;
  title?: string;
  description?: string;
  onApplied?: (user: AuthUser) => void;
};

function formatValue(value: string | string[] | null | undefined) {
  if (Array.isArray(value)) {
    return value.length ? value.join(", ") : "—";
  }
  return value?.trim() ? value : "—";
}

export default function ProfileExtractAssistant({
  focus = "both",
  title = "AI Profile Fill",
  description = "Paste text or drop a PDF / Excel. AI extracts fields — you confirm before anything is saved.",
  onApplied,
}: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<ProfileAnalyzeResult | null>(null);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [mergeLocations, setMergeLocations] = useState<"union" | "replace">("union");
  const [editable, setEditable] = useState<ProfileProposal>({});

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const acceptFile = (next: File | null) => {
    setFile(next);
    setResult(null);
    setSelectedFields([]);
    setError("");
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    acceptFile(event.target.files?.[0] || null);
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const next = event.dataTransfer.files?.[0] || null;
    if (next) acceptFile(next);
  };

  const runAnalyze = async () => {
    if (!text.trim() && !file) {
      setError("Paste text or choose a PDF / Excel / CSV file first.");
      return;
    }
    setAnalyzing(true);
    setError("");
    setNotice("");
    setResult(null);
    try {
      const analysis = await analyzeProfileIntelligence({
        text: text.trim() || undefined,
        file,
        focus,
      });
      setResult(analysis);
      setEditable(analysis.proposed || {});
      const defaults = (analysis.field_diffs || [])
        .filter((item) => item.proposed != null && item.proposed !== "")
        .map((item) => item.field);
      setSelectedFields(defaults);
      setNotice(analysis.message || analysis.summary || "Review the proposed fields.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "AI extraction failed.");
    } finally {
      setAnalyzing(false);
    }
  };

  const toggleField = (field: string) => {
    setSelectedFields((current) =>
      current.includes(field)
        ? current.filter((item) => item !== field)
        : [...current, field],
    );
  };

  const updateField = (field: string, value: string) => {
    setEditable((current) => ({
      ...current,
      [field]:
        field === "work_locations"
          ? value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean)
          : value,
    }));
  };

  const confirmApply = async () => {
    if (!selectedFields.length) {
      setError("Select at least one field to apply.");
      return;
    }
    setApplying(true);
    setError("");
    try {
      const applied = await applyProfileIntelligence({
        profile: editable,
        selected_fields: selectedFields,
        merge_work_locations: mergeLocations,
      });
      setNotice(applied.message);
      setResult(null);
      setSelectedFields([]);
      setText("");
      setFile(null);
      onApplied?.(applied.profile);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply profile updates.");
    } finally {
      setApplying(false);
    }
  };

  return (
    <section className="ai-shine-panel overflow-hidden">
      <div className="rounded-[0.92rem] bg-white p-5 dark:bg-gray-dark">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-brand-500">
              LangGraph agent
            </p>
            <h3 className="mt-1 text-lg font-semibold text-gray-900 dark:text-white/90">
              {title}
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          </div>
          <Badge color="info" size="sm">
            Extract → Polish → Confirm
          </Badge>
        </div>

        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1.5 block text-gray-500">Paste notes, bio, or card text</span>
            <textarea
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                setResult(null);
              }}
              rows={4}
              placeholder="e.g. Rahul Mehta, +91 98765 43210, office Whitefield. Operates in Indiranagar, Sarjapur, HSR…"
              className="min-h-24 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm dark:border-gray-700 dark:text-white/90"
            />
          </label>

          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-6 text-center transition ${
              dragging
                ? "border-brand-500 bg-brand-50/50 dark:bg-brand-500/10"
                : "border-gray-300 dark:border-gray-700"
            }`}
          >
            <input
              type="file"
              accept=".pdf,.xlsx,.xlsm,.xls,.csv,.txt,application/pdf,text/plain,text/csv"
              className="hidden"
              onChange={onFileInput}
            />
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              Drop PDF, Excel, CSV, or text
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {file ? file.name : "or click to browse"}
            </p>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={analyzing}
              onClick={() => void runAnalyze()}
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {analyzing ? "AI analyzing…" : "Extract with AI"}
            </button>
            {(file || text || result) && (
              <button
                type="button"
                onClick={() => {
                  setText("");
                  setFile(null);
                  setResult(null);
                  setSelectedFields([]);
                  setError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

        {result ? (
          <div className="mt-5 space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-white/[0.02]">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge
                  color={
                    result.status === "ready"
                      ? "success"
                      : result.status === "error"
                        ? "error"
                        : "warning"
                  }
                  size="sm"
                >
                  {result.status}
                </Badge>
                {result.llm?.polish_used ? (
                  <Badge color="info" size="sm">
                    Post-processed by LLM
                  </Badge>
                ) : null}
                {result.source_meta?.content_type ? (
                  <Badge color="light" size="sm">
                    {String(result.source_meta.content_type)}
                  </Badge>
                ) : null}
              </div>
              <p className="text-sm leading-relaxed text-gray-800 dark:text-gray-200">
                {result.summary || result.message}
              </p>
              {!!result.highlights?.length && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {result.highlights.map((item) => (
                    <li
                      key={item}
                      className="rounded-full bg-white px-3 py-1 text-xs font-medium text-gray-700 ring-1 ring-gray-200 dark:bg-gray-900 dark:text-gray-200 dark:ring-gray-700"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {result.status === "ready" && !!result.field_diffs.length ? (
              <>
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Confirm before saving
                  </p>
                  <div className="space-y-3">
                    {result.field_diffs.map((diff) => {
                      const checked = selectedFields.includes(diff.field);
                      const isLocations = diff.field === "work_locations";
                      const editValue = isLocations
                        ? (editable.work_locations || []).join(", ")
                        : String(
                            (editable as Record<string, unknown>)[diff.field] ??
                              diff.proposed ??
                              "",
                          );
                      return (
                        <div
                          key={diff.field}
                          className={`rounded-xl border bg-white p-3 dark:bg-gray-900/40 ${
                            checked
                              ? "border-brand-500"
                              : "border-gray-200 dark:border-gray-800"
                          }`}
                        >
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              className="mt-1"
                              checked={checked}
                              onChange={() => toggleField(diff.field)}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                                  {diff.label}
                                </span>
                                <span className="text-[11px] text-gray-500">
                                  {Math.round((diff.confidence || 0) * 100)}% confidence
                                </span>
                                {diff.changed ? (
                                  <Badge color="warning" size="sm">
                                    changes current
                                  </Badge>
                                ) : (
                                  <Badge color="light" size="sm">
                                    new / same
                                  </Badge>
                                )}
                              </span>
                              <span className="mt-1 block text-xs text-gray-500">
                                Current: {formatValue(diff.current)}
                              </span>
                              <input
                                value={editValue}
                                disabled={!checked}
                                onChange={(event) =>
                                  updateField(diff.field, event.target.value)
                                }
                                className="mt-2 h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm disabled:opacity-50 dark:border-gray-700 dark:text-white/90"
                              />
                            </span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {selectedFields.includes("work_locations") ? (
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-300">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mergeLocations"
                        checked={mergeLocations === "union"}
                        onChange={() => setMergeLocations("union")}
                      />
                      Merge with existing locations
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="mergeLocations"
                        checked={mergeLocations === "replace"}
                        onChange={() => setMergeLocations("replace")}
                      />
                      Replace existing locations
                    </label>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={applying || selectedFields.length === 0}
                    onClick={() => void confirmApply()}
                    className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                  >
                    {applying
                      ? "Saving…"
                      : `Confirm & apply (${selectedFields.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResult(null);
                      setSelectedFields([]);
                    }}
                    className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Discard
                  </button>
                </div>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
