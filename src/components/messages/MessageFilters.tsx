"use client";

/**
 * The filter and sort rail for the Messages screen.
 *
 * Presentational on purpose: it owns no data and no requests, so the workspace
 * stays the single place where "what is on screen" is decided. Every control maps
 * to one key the backend already understands, and the vocabulary is fetched from
 * /conversations/filters rather than hardcoded, so adding a stage or a sort on the
 * server makes it appear here without a frontend change.
 *
 * Layout rule: one labelled section per question the agent is asking, each fenced
 * off by a rule. Filters are pills of a single uniform shape — the colour lives in
 * a small dot rather than in a status badge, so a control never reads as a live
 * status the way a nested `Badge` did. The labels, fields, rules and dots all come
 * from `tokens.tsx`, which every panel on this screen shares.
 *
 * Height is not this component's business. The rail is taller than the column it
 * sits in on almost any screen, so `MessagesWorkspace` owns the scroll region and
 * the bottom rule — that keeps both of the column's scrolling areas declared in
 * one place, next to each other, where their height budgets can be read together.
 */

import {
  BAND_HINTS,
  BAND_LABELS,
  SORT_HINTS,
  SORT_LABELS,
  WINDOW_FILTER_LABELS,
  type FilterVocabulary,
  type InboxFilters,
  type InboxSort,
} from "@/lib/inbox";
import { CUSTOMER_STAGES, ENGAGEMENT_TIERS } from "@/lib/outreach";
import { useState } from "react";
import {
  dotFor,
  FIELD,
  LABEL,
  Pill,
  PillRow,
  SearchIcon,
  SELECT,
  stageDot,
} from "@/components/messages/tokens";

/** Silences worth asking about. Anything shorter is just a normal reply gap. */
const QUIET_CHOICES = [
  { value: 3, label: "3+ days" },
  { value: 7, label: "1+ week" },
  { value: 14, label: "2+ weeks" },
  { value: 30, label: "1+ month" },
];

type Props = {
  filters: InboxFilters;
  sort: InboxSort | string;
  vocabulary: FilterVocabulary | null;
  activeCount: number;
  searchInput: string;
  onSearchInput: (value: string) => void;
  onPatch: (patch: Partial<InboxFilters>) => void;
  onSort: (sort: string) => void;
  onClear: () => void;
};

