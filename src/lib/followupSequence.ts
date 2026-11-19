import { apiFetch } from "./api";

/**
 * The 5-touch follow-up: a lead who messaged on WhatsApp and went quiet gets an
 * approved template on days 1, 3, 7, 10 and 14 after their last message, in
 * Hindi or English. Stops on a reply (which restarts the clock), STOP, a booked
 * visit, or "Not a lead". The rules live on the server; this reads and writes.
 */

export type FollowupTemplateLanguage = {
  language: string;
  /** APPROVED / PENDING / REJECTED / NOT_SUBMITTED, for this agency's WABA. */
  status: string;
  approved: boolean;
  /** Starter to submit when it has not been submitted yet. */
  catalog_template_id: string | null;
};

export type FollowupTouch = {
  step: number;
  day: number;
  template: string;
  languages: FollowupTemplateLanguage[];
  ready: boolean;
};

export type FollowupSequenceSettings = {
  enabled: boolean;
  enabled_at: string | null;
  days: number[];
  send_start_hour: number;
  send_end_hour: number;
  timezone: string;
  touches: FollowupTouch[];
  ready: boolean;
  counts: Record<string, number>;
};

export type FollowupSequenceUpdate = {
  enabled?: boolean;
  days?: number[];
  send_start_hour?: number;
  send_end_hour?: number;
};

/** One lead's follow-ups, as the lead row shows them. */
export type LeadFollowup = {
  status: "active" | "sending" | "stopped" | "completed" | "off" | string;
  sent: number;
  step: number;
  total: number;
  next_at: string | null;
  stop_reason: string | null;
  stop_label: string | null;
  language: string | null;
  language_override: string | null;
  last_sent_at: string | null;
  last_error: string | null;
};

export type FollowupActivityItem = LeadFollowup & {
  contact_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  history: { outcome: string; at: string; step?: number; language?: string; detail?: string; error?: string }[];
};

const BASE = "/api/v1/leads/followup-sequence";

export const getFollowupSettings = () => apiFetch<FollowupSequenceSettings>(`${BASE}/settings`);

export const updateFollowupSettings = (payload: FollowupSequenceUpdate) =>
  apiFetch<FollowupSequenceSettings>(`${BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getFollowupActivity = (limit = 15) =>
  apiFetch<FollowupActivityItem[]>(`${BASE}/activity?limit=${limit}`);

const lead = (contactId: string) =>
  `/api/v1/outreach/leads/${encodeURIComponent(contactId)}/followup`;

export const stopLeadFollowup = (contactId: string) =>
  apiFetch<LeadFollowup>(`${lead(contactId)}/stop`, { method: "POST" });

export const resumeLeadFollowup = (contactId: string) =>
  apiFetch<LeadFollowup>(`${lead(contactId)}/resume`, { method: "POST" });

/** "en_US", "hi", or null for the language they write in. */
export const setLeadFollowupLanguage = (contactId: string, language: string | null) =>
  apiFetch<LeadFollowup>(`${lead(contactId)}/language`, {
    method: "PUT",
    body: JSON.stringify({ language }),
  });

export const LANGUAGE_LABEL: Record<string, string> = { en_US: "English", hi: "Hindi" };

/** "Thu 10:00" for a next send this week, "21 Nov 10:00" further out. */
export function whenLabel(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const days = (date.getTime() - Date.now()) / 86_400_000;
  const time = date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (days < 6) {
    return `${date.toLocaleDateString("en-IN", { weekday: "short" })} ${time}`;
  }
  return `${date.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} ${time}`;
}

/** The one line on a lead's row. Empty when there is nothing worth saying. */
export function leadFollowupLine(followup: LeadFollowup | null | undefined): string {
  if (!followup) return "";
  switch (followup.status) {
    case "active":
    case "sending":
      return followup.next_at
        ? `Follow-up ${Math.min(followup.step + 1, followup.total)} of ${followup.total} · ${whenLabel(followup.next_at)}`
        : `Follow-up ${followup.sent} of ${followup.total} sent`;
    case "completed":
      return `All ${followup.total} follow-ups done`;
    case "stopped":
      return `Follow-ups stopped · ${followup.stop_label ?? "stopped"}`;
    default:
      return "";
  }
}
