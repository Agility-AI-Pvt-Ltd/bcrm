import { apiFetch } from "./api";

/**
 * Presence: who handles customers right now, the broker or the AI.
 *
 * The four modes deliberately mirror a chat app's status picker, because that is
 * a control people already know how to read.
 */
export type AvailabilityMode = "available" | "scheduled" | "ai_only" | "away";

export type Availability = {
  mode: AvailabilityMode;
  human_phone: string | null;
  online_start: string;
  online_end: string;
  timezone: string;
  /** 0 = Monday. */
  weekdays: number[];
  offer_callback: boolean;
  away_message: string | null;

  // Resolved by the backend for *this moment*, so the screen shows the
  // consequence of the setting and not just the setting.
  human_online: boolean;
  ai_handles: boolean;
  share_phone: boolean;
  hours_label: string;
  /** The number customers would actually be given, after fallbacks. */
  effective_phone: string | null;
  warnings: string[];
};

export type AvailabilityUpdate = {
  mode?: AvailabilityMode;
  human_phone?: string | null;
  online_start?: string;
  online_end?: string;
  timezone?: string;
  weekdays?: number[];
  offer_callback?: boolean;
  away_message?: string | null;
};

export async function getAvailability() {
  return apiFetch<Availability>("/api/v1/profile/availability");
}

/**
 * Partial update. Sending only `{ mode }` from the picker leaves the schedule
 * underneath it untouched.
 */
export async function updateAvailability(payload: AvailabilityUpdate) {
  return apiFetch<Availability>("/api/v1/profile/availability", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export const MODE_OPTIONS: {
  value: AvailabilityMode;
  label: string;
  description: string;
  /** Tailwind background for the status dot. */
  dot: string;
}[] = [
  {
    value: "available",
    label: "Available",
    description: "You're reachable now. The AI shares your number straight away.",
    dot: "bg-success-500",
  },
  {
    value: "scheduled",
    label: "Working hours",
    description: "Follow the schedule below. The AI covers evenings and days off.",
    dot: "bg-brand-500",
  },
  {
    value: "ai_only",
    label: "AI only",
    description:
      "The AI handles every enquiry and never gives out your number. Always on.",
    dot: "bg-purple-500",
  },
  {
    value: "away",
    label: "Away",
    description: "You're not reachable at all today. The AI covers and takes messages.",
    dot: "bg-gray-400",
  },
];

/** 0 = Monday, matching the backend and `Date.getDay()` shifted by one. */
export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * A short list of timezones rather than the full IANA database. The backend
 * accepts any valid zone; this is only what the dropdown offers, and offering
 * six hundred entries to a broker in Pune helps nobody.
 */
export const TIMEZONE_OPTIONS = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
];

/** The sentence describing what a customer messaging right now would be told. */
export function describeLiveState(availability: Availability): string {
  if (!availability.share_phone) {
    return "Customers are being handled entirely by the AI. Your number is not being shared.";
  }
  if (availability.human_online) {
    const phone = availability.effective_phone;
    return phone
      ? `Customers are being told you're available and given ${phone}.`
      : "Customers are being told you're available, but there's no number to give them.";
  }
  return `Customers are being handled by the AI and told you're back ${availability.hours_label}.`;
}