export default function MessageFilters({
  filters,
  sort,
  vocabulary,
  activeCount,
  searchInput,
  onSearchInput,
  onPatch,
  onSort,
  onClear,
}: Props) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const stages = vocabulary?.stages?.length ? vocabulary.stages : [...CUSTOMER_STAGES];
  const tiers = vocabulary?.tiers?.length ? vocabulary.tiers : [...ENGAGEMENT_TIERS];
  const bands = vocabulary?.bands?.length
    ? vocabulary.bands
    : (["hot", "warm", "cool", "cold"] as const).map((value) => ({
        value,
        label: BAND_LABELS[value],
        hint: BAND_HINTS[value],
        min: 0,
        max: 100,
      }));
  const sorts = vocabulary?.sorts?.length
    ? vocabulary.sorts
    : Object.keys(SORT_LABELS).map((value) => ({
        value,
        label: SORT_LABELS[value],
        hint: SORT_HINTS[value] || "",
      }));
  const windows = vocabulary?.window_filters?.length
    ? vocabulary.window_filters
    : Object.entries(WINDOW_FILTER_LABELS).map(([value, label]) => ({ value, label }));

  /** A filter that is already on is turned off by clicking it again. */
  const toggle = (key: keyof InboxFilters, value: string) =>
    onPatch({ [key]: filters[key] === value ? undefined : value } as Partial<InboxFilters>);

  const toggleFlag = (key: "replied" | "awaiting" | "scheduled") =>
    onPatch({ [key]: filters[key] ? undefined : true });

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: Search, Sort, Reset */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-1 border-b border-gray-100 dark:border-gray-800">
        <div className="relative min-w-[280px] max-w-lg flex-1">
          <SearchIcon />
          <input
            type="search"
            value={searchInput}
            onChange={(event) => onSearchInput(event.target.value)}
            placeholder="Search name, phone or message"
            className={`${FIELD} pl-9 bg-gray-50 dark:bg-gray-800/50`}
          />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={`${LABEL} mb-0`}>Sort</span>
            <select
              value={sort}
              onChange={(event) => onSort(event.target.value)}
              aria-label="Sort chats by"
              className={`${SELECT} w-auto min-w-[140px]`}
            >
              {sorts.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className={`h-9 shrink-0 rounded-lg border px-4 text-xs font-medium transition ${
                showAdvanced || activeCount > 0
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-400"
                  : "border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03]"
              }`}
            >
              Filters {activeCount > 0 ? `(${activeCount})` : ""}
            </button>

            <button
              type="button"
              onClick={onClear}
              disabled={activeCount === 0 && searchInput.trim() === ""}
              className="h-9 shrink-0 rounded-lg border border-gray-300 px-4 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03]"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: Filter Pills & Selects */}
      {showAdvanced && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-2">
        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`}>Interest</span>
          <PillRow>
            {bands.map((band) => (
              <Pill
                key={band.value}
                label={band.label}
                hint={band.hint}
                dot={dotFor(band.value)}
                active={filters.band === band.value}
                onClick={() => toggle("band", band.value)}
              />
            ))}
          </PillRow>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`}>Stage</span>
          <PillRow>
            {stages.map((name) => (
              <Pill
                key={name}
                label={name}
                dot={stageDot(name)}
                active={filters.stage === name}
                onClick={() => toggle("stage", name)}
              />
            ))}
          </PillRow>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`}>Show</span>
          <PillRow>
            <Pill
              label="Waiting on you"
              hint="They wrote last and nobody has answered"
              active={Boolean(filters.awaiting)}
              onClick={() => toggleFlag("awaiting")}
            />
            <Pill
              label="Replied"
              hint="Only chats where a real person wrote back"
              active={Boolean(filters.replied)}
              onClick={() => toggleFlag("replied")}
            />
            <Pill
              label="Has a date"
              hint="A site visit or follow-up is on the calendar"
              active={Boolean(filters.scheduled)}
              onClick={() => toggleFlag("scheduled")}
            />
            <Pill
              label="Opted out"
              hint="Customers who asked us to stop"
              active={filters.paused === true}
              onClick={() => onPatch({ paused: filters.paused === true ? undefined : true })}
            />
          </PillRow>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`}>Engagement</span>
          <select
            value={filters.tier || ""}
            onChange={(event) => onPatch({ tier: event.target.value || undefined })}
            className={`${SELECT} w-auto`}
          >
            <option value="">Any</option>
            {tiers.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`} title="WhatsApp limits">
            Can text
          </span>
          <select
            value={filters.window || ""}
            onChange={(event) => onPatch({ window: event.target.value || undefined })}
            className={`${SELECT} w-auto`}
          >
            <option value="">Any</option>
            {windows.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`}>Gone quiet</span>
          <select
            value={filters.quiet_days ? String(filters.quiet_days) : ""}
            onChange={(event) =>
              onPatch({
                quiet_days: event.target.value ? Number(event.target.value) : undefined,
              })
            }
            className={`${SELECT} w-auto`}
          >
            <option value="">Any</option>
            {QUIET_CHOICES.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className={`${LABEL} mb-0`}>Score</span>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={100}
              placeholder="0"
              value={filters.min_interest ?? ""}
              onChange={(event) =>
                onPatch({
                  min_interest: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              className={`${FIELD} w-16 px-2 text-center`}
            />
            <span className="text-xs text-gray-400">-</span>
            <input
              type="number"
              min={0}
              max={100}
              placeholder="100"
              value={filters.max_interest ?? ""}
              onChange={(event) =>
                onPatch({
                  max_interest: event.target.value ? Number(event.target.value) : undefined,
                })
              }
              className={`${FIELD} w-16 px-2 text-center`}
            />
          </div>
        </div>
        </div>
      )}
    </div>
  );
}
