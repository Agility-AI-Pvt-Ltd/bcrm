"use client";

/**
 * Everything the CRM knows about this customer, beside their chat.
 *
 * The brief was "each detail of that customer will be shown in that chat
 * section", and the reason is practical: the agent decides whether to spend a
 * message on this person, and that decision needs the budget, the locality and
 * what the AI has already established — not a link to another page.
 *
 * Empty fields are dropped rather than rendered as dashes. A panel of twenty "—"
 * rows hides the three facts that matter.
 *
 * Every category is fenced off by the same hairline, including the score and the
 * stage row at the top — those two used to float above the first rule, which made
 * the panel look like two designs stacked. Headings, rules and dots come from
 * `tokens.tsx`, shared with the filter rail, the chat list and the transcript.
 */

import { useState, type ReactNode } from "react";
import Badge from "@/components/ui/badge/Badge";
import {
  BAND_HINTS,
  type AppointmentBrief,
  type CustomerProfile,
  type InterestAssessment,
} from "@/lib/inbox";
import { formatWhen, stageBadgeColor } from "@/lib/outreach";
import {
  CalendarIcon,
  Dot,
  dotFor,
  MetaRule,
} from "@/components/messages/tokens";

type Props = {
  profile: CustomerProfile;
  interest: InterestAssessment;
  qualification: Record<string, unknown>;
  appointments: AppointmentBrief[];
};

const QUALIFICATION_SKIP = new Set([
  "purpose",
  "preferred_location",
  "bhk",
  "budget_label",
  "budget_max",
  "budget_min",
  "property_type",
  "furnishing",
  "customer_stage",
  "engagement_tier",
]);

function Accordion({ title, defaultOpen = true, children }: { title: string, defaultOpen?: boolean, children: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 dark:border-gray-800 last:border-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-3 text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02]"
      >
        <span className="text-xs font-bold uppercase tracking-wider text-gray-900 dark:text-white">
          {title}
        </span>
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-4 pt-1">{children}</div>}
    </div>
  );
}

