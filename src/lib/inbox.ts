/**
 * Typed client for the /conversations API — the Messages screen.
 *
 * Three backend behaviours shape everything here.
 *
 * 1. `interest_score` is the LLM's 0-100 read on how interested the customer is,
 *    written on every inbound reply. `null` means *never assessed*, which is not
 *    the same as 0 and must not render as a cold badge.
 * 2. WhatsApp only allows a typed message within 24 hours of the customer's last
 *    reply. Outside that, the backend refuses the send with a reason — so the
 *    composer is disabled from `window.can_send_freeform`, never left hopeful.
 * 3. A group is a real contact list, identical to an uploaded spreadsheet. Once
 *    built it appears in WhatsApp Outreach with no extra step, which is why the
 *    result hands back a `dataset_id`.
 *
 * Vocabulary mirrors app/modules/conversations/inbox_policy.py. Changing a sort
 * or a band on one side only is the way this screen breaks.
 */

import { apiFetch } from "@/lib/api";
import type { CustomerStage, EngagementTier } from "@/lib/outreach";

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

export const INBOX_SORTS = [
  "interest",
  "recent_reply",
  "activity",
  "waiting",
  "scheduled",
  "stage",
  "replies",
  "quiet",
  "name",
] as const;

export type InboxSort = (typeof INBOX_SORTS)[number];

export const DEFAULT_INBOX_SORT: InboxSort = "recent_reply";

export const SORT_LABELS: Record<string, string> = {
  interest: "Most interested first",
  recent_reply: "Latest customer reply",
  activity: "Latest activity",
  waiting: "Waiting on us longest",
  scheduled: "Soonest scheduled",
  stage: "Furthest along the pipeline",
  replies: "Most replies",
  quiet: "Quiet the longest",
  name: "Name (A–Z)",
};

export const SORT_HINTS: Record<string, string> = {
  interest: "Work the hottest leads first.",
  recent_reply: "Whoever wrote back most recently is at the top.",
  activity: "Any message, ours or theirs, counts as activity.",
  waiting: "They replied and nobody has answered yet — clear these first.",
  scheduled: "Next site visit or follow-up date first.",
  stage: "Negotiating before Visit Scheduled before Replied.",
  replies: "The most talkative customers, who are usually the most serious.",
  quiet: "Longest silence first — the re-engagement list.",
  name: "Alphabetical, for when you are looking for one person.",
};

export const INTEREST_BANDS = ["hot", "warm", "cool", "cold"] as const;
export type InterestBand = (typeof INTEREST_BANDS)[number];

export const BAND_LABELS: Record<string, string> = {
  hot: "Hot",
  warm: "Warm",
  cool: "Cool",
  cold: "Cold",
};

export const BAND_HINTS: Record<string, string> = {
  hot: "Ready to visit, negotiate, or talk to you now",
  warm: "Clear requirements, comparing options",
  cool: "Early curiosity, vague preferences",
  cold: "Just browsing, no requirements yet",
};

/** Inclusive score range per band — kept in step with inbox_policy.BAND_RANGES. */
export const BAND_RANGES: Record<InterestBand, [number, number]> = {
  hot: [61, 100],
  warm: [41, 60],
  cool: [21, 40],
  cold: [0, 20],
};

export const WINDOW_FILTER_LABELS: Record<string, string> = {
  open: "Can still be texted freely",
  closed: "Needs an approved template",
};

/** WhatsApp's free-form reply window, in hours. */
export const SERVICE_WINDOW_HOURS = 24;

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type ServiceWindow = {
  mode: "freeform" | "template" | string;
  can_send_freeform: boolean;
  minutes_left: number;
  expires_at: string | null;
  /** A sentence to show in or above the composer. Already agent-readable. */
  reason: string;
};

export type InboxThread = {
  conversation_id: string;
  contact_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  channel: string;
  status: "ai_active" | "human_handoff" | "closed" | string;

  customer_stage: CustomerStage | string;
  engagement_tier: EngagementTier | string;
  /** null = never assessed. Render as "not scored yet", not as zero. */
  interest_score: number | null;
  interest_band: InterestBand | string | null;
  interest_reason: string | null;

  reply_count: number;
  messaged_count: number;
  message_count: number;
  last_reply_text: string | null;
  last_message_at: string | null;
  last_inbound_at: string | null;
  last_outbound_at: string | null;

  /** They wrote last and nobody has answered — the most urgent state here. */
  awaiting_reply: boolean;
  waiting_since: string | null;
  /** Next site visit or CRM follow-up date, whichever comes first. */
  scheduled_at: string | null;

  send_mode: "freeform" | "template" | string;
  outreach_paused: boolean;
  source_dataset_id: string | null;
  updated_at: string | null;
};

export type InboxCounts = {
  total?: number;
  awaiting_reply?: number;
  hot?: number;
  inside_window?: number;
  scheduled?: number;
  replied?: number;
};

