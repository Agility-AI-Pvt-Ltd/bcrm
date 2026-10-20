"use client";

/**
 * The people behind a headline number on the Leads page.
 *
 * A tile that says "1 visit scheduled" invites one question — *who?* — and
 * the table further down the page answered it badly: it moved, out of sight,
 * and showed contact columns rather than the thing the tile counted. This
 * panel opens directly under the tiles and shows, for each tile, the details
 * that tile is about:
 *
 *   Waiting for a call  → how long they have waited, what they want, Mark called
 *   Leads               → what they said, score, when
 *   In conversation     → how many replies, what they said last, score
 *   Visits scheduled    → when and where the visit is, and its status
 *
 * The list comes from the same query the tile's count does — the leads endpoint
 * with the tile's filter and the selected period — so the number pressed and
 * the rows shown cannot disagree. Visit times are joined on from the visits
 * endpoint by contact, then by phone; a contact marked "Visit Scheduled" with no
 * booked time says so rather than vanishing.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import { bandBadgeColor, interestBand, interestLabel } from "@/lib/inbox";
import {
  formatSince,
  formatWhen,
  listLeads,
  type Lead,
  type LeadPeriod,
} from "@/lib/outreach";
import { getVisits, type Visit } from "@/lib/siteVisits";

export type TileKey = "waiting" | "leads" | "conversation" | "visits";

/** Enough to scan at a glance; the rest are one click away in the table. */
const PANEL_LIMIT = 25;

const TITLES: Record<TileKey, string> = {
  waiting: "Waiting for a call",
  leads: "Leads",
  conversation: "In conversation",
  visits: "Visits scheduled",
};

const EMPTY: Record<TileKey, string> = {
  waiting: "Nobody is waiting to be phoned.",
  leads: "Nobody has replied in this period yet.",
  conversation: "Nobody has written back more than once in this period.",
  visits: "No visits are scheduled in this period.",
};

const TONE_BADGE = {
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
  muted: "light",
} as const;

function digits(phone: string | null | undefined) {
  return (phone || "").replace(/\D/g, "").slice(-10);
}

function whatsappHref(phone: string | null) {
  const all = (phone || "").replace(/\D/g, "");
  return all.length >= 10 ? `https://wa.me/${all}` : null;
}

function filterFor(key: TileKey) {
  switch (key) {
    case "waiting":
      return { awaitingCallback: true };
    case "conversation":
      return { multiReply: true };
    case "visits":
      return { stage: "Visit Scheduled" };
    default:
      return { replied: true };
  }
}

/**
 * The visit to show next to a lead: the soonest live one, else the latest.
 * Matched on contact first; phone is the fallback because a visit booked from
 * a chat before the contact existed carries only the number.
 */
function visitFor(lead: Lead, visits: Visit[]): Visit | null {
  const phone = digits(lead.phone);
  const mine = visits.filter(
    (visit) =>
      visit.contact_id === lead.id || (phone && digits(visit.customer_phone) === phone),
  );
  if (!mine.length) return null;
  const now = Date.now();
  const live = mine
    .filter((visit) => visit.scheduled_at && new Date(visit.scheduled_at).getTime() >= now)
    .sort((a, b) => String(a.scheduled_at).localeCompare(String(b.scheduled_at)));
  return live[0] ?? mine[0];
}

function Score({ score }: { score: number | null }) {
  const band = interestBand(score);
  if (score === null || band === null) {
    return <span className="text-gray-400">—</span>;
  }
  return (
    <span title={interestLabel(score)}>
      <Badge color={bandBadgeColor(band)} size="sm">
        {score}
      </Badge>
    </span>
  );
}