export default function CustomerDetailsPanel({
  profile,
  interest,
  qualification,
  appointments,
}: Props) {
  const requirement = fields([
    ["Looking to", profile.purpose],
    ["Property type", profile.property_type],
    ["Configuration", profile.bhk],
    ["Budget", profile.budget_label || range(profile.budget_min, profile.budget_max)],
    ["Preferred area", profile.preferred_location],
    ["Furnishing", profile.furnishing],
    ["Facing", profile.facing],
    ["Carpet area", profile.carpet_area],
    ["Possession", profile.possession || profile.possession_timeline],
    ["Ready to move", boolLabel(profile.ready_to_move)],
    ["Home loan", profile.loan_required],
  ]);

  const reach = fields([
    ["Phone", profile.phone],
    ["Alternate", profile.alternate_phone],
    ["WhatsApp", profile.whatsapp],
    ["Email", profile.email],
    ["City", profile.city],
    ["State", profile.state],
    ["Pincode", profile.pincode],
  ]);

  const listing = fields([
    ["Project", profile.project_name],
    ["Address", profile.property_address],
    ["Asking price", profile.asking_price],
    ["Ownership", profile.ownership_type],
    ["Portal", profile.portal_name],
    ["Listing ID", profile.listing_id],
  ]);

  const history = fields([
    ["Source", profile.source],
    ["Tag", profile.tag],
    ["Lead status", profile.lead_status],
    ["Priority", profile.priority],
    ["Replies", profile.reply_count ? String(profile.reply_count) : null],
    ["Messages sent", profile.messaged_count ? String(profile.messaged_count) : null],
    ["First messaged", when(profile.first_messaged_at)],
    ["Last reply", when(profile.last_reply_at)],
    ["Last contacted", when(profile.last_contacted_at)],
    ["Next follow-up", when(profile.next_follow_up_at)],
    ["In the CRM since", when(profile.created_at)],
  ]);

  const extras = Object.entries(qualification)
    .filter(([key, value]) => !QUALIFICATION_SKIP.has(key) && plain(value))
    .map(([key, value]) => [humanize(key), plain(value)] as [string, string]);

  const preferences = Object.entries(profile.preferences || {})
    .filter(([, value]) => plain(value))
    .map(([key, value]) => [humanize(key), plain(value)] as [string, string]);

  return (
    <div className="flex min-h-0 flex-col bg-white dark:bg-gray-900/50">
      <div className="border-b border-gray-100 bg-gray-50/50 p-5 dark:border-gray-800 dark:bg-white/[0.02]">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Customer Profile</h3>
        <p className="mt-1 text-xs text-gray-500">Assigned to: <span className="font-medium text-gray-700 dark:text-gray-300">{profile.assigned_to || "Unassigned"}</span></p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Accordion title="Lead Overview" defaultOpen={true}>
          {interest.score === null ? (
            <p className="text-xs text-gray-500 mb-3">
              Not scored yet — the AI reads interest from a customer&apos;s reply, and this
              one has not written back.
            </p>
          ) : (
            <div className="mb-4">
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Interest Score</span>
                <span className="text-sm font-bold text-gray-900 dark:text-white">{interest.score}/100</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.min(100, Math.max(0, interest.score))}%` }}
                />
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                {interest.reason || BAND_HINTS[String(interest.band)] || ""}
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mb-4">
            <Badge color={stageBadgeColor(profile.customer_stage)} size="sm">
              {profile.customer_stage}
            </Badge>
            <MetaRule />
            <span className="text-[11px] font-medium text-gray-600 dark:text-gray-400">
              {profile.engagement_tier} engagement
            </span>
          </div>

          {reach.length > 0 && <Rows rows={reach} />}
        </Accordion>

        <Accordion title="Requirements" defaultOpen={true}>
          {requirement.length > 0 && <Rows rows={requirement} />}
          {listing.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[10px] font-bold uppercase text-gray-400">Listing Inquiry</p>
              <Rows rows={listing} />
            </div>
          )}
          {extras.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[10px] font-bold uppercase text-gray-400">Established in Chat</p>
              <Rows rows={extras} />
            </div>
          )}
          {preferences.length > 0 && (
            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
              <p className="mb-2 text-[10px] font-bold uppercase text-gray-400">Preferences</p>
              <Rows rows={preferences} />
            </div>
          )}
        </Accordion>

        <Accordion title="Activity & History" defaultOpen={false}>
          {appointments.length > 0 && (
            <div className="mb-4">
              <p className="mb-2 text-[10px] font-bold uppercase text-gray-400">Scheduled Appointments</p>
              <ul className="space-y-2">
                {appointments.map((appointment) => (
                  <li key={appointment.id} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                    <span className="flex items-center gap-1.5 font-semibold text-gray-900 dark:text-white">
                      <CalendarIcon className="text-gray-400" />
                      {formatWhen(appointment.scheduled_at)}
                    </span>
                    <span className="mt-1 block text-gray-500">{appointment.status}</span>
                    {appointment.notes && <p className="mt-1 italic text-gray-500">{appointment.notes}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {history.length > 0 && <Rows rows={history} />}
        </Accordion>
      </div>

      <div className="shrink-0 border-t border-gray-100 p-5 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02]">
        <h4 className="text-[10px] font-bold uppercase text-gray-400 mb-3">Quick Actions</h4>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            Schedule Visit
          </button>
          <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            Update Stage
          </button>
          <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            Reassign
          </button>
          <button type="button" className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-error-600 shadow-xs transition hover:bg-error-50 dark:border-gray-700 dark:bg-gray-800 dark:text-error-400 dark:hover:bg-error-900/20">
            Opt Out
          </button>
        </div>
      </div>
    </div>
  );
}

function Rows({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-3 text-xs">
          <dt className="w-28 shrink-0 text-gray-400">{label}</dt>
          <dd className="min-w-0 flex-1 break-words text-gray-700 dark:text-gray-300">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Drops the blanks, so the panel only ever shows facts. */
function fields(pairs: [string, string | null | undefined][]): [string, string][] {
  return pairs
    .filter(([, value]) => value !== null && value !== undefined && String(value).trim() !== "")
    .map(([label, value]) => [label, String(value)] as [string, string]);
}

function range(low: string | null, high: string | null) {
  if (low && high) return `${low} – ${high}`;
  return low || high || null;
}

function boolLabel(value: boolean | null) {
  if (value === null || value === undefined) return null;
  return value ? "Yes" : "No";
}

function when(value: string | null) {
  return value ? formatWhen(value) : null;
}

/** Renders a JSON value the AI stored without ever printing "[object Object]". */
function plain(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.map(plain).filter(Boolean).join(", ");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, inner]) => {
        const text = plain(inner);
        return text ? `${humanize(key)}: ${text}` : "";
      })
      .filter(Boolean)
      .join(" · ");
  }
  return String(value);
}

function humanize(key: string) {
  const words = key.replace(/[_-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
