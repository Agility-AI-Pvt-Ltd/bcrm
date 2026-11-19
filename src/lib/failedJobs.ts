import { apiFetch } from "./api";

/**
 * Failed AI calls and visit reminders (failed WhatsApp replies have their own
 * list). Each stays here until it is retried or dismissed; the owner is told
 * through the bell and on WhatsApp when one fails.
 */
export type FailedJob = {
  kind: "ai_call" | "reminder";
  /** A call id, or "<visit id>:<reminder kind>". */
  id: string;
  /** "AI call", "Visit reminder", "Day-before reminder". */
  what: string;
  customer_name: string | null;
  customer_phone: string | null;
  contact_id: string | null;
  conversation_id: string | null;
  /** In plain words, not the raw error. */
  reason: string;
  visit_id?: string;
  visit_label?: string;
  failed_at: string | null;
};

export const listFailedJobs = () =>
  apiFetch<{ items: FailedJob[]; total: number }>("/api/v1/failed-jobs");

const path = (job: FailedJob, action: string) =>
  `/api/v1/failed-jobs/${job.kind}/${encodeURIComponent(job.id)}/${action}`;

export const retryFailedJob = (job: FailedJob) =>
  apiFetch<{ retried: boolean }>(path(job, "retry"), { method: "POST" });

export const dismissFailedJob = (job: FailedJob) =>
  apiFetch<{ dismissed: boolean }>(path(job, "dismiss"), { method: "POST" });
