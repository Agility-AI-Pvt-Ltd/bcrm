import { apiFetch } from "./api";

/**
 * The compliance screen's data.
 *
 * Two things shape every type here. Every regulatory figure is a configurable
 * default rather than settled law, and the screen says so next to each one — a
 * product that presents a date or a price as a legal fact invites a broker to rely
 * on it. And a cost is never shown as ₹0 when the real answer is "we don't know":
 * `spend` is nullable, and a blank with a reason beats a zero that reads as free.
 */

export type ComplianceRule = {
  key: string;
  label: string;
  value: string;
  /** Where this default came from, and that it is yours to verify. */
  note: string;
};

export type ConsentSummary = {
  records: number;
  notice_given: number;
  withdrawn: number;
};

/**
 * One person's consent record.
 *
 * The notice text travels with the row because that is the only reason storing
 * it verbatim is worth anything: the question that arrives is "what exactly did
 * you tell this person", and a count cannot answer it.
 */
export type ConsentPerson = {
  id: string;
  phone: string | null;
  /** From the contact when there is one. Null, never "Unknown". */
  name: string | null;
  contact_id: string | null;
  channel: string;
  basis: string;
  purposes: string[];
  notice_version: string | null;
  notice_text: string | null;
  notice_sent_at: string | null;
  withdrawn_at: string | null;
  /** Their own words when they asked us to stop. */
  withdrawn_note: string | null;
};

export type ConsentPeople = {
  /** Matching records, before this page was cut out of them. */
  total: number;
  people: ConsentPerson[];
};

/** all = everyone on file, told = notice given and standing, withdrawn = asked us to stop. */
export type ConsentState = "all" | "told" | "withdrawn";

export type DataRequest = {
  id: string;
  /** erasure | access */
  kind: string;
  channel: string;
  /** Present only while the request is open; cleared when it completes. */
  phone: string | null;
  request_text: string | null;
  received_at: string | null;
  due_at: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  /** Who carried it out. Null on a request nobody has actioned, and on one
   *  closed before this was recorded — honest, rather than guessed. */
  completed_by: string | null;
  outcome: Record<string, unknown>;
};

export type CategorySpend = {
  messages: number;
  /** Null when this category's price is not configured. Never guessed. */
  spend: number | null;
  rate: number | null;
  priced: boolean;
};

export type MessagingSpend = {
  period_start: string;
  categories: Record<string, CategorySpend>;
  messages: number;
  spend: number;
  unpriced_messages: number;
  service_messages: number;
  service_free_allowance: number;
  service_allowance_left: number;
};

export type NumberQuality = {
  quality: string;
  sends: number;
  blocks: number;
  block_rate: number;
  warning: string;
  /** Meta's daily send limit for this number, verbatim (TIER_1K, TIER_10K, …). */
  messaging_limit: string | null;
  /** When the rating was last reported. Null means never, not badly. */
  reported_at: string | null;
  blocks_by_user: Record<string, number>;
};

export type NumberRefresh = {
  /** False when WhatsApp is not connected or Meta refused the read. */
  reached: boolean;
  error: string | null;
  /** True when the rating Meta reports differs from the one we had. */
  changed: boolean;
  health: MessagingHealth;
};

export type MessagingHealth = {
  spend: MessagingSpend;
  quality: NumberQuality;
};

export type ComplianceOverview = {
  consent: ConsentSummary;
  open_requests: DataRequest[];
  recent_requests: DataRequest[];
  rules: ComplianceRule[];
  messaging: MessagingHealth;
  processor_statement: string;
  warnings: string[];
};

export type Holdings = {
  phone: string | null;
  found: boolean;
  rows: Record<string, number>;
  total: number;
  /** What a deletion would keep, and why. Shown before the button is pressed. */
  kept: Record<string, number>;
  kept_total: number;
  kept_reason: string;
};

export type RetentionCandidate = {
  contact_id: string;
  name: string | null;
  phone: string | null;
  last_contact_at: string | null;
  /** Whole months since that contact — the number a person argues with. */
  months_since: number;
};

export type RetentionDue = {
  window_months: number;
  cutoff: string | null;
  total: number;
  /** Files with no usable number, which this path cannot purge. Counted, not hidden. */
  without_phone: number;
  people: RetentionCandidate[];
};

export type RetentionPurge = {
  purged: boolean;
  /** past_window | still_within_window | request_already_open | nothing_on_file | no_comparable_number */
  reason: string;
  receipt: ErasureReceipt | null;
};

export type ErasureReceipt = {
  phone_fingerprint: string;
  erased_at: string | null;
  deleted: Record<string, number>;
  redacted: Record<string, number>;
  deleted_total: number;
  redacted_total: number;
  note: string | null;
};

const BASE = "/api/v1/compliance";

export const getComplianceOverview = () =>
  apiFetch<ComplianceOverview>(`${BASE}/overview`);

export const getMessagingHealth = () => apiFetch<MessagingHealth>(`${BASE}/messaging`);

/** Ask Meta for the number's rating now, rather than waiting for a webhook. */
export const refreshMessagingHealth = () =>
  apiFetch<NumberRefresh>(`${BASE}/messaging/refresh`, { method: "POST" });

export const getConsentPeople = (options?: {
  state?: ConsentState;
  q?: string;
  limit?: number;
  offset?: number;
}) => {
  const params = new URLSearchParams();
  if (options?.state) params.set("state", options.state);
  if (options?.q) params.set("q", options.q);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  const query = params.toString();
  return apiFetch<ConsentPeople>(`${BASE}/consent/people${query ? `?${query}` : ""}`);
};

export const listDataRequests = (includeCompleted = false) =>
  apiFetch<DataRequest[]>(
    `${BASE}/requests${includeCompleted ? "?include_completed=true" : ""}`,
  );

