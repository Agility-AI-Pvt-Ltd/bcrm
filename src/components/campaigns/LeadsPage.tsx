"use client";

/**
 * Leads — the people who actually wrote back on WhatsApp.
 *
 * The rule, in the broker's words: "a single reply will also be considered a
 * lead". So this page is not a stage board. It asks the backend for contacts with
 * `replied: true`, which filters on the reply counter, and that counter only ever
 * moves when a real inbound WhatsApp message arrives. Meta reports our own sends
 * under `statuses` and never under `messages`, so an inbound row is a human by
 * construction — the AI's own replies can never land anyone on this list.
 *
 * Why reply-based and not stage-based: a stage can be set by an import, by the
 * LLM reading a thread, or by the 6-hourly repair sweep. `reply_count` cannot. So
 * "did a human answer us" stays honest even when stages drift.
 *
 * This is the separate view for leads. /contacts remains the full book of
 * business and /pipeline remains the stage-and-tier board; nobody is removed from
 * either by appearing here.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import {
  CUSTOMER_STAGES,
  ENGAGEMENT_TIERS,
  formatSince,
  formatWhen,
  getPipeline,
  listLeads,
  stageBadgeColor,
  tierBadgeColor,
  type Lead,
  type LeadPage as LeadPageData,
  type PipelineSnapshot,
} from "@/lib/outreach";

const PAGE_SIZE = 25;

/** Typing in the search box should not fire a request per keystroke. */
const SEARCH_DEBOUNCE_MS = 350;

const TIER_HINTS: Record<string, string> = {
  high: "Replied more than once, or already deep in the funnel — call first",
  medium: "Replied once — keep the conversation warm",
  low: "Graded low despite replying — usually an opt-out",
};

const STAGE_HINTS: Record<string, string> = {
  Replied: "Wrote back, nothing booked yet",
  "Visit Scheduled": "Agreed to see the property",
  Negotiating: "Talking price or terms",
  Closed: "Rented, bought, or opted out",
};

