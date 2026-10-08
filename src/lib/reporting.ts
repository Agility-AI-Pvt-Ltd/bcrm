import { apiFetch } from "./api";

/**
 * What each lead source costs per site visit and per booking.
 *
 * The arithmetic is trivial; the care is all in what is missing. A cost figure is only
 * useful if a broker believes it enough to move budget, and the fastest way to lose
 * that is a ₹0 that actually means "we don't know". So every cost is nullable and
 * every blank comes with a note saying why.
 */

export type SourceRow = {
  source: string;
  /** Null where no spend was recorded — never zero, which would read as free. */
  spend: string | null;
  leads: number;
  contacted: number;
  visits_booked: number;
  /** Visits that actually happened. A no-show bought nothing. */
  visits_done: number;
  bookings: number;
  cost_per_lead: string | null;
  cost_per_visit: string | null;
  cost_per_booking: string | null;
  lead_to_visit_pct: number | null;
  visit_to_booking_pct: number | null;
  notes: string[];
};

export type Period = { start: string; end: string; days: number; label: string };

export type SourcePerformance = {
  period: Period;
  rows: SourceRow[];
  totals: SourceRow;
};

export type Spend = {
  id: string;
  source: string;
  period_start: string;
  period_end: string;
  amount: string;
  notes: string | null;
};

export type OnboardingStep = {
  key: string;
  title: string;
  why: string;
  /** done | ready | blocked | waiting | optional */
  status: string;
  action_label: string;
  action_path: string;
  detail: string;
  waiting_for: string;
  required: boolean;
};

export type OnboardingReport = {
  live: boolean;
  done: number;
  required: number;
  percent: number;
  next_step: OnboardingStep | null;
  steps: OnboardingStep[];
  summary: string;
};

const BASE = "/api/v1/reporting";

export const getSourcePerformance = (start?: string, end?: string) => {
  const query = new URLSearchParams();
  if (start) query.set("start", start);
  if (end) query.set("end", end);
  const suffix = query.toString() ? `?${query}` : "";
  return apiFetch<SourcePerformance>(`${BASE}/sources${suffix}`);
};

export const listSpend = () => apiFetch<Spend[]>(`${BASE}/spend`);

export const addSpend = (body: {
  source: string;
  period_start: string;
  period_end: string;
  amount: string;
  notes?: string | null;
}) => apiFetch<Spend>(`${BASE}/spend`, { method: "POST", body: JSON.stringify(body) });

export const removeSpend = (id: string) =>
  apiFetch<{ deleted: string }>(`${BASE}/spend/${id}`, { method: "DELETE" });

export const getKnownSources = () => apiFetch<string[]>(`${BASE}/known-sources`);

export const getOnboarding = () =>
  apiFetch<OnboardingReport>("/api/v1/meta/onboarding");

export const STEP_CHIP: Record<string, string> = {
  done: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  ready: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  waiting: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  blocked: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
  optional: "bg-gray-100 text-gray-500 dark:bg-white/[0.06] dark:text-gray-400",
};

export const STEP_LABEL: Record<string, string> = {
  done: "Done",
  ready: "Do this now",
  waiting: "With Meta",
  blocked: "Waiting",
  optional: "Optional",
};

/** ₹65 L / ₹1.2 Cr / ₹25,000 — how money is read here, not in millions. */
export function money(value: string | number | null | undefined): string {
  const amount = typeof value === "string" ? Number(value) : value;
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  if (amount >= 10_000_000) return `₹${trim(amount / 10_000_000)} Cr`;
  if (amount >= 100_000) return `₹${trim(amount / 100_000)} L`;
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

function trim(value: number): string {
  return String(Math.round(value * 100) / 100);
}

/** The last 30 days, as the two date inputs want them. */
export function defaultRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 29 * 86_400_000);
  return { start: iso(start), end: iso(end) };
}

export function iso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** The first day of the month that `value` falls in, and its last day. */
export function monthBounds(value: string): { start: string; end: string } {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return defaultRange();
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start: iso(start), end: iso(end) };
}
