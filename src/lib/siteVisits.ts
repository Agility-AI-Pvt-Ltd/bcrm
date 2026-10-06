import { apiFetch } from "./api";

/**
 * Site visits: slot booking, reminders, the location pin, check-in and post-visit
 * feedback. Each fact carries the channel it came from — a broker tapping the
 * screen, the WhatsApp assistant, or an AI call's transcript — because a rating
 * typed by a person and one heard on a recording are not the same claim.
 */
export type VisitStatus =
  | "Requested"
  | "Confirmed"
  | "Checked in"
  | "Completed"
  | "No show"
  | "Cancelled";

export type VisitSource = "whatsapp" | "ai_call" | "manual" | "system";

export type VisitPhase =
  | "unscheduled"
  | "requested"
  | "confirmed"
  | "imminent"
  | "overdue"
  | "checked_in"
  | "completed"
  | "no_show"
  | "cancelled";

export type VisitView = {
  phase: VisitPhase;
  tone: "info" | "success" | "warning" | "error" | "muted";
  label: string;
  when_label: string;
  /** What this visit is still waiting for, in the order a broker would do it. */
  outstanding: string[];
};

export type VisitSlot = {
  slot_id: string;
  label: string;
  start: string;
  end: string;
  free: number;
};

export type VisitEvent = {
  id: string;
  kind: string;
  source: VisitSource;
  actor: string | null;
  detail: string | null;
  /** The customer's own words, when this was read out of a chat or a call. */
  evidence: string | null;
  created_at: string;
};

export type Visit = {
  id: string;
  status: VisitStatus;
  source: VisitSource;
  customer_name: string | null;
  customer_phone: string;
  conversation_id: string | null;
  contact_id: string | null;
  lead_id: string | null;
  property_id: string | null;
  property_title: string | null;
  property_location: string | null;
  call_id: string | null;

  scheduled_at: string | null;
  slot_end: string | null;
  timezone: string;
  duration_minutes: number;
  reschedule_count: number;
  notes: string | null;

  confirmed_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  completed_at: string | null;
  no_show_at: string | null;

  pin_latitude: number | null;
  pin_longitude: number | null;
  pin_label: string | null;
  pin_address: string | null;
  pin_map_url: string | null;
  pin_sent_at: string | null;

  reminder_24h_sent_at: string | null;
  reminder_2h_sent_at: string | null;

  checked_in_at: string | null;
  check_in_source: string | null;
  check_in_latitude: number | null;
  check_in_longitude: number | null;
  check_in_note: string | null;

  feedback_requested_at: string | null;
  feedback_at: string | null;
  feedback_rating: number | null;
  feedback_interest: string | null;
  feedback_liked: string | null;
  feedback_concerns: string | null;
  feedback_next_step: string | null;
  feedback_summary: string | null;
  feedback_source: string | null;

  needs_review: boolean;
  review_reason: string | null;
  created_at: string;
  view: VisitView;
};

export type VisitDetail = Visit & {
  timeline: VisitEvent[];
  slots: VisitSlot[];
};

export type VisitList = {
  items: Visit[];
  total: number;
  counts: Record<string, number>;
};

export type VisitSettings = {
  enabled: boolean;
  timezone: string;
  weekdays: number[];
  day_start: string;
  day_end: string;
  slot_minutes: number;
  capacity_per_slot: number;
  min_lead_minutes: number;
  max_days_ahead: number;
  auto_confirm: boolean;
  reminder_24h: boolean;
  reminder_2h: boolean;
  send_pin_with_reminder: boolean;
  ask_for_feedback: boolean;
  feedback_delay_minutes: number;
  warnings: string[];
  reminder_template_status: string;
  feedback_template_status: string;
};

export type VisitSettingsUpdate = Partial<
  Omit<VisitSettings, "warnings" | "reminder_template_status" | "feedback_template_status">
>;

export type VisitScope = "today" | "upcoming" | "needs_attention" | "past" | "all";

export type SendOutcome = { sent: boolean; reason: string; message_id: string | null };

const BASE = "/api/v1/visits";

export const getVisits = (scope: VisitScope = "upcoming", limit = 50) =>
  apiFetch<VisitList>(`${BASE}?scope=${scope}&limit=${limit}`);

