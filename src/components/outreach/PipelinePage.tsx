"use client";

/**
 * Lead Pipeline — the six stages a real-estate customer moves through, and the
 * engagement tier that says how warm they are.
 *
 * The tier is the column a broker scans first: `high` and `medium` are people who
 * wrote back, `low` is everyone who has stayed silent. It is derived by the
 * backend from reply behaviour, not typed in by hand, so this view is read-mostly
 * on purpose — the board tells you where to spend your afternoon.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import OfficeShiftCard from "@/components/outreach/OfficeShiftCard";
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
  type LeadPage,
  type PipelineSnapshot,
} from "@/lib/outreach";

const PAGE_SIZE = 25;

const TIER_HINTS: Record<string, string> = {
  high: "Replied more than once — call these first",
  medium: "Replied once — keep the conversation going",
  low: "No reply yet — the AI keeps following up",
};

const STAGE_HINTS: Record<string, string> = {
  New: "In the list, not messaged yet",
  Contacted: "First message sent, no reply yet",
  Replied: "Wrote back at least once",
  "Visit Scheduled": "Agreed to see the property",
  Negotiating: "Talking price or terms",
  Closed: "Rented or bought — no more outreach",
};

export default function PipelinePage() {
  const [snapshot, setSnapshot] = useState<PipelineSnapshot | null>(null);
  const [page, setPage] = useState<LeadPage | null>(null);
  const [stage, setStage] = useState("");
  const [tier, setTier] = useState("");
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadSnapshot = useCallback(async () => {
    try {
      setSnapshot(await getPipeline());
    } catch (error) {
      setNotice(
        error instanceof ApiError ? error.message : "Could not read the pipeline.",
      );
    }
  }, []);

  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      setPage(
        await listLeads({
          stage: stage || undefined,
          tier: tier || undefined,
          limit: PAGE_SIZE,
          offset,
        }),
      );
    } catch (error) {
      setNotice(error instanceof ApiError ? error.message : "Could not load leads.");
    } finally {
      setLoading(false);
    }
  }, [stage, tier, offset]);

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

  const stages = snapshot?.stages?.length ? snapshot.stages : [...CUSTOMER_STAGES];
  const tiers = snapshot?.tiers?.length ? snapshot.tiers : [...ENGAGEMENT_TIERS];
  const counts = snapshot?.counts ?? {};
  const total = counts.total ?? 0;

  // Derived from `snapshot` rather than from `tiers`/`counts`, which are fresh
  // objects on every render and would defeat the memo.
  const replyRate = useMemo(() => {
    const values = snapshot?.counts ?? {};
    const overall = values.total ?? 0;
    if (!overall) return 0;
    const engaged = (snapshot?.tiers ?? ENGAGEMENT_TIERS)
      .filter((name) => name !== "low")
      .reduce((carry, name) => carry + (values[name] || 0), 0);
    return Math.round((engaged / overall) * 100);
  }, [snapshot]);

  const setFilter = (nextStage: string, nextTier: string) => {
    setStage(nextStage);
    setTier(nextTier);
    setOffset(0);
  };

  return (
    <div>
      <PageBreadcrumb pageTitle="Lead Pipeline" />

      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Where every customer stands
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {total} lead(s) · {replyRate}% have written back. Stages and tiers are
            maintained by the AI as conversations happen.
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

      {/* the six stages, as a board header */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stages.map((name) => {
          const active = stage === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(active ? "" : name, tier)}
              title={STAGE_HINTS[name] || ""}
              className={`rounded-2xl border p-4 text-left transition ${
                active
                  ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-brand-300 dark:border-gray-800 dark:bg-white/[0.03]"
              }`}
            >
              <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
                {counts[name] ?? 0}
              </p>
              <p className="mt-1 text-xs font-medium text-gray-600 dark:text-gray-400">
                {name}
              </p>
              <p className="mt-1 text-[11px] leading-snug text-gray-400">
                {STAGE_HINTS[name] || ""}
              </p>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 xl:col-span-8">
          {/* the engagement tier column, requirement #3 */}
          <div className="mb-4 grid grid-cols-3 gap-3">
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
                <h2 className="font-semibold text-gray-900 dark:text-white/90">Leads</h2>
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
                {(stage || tier) && (
                  <button
                    type="button"
                    onClick={() => setFilter("", "")}
                    className="text-xs font-medium text-brand-500 hover:text-brand-600"
                  >
                    Clear
                  </button>
                )}
              </div>
              <span className="text-xs text-gray-500">
                {page?.total ?? 0} matching
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-max text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-5 py-3 font-medium">Customer</th>
                    <th className="px-5 py-3 font-medium">Stage</th>
                    <th className="px-5 py-3 font-medium">Engagement</th>
                    <th className="px-5 py-3 font-medium">Looking for</th>
                    <th className="px-5 py-3 font-medium">Sent</th>
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
                        Nothing here yet. Upload a list on the Outreach page to start.
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
        </div>

        <div className="col-span-12 xl:col-span-4">
          <OfficeShiftCard onWorkDone={reload} />
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

function LeadRow({ lead }: { lead: Lead }) {
  const wants = [lead.bhk, lead.preferred_location, lead.budget_label]
    .filter(Boolean)
    .join(" · ");

  return (
    <tr>
      <td className="px-5 py-3">
        <p className="font-medium text-gray-800 dark:text-white/90">
          {lead.name || "Unnamed"}
        </p>
        <p className="text-xs text-gray-500">{lead.phone || lead.email || "—"}</p>
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
            <span className="text-[11px] text-gray-400" title="No more automatic messages">
              paused
            </span>
          ) : null}
        </div>
      </td>
      <td className="max-w-[200px] truncate px-5 py-3 text-gray-600 dark:text-gray-400" title={wants}>
        {wants || "—"}
      </td>
      <td className="px-5 py-3 text-gray-500">
        {lead.messaged_count}
        {lead.first_messaged_at ? (
          <span className="ml-1 text-xs text-gray-400">
            (first {formatSince(lead.first_messaged_at)})
          </span>
        ) : null}
      </td>
      <td className="px-5 py-3 text-gray-500">{lead.reply_count}</td>
      <td className="px-5 py-3 text-gray-500">{formatWhen(lead.last_reply_at)}</td>
    </tr>
  );
}
