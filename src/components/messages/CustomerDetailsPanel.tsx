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
  DIVIDED,
  Dot,
  dotFor,
  HINT,
  MetaRule,
  Section,
} from "@/components/messages/tokens";

type Props = {
  profile: CustomerProfile;
  interest: InterestAssessment;
  qualification: Record<string, unknown>;
  appointments: AppointmentBrief[];
};

/** Keys the panel shows on its own, so the qualification block skips them. */
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
    ["Assigned to", profile.assigned_to],
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
    <div className={`${DIVIDED} text-sm`}>
      {/* The score with its reasoning. A number nobody can question is a number
          nobody trusts, so the AI's own explanation sits right under it. */}
      <Section
        title="How interested"
        aside={
          interest.updated_at ? (
            <span className={HINT}>{formatWhen(interest.updated_at)}</span>
          ) : undefined
        }
      >
        {interest.score === null ? (
          <p className="text-xs text-gray-500">
            Not scored yet — the AI reads interest from a customer&apos;s reply, and this
            one has not written back.
          </p>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums text-gray-800 dark:text-white/90">
                {interest.score}
                <span className="text-sm font-normal text-gray-400">/100</span>
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
                <Dot className={dotFor(interest.band)} />
                {interest.band_label || interest.band}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.min(100, Math.max(0, interest.score))}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
              {interest.reason || BAND_HINTS[String(interest.band)] || ""}
            </p>
            {interest.signals.length > 0 && (
              <ul className="mt-2 space-y-1.5">
                {interest.signals.map((signal) => (
                  <li
                    key={signal}
                    className="flex gap-1.5 text-[11px] leading-snug text-gray-500"
                  >
                    <Dot className="mt-1 bg-gray-300 dark:bg-gray-600" />
                    <span className="min-w-0">{signal}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Section>

      <Section title="Where they stand">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={stageBadgeColor(profile.customer_stage)} size="sm">
            {profile.customer_stage}
          </Badge>
          <MetaRule />
          <span className="text-[11px] text-gray-500">
            {profile.engagement_tier} engagement
          </span>
          {profile.outreach_paused && (
            <>
              <MetaRule />
              <span className="text-[11px] font-medium text-error-500">
                Opted out of messages
              </span>
            </>
          )}
        </div>
      </Section>

      {appointments.length > 0 && (
        <Section title="Scheduled">
          <ul className="space-y-2">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="text-xs text-gray-600 dark:text-gray-400">
                <span className="inline-flex items-center gap-1.5 font-medium text-gray-800 dark:text-white/90">
                  <CalendarIcon className="text-gray-400" />
                  {formatWhen(appointment.scheduled_at)}
                </span>
                <span className="ml-1.5 text-gray-400">{appointment.status}</span>
                {appointment.notes && <p className="mt-0.5 italic">{appointment.notes}</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {requirement.length > 0 && (
        <Section title="What they want">
          <Rows rows={requirement} />
        </Section>
      )}

      {reach.length > 0 && (
        <Section title="Contact">
          <Rows rows={reach} />
        </Section>
      )}

      {listing.length > 0 && (
        <Section title="Listing they asked about">
          <Rows rows={listing} />
        </Section>
      )}

      {extras.length > 0 && (
        <Section title="Established in chat">
          <Rows rows={extras} />
        </Section>
      )}

      {preferences.length > 0 && (
        <Section title="Preferences">
          <Rows rows={preferences} />
        </Section>
      )}

      {history.length > 0 && (
        <Section title="History">
          <Rows rows={history} />
        </Section>
      )}

      {profile.notes && (
        <Section title="Notes">
          <p className="whitespace-pre-wrap text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {profile.notes}
          </p>
        </Section>
      )}
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
