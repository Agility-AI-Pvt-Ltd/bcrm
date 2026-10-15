import { apiFetch } from "./api";

/**
 * The daily digest: one WhatsApp message each morning, on each teammate's own
 * number, summarising the agency's leads.
 *
 * Two things shape this screen. The message is business-initiated, so it can only
 * go out on a template Meta has approved — which is why `template_status` is read
 * and shown rather than assumed. And the destination is a *personal* number, so
 * saving one is the opt-in: nobody is added to the list by an administrator.
 */
export type DigestSettings = {
  enabled: boolean;
  send_hour: number;
  send_minute: number;
  timezone: string;
  /** How far back "new leads" looks. 24 hours, normally. */
  lookback_hours: number;
  /** Stay quiet on a morning with nothing to report. */
  skip_when_empty: boolean;
  /** "9:00 AM IST" — the sentence under the time picker. */
  send_label: string;
  /** The UTC cron this resolves to. Useful in a bug report, shown small. */
  cron: string;
  whatsapp_connected: boolean;
  /** APPROVED / PENDING / REJECTED / NOT_SUBMITTED, for this agency's own WABA. */
  template_status: string;
  template_name: string;
  recipient_count: number;
};

export type DigestSettingsUpdate = {
  enabled?: boolean;
  send_hour?: number;
  send_minute?: number;
  timezone?: string;
  lookback_hours?: number;
  skip_when_empty?: boolean;
};

/** One site visit on the digest's day, as the message prints it. */
export type DigestVisit = {
  /** "10:30 AM", already in the agency's timezone. */
  time_label: string;
  customer: string;
  property_label: string | null;
};

export type DigestCounts = {
  new_leads: number;
  hot: number;
  warm: number;
  cold: number;
  followups_due: number;
  not_contacted: number;
  visits_today: number;
  unanswered: number;
  /** Today's visits in order. Can be shorter than `visits_today` — the count is
   * the truth, the list is what the message has room for. */
  visits?: DigestVisit[];
};

/**
 * What one person wants in their own digest. Personal, not agency-wide: one
 * teammate hiding the hot/warm/cold breakdown does not change what the rest of
 * the office reads at 9am.
 *
 * The caveat `template_applies` carries: a Meta template is approved as one
 * fixed body, so when the digest goes out on the template every line is in it
 * whatever is chosen here. These choices shape the free-form message — what is
 * sent inside WhatsApp's 24-hour window, and what the preview shows.
 */
export type DigestSection = {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
};

export type DigestPreferences = {
  sections: DigestSection[];
  template_applies: boolean;
};

export type DigestRecipient = {
  user_id: string;
  name: string;
  email: string;
  phone: string;
};

export type DigestPreview = {
  digest_date: string;
  counts: DigestCounts;
  /** The message as it will read on a phone, emoji and all. */
  text: string;
  params: string[];
  recipients: DigestRecipient[];
};

export type DigestSend = {
  id: string;
  user_id: string;
  digest_date: string;
  phone: string;
  status: "sent" | "skipped" | "failed" | string;
  reason: string | null;
  used_template: boolean;
  provider_message_id: string | null;
  sent_at: string | null;
  last_error: string | null;
  counts: DigestCounts | null;
};

export type DigestRun = {
  sent: number;
  skipped: number;
  failed: number;
  recipients: number;
  reason: string;
  /** A sentence for the toast: "Digest sent to 2 people." */
  message: string;
};

const BASE = "/api/v1/digest";

export const getDigestSettings = () => apiFetch<DigestSettings>(`${BASE}/settings`);

export const updateDigestSettings = (payload: DigestSettingsUpdate) =>
  apiFetch<DigestSettings>(`${BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getDigestPreview = () => apiFetch<DigestPreview>(`${BASE}/preview`);

export const sendDigestNow = (onlyMe = true) =>
  apiFetch<DigestRun>(`${BASE}/send-now`, {
    method: "POST",
    body: JSON.stringify({ only_me: onlyMe }),
  });

export const getDigestHistory = (limit = 20) =>
  apiFetch<DigestSend[]>(`${BASE}/history?limit=${limit}`);

/** "not submitted" reads better than "NOT_SUBMITTED" in a sentence. */
export function templateStatusLabel(status: string): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "PENDING":
      return "Awaiting Meta review";
    case "REJECTED":
      return "Rejected by Meta";
    case "NOT_SUBMITTED":
      return "Not submitted yet";
    default:
      return status.toLowerCase().replace(/_/g, " ");
  }
}

export const STATUS_CHIP: Record<string, string> = {
  sent: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  skipped: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
  failed: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
};

/** The server's machine reasons, in words a broker can act on. */
export const REASON_LABELS: Record<string, string> = {
  sending: "Sending…",
  already_sent: "Already sent today",
  nothing_to_report: "Nothing happened — stayed quiet",
  not_due: "Not the right time of day",
  disabled: "Digest switched off",
  no_recipients: "Nobody has saved a number",
  no_number: "No WhatsApp number saved",
  whatsapp_not_connected: "WhatsApp is not connected",
  template_not_approved: "Template not approved by Meta yet",
  send_failed: "WhatsApp refused it",
  account_disabled: "Account disabled",
};

export function reasonLabel(reason: string | null): string {
  if (!reason) return "";
  return REASON_LABELS[reason] || reason.replace(/_/g, " ");
}

/** "Mon 6 Oct" from the server's plain date, without a timezone shift. */
export function formatDigestDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatSentAt(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "09:00" for an <input type="time">, from the stored hour and minute. */
export function timeValue(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function parseTimeValue(value: string): { send_hour: number; send_minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { send_hour: hour, send_minute: minute };
}

/** The timezones an Indian brokerage plausibly needs, plus whatever is saved. */
export const TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "UTC",
];

/** This person's own digest sections. */
export async function getDigestPreferences() {
  return apiFetch<DigestPreferences>("/api/v1/digest/preferences");
}

/** Switch sections on or off. Only the keys sent are changed. */
export async function updateDigestPreferences(sections: Record<string, boolean>) {
  return apiFetch<DigestPreferences>("/api/v1/digest/preferences", {
    method: "PUT",
    body: JSON.stringify({ sections }),
  });
}