export default function LeadTileDetails({
  tile,
  period,
  periodLabel,
  refreshKey,
  marking,
  onMarkCalled,
  onShowInTable,
  onClose,
}: {
  tile: TileKey;
  period: LeadPeriod;
  periodLabel: string;
  /** Bumped by the page after a change (a lead marked called) to re-read. */
  refreshKey: number;
  marking: string;
  onMarkCalled: (lead: Lead) => void;
  onShowInTable: (tile: TileKey) => void;
  onClose: () => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [page, visitList] = await Promise.all([
        listLeads({ ...filterFor(tile), period, limit: PANEL_LIMIT, offset: 0 }),
        // Upcoming and past both: a lead marked "Visit Scheduled" whose visit
        // was this morning should still show when it was.
        tile === "visits" ? getVisits("all", 200) : Promise.resolve(null),
      ]);
      setLeads(page.items);
      setTotal(page.total);
      setVisits(visitList?.items ?? []);
    } catch (problem) {
      setError(problem instanceof ApiError ? problem.message : "Could not load this list.");
    } finally {
      setLoading(false);
    }
  }, [tile, period]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Escape closes, the way any panel that opened on a click should.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scopeNote =
    tile === "waiting"
      ? "Every period — a call still owed is shown whatever window is selected."
      : period === "all"
        ? "All time"
        : periodLabel;

  return (
    <section
      id="lead-tile-details"
      aria-label={`${TITLES[tile]} — details`}
      className="mb-6 rounded-2xl border border-brand-200 bg-white shadow-theme-xs dark:border-brand-500/30 dark:bg-white/[0.03]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white/90">
            {TITLES[tile]}
            <span className="ml-2 text-sm font-normal text-gray-500">
              {loading ? "…" : `${total} ${total === 1 ? "person" : "people"}`}
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">{scopeNote}</p>
        </div>
        <div className="flex items-center gap-3">
          {tile === "visits" ? (
            <Link
              href="/site-visits"
              className="text-xs font-medium text-brand-500 hover:text-brand-600"
            >
              Open site visits
            </Link>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
          >
            Close
          </button>
        </div>
      </header>

      {loading ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">Loading…</p>
      ) : error ? (
        <p className="px-5 py-8 text-center text-sm text-error-500">{error}</p>
      ) : leads.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-gray-500">{EMPTY[tile]}</p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-800">
          {leads.map((lead) => (
            <DetailRow
              key={lead.id}
              tile={tile}
              lead={lead}
              visit={tile === "visits" ? visitFor(lead, visits) : null}
              marking={marking === lead.id}
              onMarkCalled={onMarkCalled}
            />
          ))}
        </ul>
      )}

      {!loading && total > leads.length ? (
        <div className="border-t border-gray-100 px-5 py-3 text-right dark:border-gray-800">
          <button
            type="button"
            onClick={() => onShowInTable(tile)}
            className="text-xs font-medium text-brand-500 hover:text-brand-600"
          >
            Showing {leads.length} of {total} — see all in the table
          </button>
        </div>
      ) : null}
    </section>
  );
}

function DetailRow({
  tile,
  lead,
  visit,
  marking,
  onMarkCalled,
}: {
  tile: TileKey;
  lead: Lead;
  visit: Visit | null;
  marking: boolean;
  onMarkCalled: (lead: Lead) => void;
}) {
  const chat = whatsappHref(lead.phone);
  const wants = [lead.bhk, lead.preferred_location, lead.budget_label].filter(Boolean).join(" · ");

  return (
    <li className="grid grid-cols-1 gap-3 px-5 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-medium text-gray-800 dark:text-white/90">
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
      </div>

      <div className="min-w-0 text-sm">
        {tile === "visits" ? (
          visit ? (
            <>
              <p className="font-medium text-gray-800 dark:text-white/90">
                {visit.view.when_label || formatWhen(visit.scheduled_at)}
              </p>
              <p className="truncate text-xs text-gray-500">
                {[visit.property_title, visit.property_location].filter(Boolean).join(" · ") ||
                  "No property named"}
                {visit.assigned_name ? ` · with ${visit.assigned_name}` : ""}
              </p>
            </>
          ) : (
            <p className="text-xs text-gray-500">
              Agreed to a visit — no time booked yet
            </p>
          )
        ) : (
          <>
            {lead.last_reply_text ? (
              <p
                className="truncate italic text-gray-700 dark:text-gray-300"
                title={lead.last_reply_text}
              >
                “{lead.last_reply_text}”
              </p>
            ) : (
              <p className="text-xs text-gray-400">No text in their last reply</p>
            )}
            <p className="truncate text-xs text-gray-500">
              {tile === "waiting" && lead.callback_requested_at
                ? `Asked for a call ${formatSince(lead.callback_requested_at)} · `
                : ""}
              {tile === "conversation" ? `${lead.reply_count} replies · ` : ""}
              {wants ? `${wants} · ` : ""}
              last reply {formatSince(lead.last_reply_at)}
            </p>
          </>
        )}
      </div>

      <div className="flex items-center gap-2 sm:justify-end">
        {tile === "visits" && visit ? (
          <Badge color={TONE_BADGE[visit.view.tone] ?? "light"} size="sm">
            {visit.view.label || visit.status}
          </Badge>
        ) : (
          <Score score={lead.intent_score} />
        )}
        {tile === "waiting" && lead.callback_requested_at ? (
          <button
            type="button"
            disabled={marking}
            onClick={() => onMarkCalled(lead)}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
          >
            {marking ? "Saving…" : "Mark called"}
          </button>
        ) : null}
      </div>
    </li>
  );
}
