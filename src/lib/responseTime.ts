import { apiFetch } from "./api";

/**
 * Time to first response: how fast a new enquiry hears back, and from whom.
 *
 * Two gaps, both from the enquiry arriving (a customer's first WhatsApp message,
 * or a portal lead reaching EstateFlow):
 * - first reply: anything we sent back, the AI included;
 * - first human contact: a person's typed message or a call marked done.
 * Enquiries nobody has answered are counted as waiting, never left out.
 */

export type ResponseStats = {
  enquiries: number;
  answered: number;
  median_seconds: number | null;
  slowest_seconds: number | null;
  waiting: number;
  oldest_waiting_seconds: number | null;
};

export type SourceResponse = {
  source: string;
  first_reply: ResponseStats;
  first_human: ResponseStats;
};

export type AgentResponse = {
  agent: string;
  is_ai: boolean;
  enquiries: number;
  median_seconds: number;
  slowest_seconds: number;
};

export type ResponseTimeReport = {
  days: number;
  since: string;
  first_reply: ResponseStats;
  first_human: ResponseStats;
  by_source: SourceResponse[];
  by_agent: AgentResponse[];
};

export const RESPONSE_PERIODS = [
  { days: 1, label: "Last 24 hours" },
  { days: 7, label: "Last 7 days" },
  { days: 30, label: "Last 30 days" },
] as const;

export type ResponseDays = (typeof RESPONSE_PERIODS)[number]["days"];

export function getResponseTime(days: ResponseDays) {
  return apiFetch<ResponseTimeReport>(`/api/v1/reporting/response-time?days=${days}`);
}

/** "8 s", "4 min", "2 h 5 min", "3 days". A blank, never 0, when there is nothing. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "—";
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  return `${Math.round(hours / 24)} days`;
}
