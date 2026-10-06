import { apiFetch } from "./api";

/**
 * First touch: a lead arrives from a portal through Zoho, and within a minute an
 * approved WhatsApp template goes out asking for budget and locality. We message
 * first — the customer has not written to us — so the rules are strict and live
 * on the server; this module only reads and writes the settings.
 */
export type FirstTouchSettings = {
  enabled: boolean;
  delay_seconds: number;
  max_lead_age_minutes: number;
  daily_cap: number;
  /** After the template, phone them through AI Callback if they never reply. */
  call_if_no_reply: boolean;
  template_name: string;
  template_language: string;
  min_delay_seconds: number;
  max_delay_seconds: number;
  /** APPROVED / PENDING / REJECTED / NOT_SUBMITTED, for this agency's own WABA. */
  template_status: string;
  warnings: string[];
  /** True when a lead landing right now would actually be messaged. */
  ready: boolean;
  sent_today: number;
};

export type FirstTouchUpdate = {
  enabled?: boolean;
  delay_seconds?: number;
  max_lead_age_minutes?: number;
  daily_cap?: number;
  call_if_no_reply?: boolean;
};

export type FirstTouchView = {
  phase: "scheduled" | "sending" | "sent" | "undelivered" | "skipped" | "failed";
  tone: "info" | "success" | "error" | "muted";
  seconds_until_send: number;
  label: string;
};

export type FirstTouchActivityItem = {
  id: string;
  lead_id: string;
  conversation_id: string | null;
  customer_name: string | null;
  phone: string | null;
  lead_source: string | null;
  status: string;
  reason: string | null;
  created_at: string | null;
  due_at: string | null;
  sent_at: string | null;
  /** The message as the customer received it. */
  preview: string | null;
  view: FirstTouchView;
};

export type FirstTouchActivity = {
  items: FirstTouchActivityItem[];
  counts: Record<string, number>;
  sent_today: number;
};

const BASE = "/api/v1/leads/first-touch";

export const getFirstTouchSettings = () => apiFetch<FirstTouchSettings>(`${BASE}/settings`);

export const updateFirstTouchSettings = (payload: FirstTouchUpdate) =>
  apiFetch<FirstTouchSettings>(`${BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const getFirstTouchActivity = (limit = 25) =>
  apiFetch<FirstTouchActivity>(`${BASE}/activity?limit=${limit}`);

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
