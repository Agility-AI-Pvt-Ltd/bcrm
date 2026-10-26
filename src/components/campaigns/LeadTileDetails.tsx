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
 * the rows shown cannot disagree. Each person's visits come from
 * `POST /visits/for-contacts`, ranked upcoming-first then newest missed. It used
 * to pick one visit here from the first 200, oldest first — which showed
 * Pooja's missed Saturday slot and hid the visit booked for today. A contact
 * marked "Visit Scheduled" with no booked time says so rather than vanishing.
 */

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import CustomerProfileDrawer from "@/components/campaigns/CustomerProfileDrawer";
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
import { getVisits, getVisitsForContacts, type ContactVisit, type Visit } from "@/lib/siteVisits";

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

function visitTime(visit: Visit): number | null {
  if (!visit.scheduled_at) return null;
  const at = new Date(visit.scheduled_at).getTime();
  return Number.isFinite(at) ? at : null;
}

/**
 * Fallback when `/visits/for-contacts` is not on this API yet: group the
 * oldest-or-newest dump ourselves. Soonest upcoming first, then newest missed,
 * never the first row in server order — that hid today's booking behind a
 * slot they missed last week.
 */
function visitsFor(lead: Lead, visits: Visit[]): Visit[] {
  const phone = digits(lead.phone);
  const mine = visits.filter(
    (visit) =>
      visit.status !== "Cancelled" &&
      (visit.contact_id === lead.id || (phone && digits(visit.customer_phone) === phone)),
  );
  const now = Date.now();
  return [...mine].sort((left, right) => {
    const leftAt = visitTime(left);
    const rightAt = visitTime(right);
    if (leftAt === null && rightAt === null) return 0;
    if (leftAt === null) return -1;
    if (rightAt === null) return 1;
    const leftLive = leftAt >= now;
    const rightLive = rightAt >= now;
    if (leftLive !== rightLive) return leftLive ? -1 : 1;
    return leftLive ? leftAt - rightAt : rightAt - leftAt;
  });
}

async function loadVisitsForLeads(leads: Lead[]): Promise<ContactVisit[]> {
  try {
    const found = await getVisitsForContacts(
      leads.map((lead) => ({ contact_id: lead.id, phone: lead.phone })),
    );
    return found.map((item) => ({
      ...item,
      visits: item.visits?.length ? item.visits : item.visit ? [item.visit] : [],
    }));
  } catch {
    const list = await getVisits("all", 200);
    return leads.flatMap((lead) => {
      const mine = visitsFor(lead, list.items ?? []);
      if (!mine.length) return [];
      return [
        {
          contact_id: lead.id,
          visit: mine[0],
          others: mine.length - 1,
          visits: mine,
        },
      ];
    });
  }
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
  const [visits, setVisits] = useState<Record<string, ContactVisit>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // The customer whose profile is open in the side drawer.
  const [profileOf, setProfileOf] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page = await listLeads({ ...filterFor(tile), period, limit: PANEL_LIMIT, offset: 0 });
      const found =
        tile === "visits" && page.items.length ? await loadVisitsForLeads(page.items) : [];
      setLeads(page.items);
      setTotal(page.total);
      setVisits(Object.fromEntries(found.map((item) => [item.contact_id, item])));
    } catch (problem) {
      setError(problem instanceof ApiError ? problem.message : "Could not load this list.");
    } finally {
      setLoading(false);
    }
  }, [tile, period]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // Escape closes, the way any panel that opened on a click should — the open
  // customer profile first, then this list.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (profileOf) setProfileOf(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, profileOf]);

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
              visit={tile === "visits" ? (visits[lead.id] ?? null) : null}
              marking={marking === lead.id}
              onMarkCalled={onMarkCalled}
              onOpen={setProfileOf}
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

      {profileOf ? (
        <CustomerProfileDrawer
          key={profileOf.id}
          lead={profileOf}
          onClose={() => setProfileOf(null)}
          onChanged={() => void load()}
        />
      ) : null}
    </section>
  );
}

function DetailRow({
  tile,
  lead,
  visit: entry,
  marking,
  onMarkCalled,
  onOpen,
}: {
  tile: TileKey;
  lead: Lead;
  visit: ContactVisit | null;
  marking: boolean;
  onMarkCalled: (lead: Lead) => void;
  /** Open this customer's profile (the Messages page's panel) in a drawer. */
  onOpen: (lead: Lead) => void;
}) {
  const listed =
    entry?.visits?.length ? entry.visits : entry?.visit ? [entry.visit] : [];
  const chat = whatsappHref(lead.phone);
  const wants = [lead.bhk, lead.preferred_location, lead.budget_label].filter(Boolean).join(" · ");

  return (
    <li
      role="button"
      tabIndex={0}
      title="Open customer profile"
      onClick={() => onOpen(lead)}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(lead);
        }
      }}
      className="grid cursor-pointer grid-cols-1 gap-3 px-5 py-3 transition hover:bg-gray-50 focus:bg-gray-50 focus:outline-none sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] sm:items-start dark:hover:bg-white/[0.03] dark:focus:bg-white/[0.03]"
    >
      <div className="min-w-0">
        <p className="truncate font-medium text-brand-600 dark:text-brand-400">
          {lead.name || "Unnamed"}
        </p>
        {chat ? (
          <a
            onClick={(event) => event.stopPropagation()}
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
          listed.length ? (
            <ul className="space-y-2">
              {listed.map((visit) => (
                <li key={visit.id} className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 dark:text-white/90">
                      {visit.view.when_label || formatWhen(visit.scheduled_at)}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {[visit.property_title, visit.property_location].filter(Boolean).join(" · ") ||
                        "No property named"}
                      {visit.assigned_name ? ` · with ${visit.assigned_name}` : ""}
                    </p>
                  </div>
                  <Badge color={TONE_BADGE[visit.view.tone] ?? "light"} size="sm">
                    {visit.view.label || visit.status}
                  </Badge>
                </li>
              ))}
            </ul>
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
        {tile === "visits" ? null : (
          <Score score={lead.intent_score} />
        )}
        {tile === "waiting" && lead.callback_requested_at ? (
          <button
            type="button"
            disabled={marking}
            onClick={(event) => {
              event.stopPropagation();
              onMarkCalled(lead);
            }}
            className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10"
          >
            {marking ? "Saving…" : "Mark called"}
          </button>
        ) : null}
      </div>
    </li>
  );
}