export const getVisit = (id: string) => apiFetch<VisitDetail>(`${BASE}/${id}`);

export const getVisitSlots = (limit = 40) =>
  apiFetch<VisitSlot[]>(`${BASE}/slots?limit=${limit}`);

export const getVisitSettings = () => apiFetch<VisitSettings>(`${BASE}/settings`);

export const saveVisitSettings = (payload: VisitSettingsUpdate) =>
  apiFetch<VisitSettings>(`${BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const createVisit = (payload: {
  customer_phone: string;
  customer_name?: string | null;
  slot_id?: string | null;
  property_id?: string | null;
  notes?: string | null;
}) => apiFetch<VisitDetail>(BASE, { method: "POST", body: JSON.stringify(payload) });

const action = (id: string, path: string, body?: unknown) =>
  apiFetch<VisitDetail>(`${BASE}/${id}/${path}`, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });

export const confirmVisit = (id: string) => action(id, "confirm");
export const rescheduleVisit = (id: string, slotId: string) =>
  action(id, "reschedule", { slot_id: slotId });
export const cancelVisit = (id: string, reason?: string) =>
  action(id, "cancel", { reason: reason || null });
export const checkInVisit = (id: string, note?: string) =>
  action(id, "check-in", { note: note || null });
export const completeVisit = (id: string) => action(id, "complete");
export const noShowVisit = (id: string) => action(id, "no-show");
export const clearVisitReview = (id: string) => action(id, "clear-review");

export const setVisitPin = (
  id: string,
  payload: { link?: string; latitude?: number; longitude?: number; label?: string; address?: string },
) => apiFetch<VisitDetail>(`${BASE}/${id}/pin`, { method: "PUT", body: JSON.stringify(payload) });

export const sendVisitPin = (id: string) =>
  apiFetch<SendOutcome>(`${BASE}/${id}/send-pin`, { method: "POST" });

export const sendVisitReminder = (id: string, kind: "24h" | "2h" = "2h") =>
  apiFetch<SendOutcome>(`${BASE}/${id}/send-reminder?kind=${kind}`, { method: "POST" });

export const askVisitFeedback = (id: string) =>
  apiFetch<SendOutcome>(`${BASE}/${id}/ask-feedback`, { method: "POST" });

export const saveVisitFeedback = (
  id: string,
  payload: {
    rating?: number | null;
    interest?: string | null;
    liked?: string | null;
    concerns?: string | null;
    next_step?: string | null;
    summary?: string | null;
  },
) =>
  apiFetch<VisitDetail>(`${BASE}/${id}/feedback`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

// --- presentation -----------------------------------------------------------

export const SOURCE_LABELS: Record<VisitSource, string> = {
  whatsapp: "WhatsApp",
  ai_call: "AI call",
  manual: "Added by you",
  system: "Automatic",
};

export const INTEREST_LABELS: Record<string, string> = {
  hot: "Hot — ready to move",
  warm: "Warm — thinking",
  cold: "Cold — not keen",
};

export const NEXT_STEP_LABELS: Record<string, string> = {
  book: "Wants to book",
  negotiate: "Wants to negotiate",
  revisit: "Wants another visit",
  other_options: "Wants other options",
  thinking: "Thinking it over",
  not_interested: "Not interested",
};

export const TONE_TEXT: Record<VisitView["tone"], string> = {
  info: "text-brand-500",
  success: "text-success-600",
  warning: "text-warning-600",
  error: "text-error-500",
  muted: "text-gray-500 dark:text-gray-400",
};

export const TONE_CHIP: Record<VisitView["tone"], string> = {
  info: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  success: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  warning: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  muted: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
};

/** "6 Oct, 4:00 PM", in the visit's own timezone rather than the viewer's. */
export function formatSlot(visit: Pick<Visit, "scheduled_at" | "timezone">): string {
  if (!visit.scheduled_at) return "No time yet";
  const date = new Date(visit.scheduled_at);
  if (Number.isNaN(date.getTime())) return "No time yet";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: visit.timezone || undefined,
  });
}

export function formatWhen(value: string | null, timeZone?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timeZone || undefined,
  });
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