export type InboxThreadPage = {
  items: InboxThread[];
  total: number;
  limit: number;
  offset: number;
  sort: InboxSort | string;
  /** Counts for the whole filtered set, not just this page. */
  counts: InboxCounts;
};

/** Who actually wrote an outbound message — the distinction this screen exists for. */
export type MessageAuthor = "customer" | "ai" | "agent";

export type InboxMessage = {
  id: string;
  direction: "inbound" | "outbound" | string;
  role: string;
  message_type: string;
  text: string | null;
  media_url: string | null;
  created_at: string | null;
  author: MessageAuthor | string;
  /** campaign, nurture, followup or manual. */
  kind: string | null;
  delivery_status: string | null;
  delivery_error: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  failed_at: string | null;
};

export type InboxMessagePage = {
  items: InboxMessage[];
  total: number;
  limit: number;
  offset: number;
  /** More history exists further back — offset walks backwards from the latest. */
  has_more: boolean;
};

export type CustomerProfile = {
  contact_id: string | null;
  name: string;
  phone: string | null;
  alternate_phone: string | null;
  whatsapp: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  source: string | null;
  tag: string | null;
  purpose: string | null;
  lead_status: string | null;
  priority: string | null;
  assigned_to: string | null;
  property_type: string | null;
  bhk: string | null;
  budget_min: string | null;
  budget_max: string | null;
  budget_label: string | null;
  preferred_location: string | null;
  furnishing: string | null;
  facing: string | null;
  carpet_area: string | null;
  possession: string | null;
  possession_timeline: string | null;
  loan_required: string | null;
  ready_to_move: boolean | null;
  portal_name: string | null;
  listing_id: string | null;
  project_name: string | null;
  property_address: string | null;
  asking_price: string | null;
  ownership_type: string | null;
  customer_stage: CustomerStage | string;
  engagement_tier: EngagementTier | string;
  intent_score: number | null;
  reply_count: number;
  messaged_count: number;
  first_messaged_at: string | null;
  last_reply_at: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  outreach_paused: boolean;
  source_dataset_id: string | null;
  notes: string | null;
  preferences: Record<string, unknown>;
  created_at: string | null;
  updated_at: string | null;
};

export type AppointmentBrief = {
  id: string;
  scheduled_at: string | null;
  status: string;
  notes: string | null;
  property_id: string | null;
};

export type InterestAssessment = {
  score: number | null;
  band: InterestBand | string | null;
  band_label: string | null;
  /** Why the AI landed on that number. Always show it next to the score. */
  reason: string | null;
  signals: string[];
  updated_at: string | null;
};

export type InboxThreadDetail = {
  thread: InboxThread;
  profile: CustomerProfile;
  interest: InterestAssessment;
  window: ServiceWindow;
  /** What the AI has established in conversation (requirements, slots). */
  qualification: Record<string, unknown>;
  appointments: AppointmentBrief[];
};

export type ManualMessageResult = {
  sent: boolean;
  message: InboxMessage | null;
  window: ServiceWindow;
  error: string | null;
};

export type CreateGroupResult = {
  /** The contact list id. It is already selectable in WhatsApp Outreach. */
  dataset_id: string;
  name: string;
  row_count: number;
  skipped_no_phone: number;
  message: string;
};

export type FilterVocabulary = {
  stages: string[];
  tiers: string[];
  bands: { value: string; label: string; hint: string; min: number; max: number }[];
  sorts: { value: string; label: string; hint: string }[];
  default_sort: string;
  window_filters: { value: string; label: string }[];
  filter_keys: string[];
  service_window_hours: number;
};

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

export type InboxFilters = {
  stage?: string;
  tier?: string;
  band?: string;
  min_interest?: number;
  max_interest?: number;
  replied?: boolean;
  awaiting?: boolean;
  window?: "open" | "closed" | string;
  scheduled?: boolean;
  paused?: boolean;
  quiet_days?: number;
  dataset_id?: string;
  search?: string;
};

/**
 * Filters as a query string.
 *
 * Falsy values are dropped rather than sent as "false", so an untouched filter
 * never narrows the list. `paused` is the exception: it is genuinely tri-state
 * (opted out / not opted out / don't care), so `false` is sent when set.
 */
export function inboxFilterQuery(filters: InboxFilters = {}): URLSearchParams {
  const query = new URLSearchParams();
  if (filters.stage) query.set("stage", filters.stage);
  if (filters.tier) query.set("tier", filters.tier);
  if (filters.band) query.set("band", filters.band);
  if (typeof filters.min_interest === "number") {
    query.set("min_interest", String(filters.min_interest));
  }
  if (typeof filters.max_interest === "number") {
    query.set("max_interest", String(filters.max_interest));
  }
  if (filters.replied) query.set("replied", "true");
  if (filters.awaiting) query.set("awaiting", "true");
  if (filters.window) query.set("window", filters.window);
  if (filters.scheduled) query.set("scheduled", "true");
  if (typeof filters.paused === "boolean") query.set("paused", String(filters.paused));
  if (filters.quiet_days) query.set("quiet_days", String(filters.quiet_days));
  if (filters.dataset_id) query.set("dataset_id", filters.dataset_id);
  const term = (filters.search || "").trim();
  if (term) query.set("search", term);
  return query;
}