export default function LeadsPage() {
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);
  const [page, setPage] = useState<LeadPageData | null>(null);
  const [stage, setStage] = useState("");
  const [tier, setTier] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Debounce the box into the value the query actually uses.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadSnapshot = useCallback(async () => {
    try {
      setSnapshot(await getPipeline());
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Could not read the lead totals.",
      );
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      setPage(
        await listLeads({
          replied: true,
          stage: stage || undefined,
          tier: tier || undefined,
          search: search || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
      );
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, [stage, tier, search, offset]);

  useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  useEffect(() => {
    void loadLeads();
  }, [loadLeads]);

  const reload = useCallback(() => {
    void loadSnapshot();
    void loadLeads();
  }, [loadSnapshot, loadLeads]);

  const counts = snapshot?.counts ?? {};
  const tiers = snapshot?.tiers?.length ? snapshot.tiers : [...ENGAGEMENT_TIERS];

  // Someone who replies is advanced to at least `Replied`, so the earlier stages
  // would only ever render an empty filter. Sliced from the shared vocabulary
  // rather than hardcoded, so a new stage appears here automatically.
  const leadStages = useMemo(() => {
    const all = snapshot?.stages?.length ? snapshot.stages : [...CUSTOMER_STAGES];
    return all.slice(Math.max(0, all.indexOf("Replied")));
  }, [snapshot]);

  const stats = useMemo(() => {
    const values = snapshot?.counts ?? {};
    const leads = values.replied ?? 0;
    const everyone = values.total ?? 0;
    const rate = everyone ? Math.round((leads / everyone) * 100) : 0;
    return [
      {
        value: String(leads),
        label: "Leads",
        hint: "Replied on WhatsApp at least once",
      },
      {
        value: String(values.multi_reply ?? 0),
        label: "In conversation",
        hint: "Wrote back more than once",
      },
      {
        value: String(values["Visit Scheduled"] ?? 0),
        label: "Visits scheduled",
        hint: "Agreed to see a property",
      },
      {
        value: `${rate}%`,
        label: "Reply rate",
        hint: `${leads} of ${everyone} contact(s) answered`,
      },
    ];
  }, [snapshot]);

  const setFilter = (nextStage: string, nextTier: string) => {
    setStage(nextStage);
    setTier(nextTier);
    setOffset(0);
  };

  const filtered = Boolean(stage || tier || search);

  return (
    <div>
      <PageBreadcrumb pageTitle="Leads" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Everyone who wrote back
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            A real person replying on WhatsApp — even once — makes them a lead, and
            they are listed here separately from the rest of your contacts.
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Refresh
        </button>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {card.value}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
            <p className="mt-1 text-[11px] leading-snug text-gray-400">{card.hint}</p>
          </div>
        ))}
      </div>

      {/* Warmth first: it is the column that decides who gets called today. */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tiers.map((name) => {
          const active = tier === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(stage, active ? "" : name)}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.03]"
              }`}
            >
              <div className="flex items-center gap-2">
                <Badge color={tierBadgeColor(name)} size="sm">
                  {name}
                </Badge>
                <span className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  {counts[name] ?? 0}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-gray-500">
                {TIER_HINTS[name] || ""}
              </p>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-gray-900 dark:text-white/90">
              Replied leads
            </h2>
            {stage ? (
              <Badge color={stageBadgeColor(stage)} size="sm">
                {stage}
              </Badge>
            ) : null}
            {tier ? (
              <Badge color={tierBadgeColor(tier)} size="sm">
                {tier}
              </Badge>
            ) : null}
            {filtered && (
              <button
                type="button"
                onClick={() => {
                  setFilter("", "");
                  setSearchInput("");
                }}
                className="text-xs font-medium text-brand-500 hover:text-brand-600"
              >
                Clear
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search name, phone or what they said"
              className="w-64 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-transparent dark:text-gray-300"
            />
            <span className="text-xs text-gray-500">{page?.total ?? 0} matching</span>
          </div>
        </div>

        {/* Stage narrows the list further, but only across the post-reply stages. */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          {leadStages.map((name) => {
            const active = stage === name;
            return (
              <button
                key={name}
                type="button"
                onClick={() => setFilter(active ? "" : name, tier)}
                title={STAGE_HINTS[name] || ""}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                    : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-400"
                }`}
              >
                {name}
                <span className="ml-1.5 text-gray-400">{counts[name] ?? 0}</span>
              </button>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-5 py-3 font-medium">Lead</th>
                <th className="px-5 py-3 font-medium">What they said</th>
                <th className="px-5 py-3 font-medium">Stage</th>
                <th className="px-5 py-3 font-medium">Engagement</th>
                <th className="px-5 py-3 font-medium">Looking for</th>
                <th className="px-5 py-3 font-medium">Replies</th>
                <th className="px-5 py-3 font-medium">Last reply</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    Loading leads…
                  </td>
                </tr>
              ) : !page || page.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-gray-500">
                    {filtered
                      ? "No lead matches these filters."
                      : "No one has replied yet. Once a customer answers on WhatsApp they appear here automatically."}
                  </td>
                </tr>
              ) : (
                page.items.map((lead) => <LeadRow key={lead.id} lead={lead} />)
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
          <span className="text-xs text-gray-500">
            Showing {page?.items.length ? offset + 1 : 0}–
            {offset + (page?.items.length ?? 0)} of {page?.total ?? 0}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={loading || offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || offset + PAGE_SIZE >= (page?.total ?? 0)}
              onClick={() => setOffset(offset + PAGE_SIZE)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
            >
              Next
            </button>
          </div>
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

/** WhatsApp deep link. Digits only — wa.me rejects "+" and spaces. */
function whatsappHref(phone: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 10 ? `https://wa.me/${digits}` : null;
}

function LeadRow({ lead }: { lead: Lead }) {
  const wants = [lead.bhk, lead.preferred_location, lead.budget_label]
    .filter(Boolean)
    .join(" · ");
  const chat = whatsappHref(lead.phone);

  return (
    <tr>
      <td className="px-5 py-3">
        <p className="font-medium text-gray-800 dark:text-white/90">
          {lead.name || "Unnamed"}
        </p>
        {chat ? (
          <a
            href={chat}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-brand-500 hover:text-brand-600"
          >
            {lead.phone}
          </a>
        ) : (
          <p className="text-xs text-gray-500">{lead.phone || lead.email || "—"}</p>
        )}
      </td>
      <td className="px-5 py-3">
        {lead.last_reply_text ? (
          <p
            className="max-w-[340px] truncate italic text-gray-700 dark:text-gray-300"
            title={lead.last_reply_text}
          >
            “{lead.last_reply_text}”
          </p>
        ) : (
          <span
            className="text-gray-400"
            title="They replied, but the message had no text — an image, sticker or voice note."
          >
            —
          </span>
        )}
      </td>
      <td className="px-5 py-3">
        <Badge color={stageBadgeColor(lead.customer_stage)} size="sm">
          {lead.customer_stage}
        </Badge>
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Badge color={tierBadgeColor(lead.engagement_tier)} size="sm">
            {lead.engagement_tier}
          </Badge>
          {lead.outreach_paused ? (
            <span
              className="text-[11px] text-gray-400"
              title="Opted out — no more automatic messages"
            >
              opted out
            </span>
          ) : null}
        </div>
      </td>
      <td
        className="max-w-[200px] truncate px-5 py-3 text-gray-600 dark:text-gray-400"
        title={wants}
      >
        {wants || "—"}
      </td>
      <td className="px-5 py-3 text-gray-500">{lead.reply_count}</td>
      <td className="px-5 py-3 text-gray-500" title={formatWhen(lead.last_reply_at)}>
        {formatSince(lead.last_reply_at)}
      </td>
    </tr>
  );
}