export const createDataRequest = (body: {
  phone: string;
  kind: string;
  note?: string | null;
}) => apiFetch<DataRequest>(`${BASE}/requests`, { method: "POST", body: JSON.stringify(body) });

export const getHoldings = (phone: string) =>
  apiFetch<Holdings>(`${BASE}/holdings?phone=${encodeURIComponent(phone)}`);

export const exportPerson = (phone: string) =>
  apiFetch<Record<string, unknown>>(`${BASE}/export?phone=${encodeURIComponent(phone)}`);

export const fulfilRequest = (id: string) =>
  apiFetch<ErasureReceipt>(`${BASE}/requests/${id}/fulfil`, { method: "POST" });

/** Close an access request once its data has been downloaded. */
export const answerAccessRequest = (id: string) =>
  apiFetch<DataRequest>(`${BASE}/requests/${id}/answer`, { method: "POST" });

export const getRetentionDue = (limit = 50, offset = 0) =>
  apiFetch<RetentionDue>(`${BASE}/retention/due?limit=${limit}&offset=${offset}`);

/** Irreversible, one person, and refused by the server unless they are past the window. */
export const purgeRetained = (phone: string) =>
  apiFetch<RetentionPurge>(`${BASE}/retention/purge`, {
    method: "POST",
    body: JSON.stringify({ phone }),
  });

/**
 * Hand the export to the browser as a file.
 *
 * Raw rows with the database's own column names, because a prettier export that
 * quietly leaves a column out is not a complete one — and completeness is the
 * whole obligation being answered.
 */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** "919876543210" -> "919876543210", with anything unsafe for a filename gone. */
export function safeFilePart(value: string | null | undefined): string {
  return String(value || "customer").replace(/[^a-zA-Z0-9_-]+/g, "") || "customer";
}

export const RETENTION_REFUSAL: Record<string, string> = {
  still_within_window: "That customer is still inside your retention window, so nothing was deleted.",
  request_already_open:
    "That customer already has a data request open — handle it there rather than as a retention purge.",
  nothing_on_file: "Nothing is on file for that number.",
  no_comparable_number: "That number cannot be matched against your records.",
};

/** How the table names read to a person, rather than as database tables. */
export const TABLE_LABEL: Record<string, string> = {
  contacts: "Contact record",
  conversations: "WhatsApp conversation",
  conversation_messages: "WhatsApp messages",
  appointments: "Site visits",
  site_visit_events: "Site visit history",
  callback_requests: "Callback requests",
  calls: "AI calls",
  call_attempts: "Call attempts",
  enquiry_callbacks: "Enquiry callbacks",
  leads: "Leads",
  lead_first_touches: "First-touch messages",
  outreach_recipients: "Campaign recipients",
  contact_dataset_rows: "Imported spreadsheet rows",
  organization_notifications: "Notifications",
  consent_records: "Consent record",
  reply_jobs: "Queued replies",
  lead_registrations: "Commission registrations",
  message_cost_entries: "Billing lines",
  number_quality_events: "Delivery events",
};

export const CATEGORY_LABEL: Record<string, string> = {
  MARKETING: "Marketing templates",
  UTILITY: "Utility templates",
  AUTHENTICATION: "Authentication templates",
  SERVICE: "Replies inside the 24-hour window",
};

export const QUALITY_CHIP: Record<string, string> = {
  GREEN: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  YELLOW: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  RED: "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-500",
  UNKNOWN: "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400",
};

export const QUALITY_LABEL: Record<string, string> = {
  GREEN: "Good",
  YELLOW: "Dropped",
  RED: "Low",
  UNKNOWN: "Not reported yet",
};

/** ₹0.86 / ₹1,240 — rupees, with paise only where they matter. */
export function rupees(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (value > 0 && value < 10) return `₹${value.toFixed(4).replace(/0+$/, "")}`;
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** "TIER_1K" is Meta's word; "1,000 a day" is the thing it means. */
export function sendLimitLabel(tier: string | null | undefined): string | null {
  const raw = String(tier || "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes("UNLIMITED")) return "unlimited sends a day";
  const match = raw.match(/TIER_?(\d+)(K|M)?/);
  if (!match) return raw.toLowerCase().replace(/_/g, " ");
  const size = Number(match[1]) * (match[2] === "K" ? 1_000 : match[2] === "M" ? 1_000_000 : 1);
  return `${size.toLocaleString("en-IN")} people a day`;
}

/** "today" / "3 Oct" — when a rating or a stamp was last heard about. */
export function whenLabel(value: string | null | undefined): string {
  if (!value) return "never";
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return "never";
  const days = Math.floor((Date.now() - moment.getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return shortDate(value);
}

/** "3 days left" / "overdue by 2 days" — what a due date actually means today. */
export function dueLabel(value: string | null | undefined): string {
  if (!value) return "";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "";
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return `overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** How much attention a request's deadline deserves.
 *
 *  A data request carries a legal answer-by date, and "overdue by 3 days" and
 *  "20 days left" read identically as plain grey text. This is what lets the list
 *  show the difference without anybody having to do the arithmetic.
 */
export type DueTone = "overdue" | "soon" | "ok" | "none";

/** Inside this many days, a deadline is worth flagging rather than just stating. */
export const DUE_SOON_DAYS = 7;

export function dueTone(value: string | null | undefined): DueTone {
  if (!value) return "none";
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return "none";
  const days = Math.ceil((due.getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= DUE_SOON_DAYS) return "soon";
  return "ok";
}

export const DUE_CLASS: Record<DueTone, string> = {
  overdue:
    "bg-error-50 text-error-700 dark:bg-error-500/15 dark:text-error-400",
  soon: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400",
  ok: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
  none: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
};