/** How many filters are narrowing the list — for the "clear all" affordance. */
export function activeFilterCount(filters: InboxFilters = {}): number {
  return Array.from(inboxFilterQuery(filters).keys()).length;
}

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

export async function getInboxVocabulary() {
  return apiFetch<FilterVocabulary>("/api/v1/conversations/filters");
}

export async function listThreads(
  params: {
    filters?: InboxFilters;
    sort?: InboxSort | string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const query = inboxFilterQuery(params.filters);
  query.set("sort", params.sort || DEFAULT_INBOX_SORT);
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<InboxThreadPage>(`/api/v1/conversations?${query}`);
}

export async function getThread(conversationId: string) {
  return apiFetch<InboxThreadDetail>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}`,
  );
}

export async function listMessages(
  conversationId: string,
  params: { limit?: number; offset?: number } = {},
) {
  const query = new URLSearchParams();
  query.set("limit", String(params.limit ?? 100));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<InboxMessagePage>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages?${query}`,
  );
}

/**
 * Send a message the agent typed to the customer's WhatsApp.
 *
 * The AI stays active afterwards — this is for the one important thing a human
 * needs to say, not a handover. Rejected by the backend when the customer has
 * opted out or the 24-hour window has closed.
 */
export async function sendManualMessage(conversationId: string, text: string) {
  return apiFetch<ManualMessageResult>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/messages`,
    { method: "POST", body: JSON.stringify({ text }) },
  );
}

/**
 * Turn the current selection into a named list for WhatsApp Outreach.
 *
 * With `selectAllMatching` the backend re-reads the filters from the query
 * string and takes everyone they match, not just the rows on screen — so the
 * same filters must be passed here as were passed to `listThreads`.
 */
export async function createGroup(params: {
  name?: string;
  conversationIds?: string[];
  selectAllMatching?: boolean;
  filters?: InboxFilters;
  notes?: string;
  limit?: number;
}) {
  const query = inboxFilterQuery(params.filters);
  const suffix = query.toString();
  return apiFetch<CreateGroupResult>(
    `/api/v1/conversations/groups${suffix ? `?${suffix}` : ""}`,
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name || null,
        conversation_ids: params.conversationIds ?? [],
        select_all_matching: Boolean(params.selectAllMatching),
        notes: params.notes || null,
        limit: params.limit ?? 5000,
      }),
    },
  );
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/** Which band a score sits in, or null when the customer was never assessed. */
export function interestBand(score: number | null | undefined): InterestBand | null {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  if (score >= 61) return "hot";
  if (score >= 41) return "warm";
  if (score >= 21) return "cool";
  return "cold";
}

export function bandBadgeColor(
  band: string | null | undefined,
): "primary" | "success" | "error" | "warning" | "info" | "light" | "dark" {
  switch (band) {
    case "hot":
      return "success";
    case "warm":
      return "warning";
    case "cool":
      return "info";
    case "cold":
      return "light";
    default:
      return "light";
  }
}

/** The score as a sentence. Never invents a number for an unscored customer. */
export function interestLabel(score: number | null | undefined): string {
  const band = interestBand(score ?? null);
  if (!band) return "Not scored yet";
  return `${BAND_LABELS[band]} · ${score}/100`;
}

export function conversationStatusLabel(status: string): string {
  switch (status) {
    case "ai_active":
      return "AI is replying";
    case "human_handoff":
      return "Handed to a human";
    case "closed":
      return "Closed";
    default:
      return status;
  }
}

export function authorLabel(message: InboxMessage): string {
  if (message.author === "customer") return "Customer";
  if (message.author === "agent") return "You";
  return "AI assistant";
}

export const MESSAGE_KIND_LABELS: Record<string, string> = {
  campaign: "Campaign message",
  nurture: "Follow-up nudge",
  followup: "Follow-up nudge",
  manual: "Sent by you",
};

/** "22 hours left" / "closed" — the composer's status line. */
export function windowLabel(state: ServiceWindow | null | undefined): string {
  if (!state) return "—";
  if (!state.can_send_freeform) return "Template only";
  const minutes = state.minutes_left;
  if (minutes < 60) return `${minutes}m left to reply freely`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h left to reply freely`;
}

/** How long a customer has been kept waiting, for the urgency badge. */
export function waitingLabel(since: string | null | undefined): string {
  if (!since) return "";
  const then = new Date(since).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 60) return `waiting ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `waiting ${hours}h`;
  return `waiting ${Math.round(hours / 24)}d`;
}

export const INBOX_COUNT_LABELS: Record<string, string> = {
  total: "Chats",
  awaiting_reply: "Waiting on you",
  hot: "Hot leads",
  inside_window: "Can text now",
  scheduled: "Has a date",
  replied: "Replied",
};
