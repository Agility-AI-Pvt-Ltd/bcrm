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
  blocks_by_user: Record<string, number>;
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
