/**
 * AI phone calling.
 *
 * A call campaign is a batch of outbound calls placed at a controlled rate. The
 * pacing lives on the server: the browser hands over a list and a script and gets
 * a campaign id back, and every number is dialled eventually even when the batch
 * is far larger than the dealer's line capacity.
 */

import { apiFetch } from "./api";

export type CallStatus =
  | "queued"
  | "dialing"
  | "ringing"
  | "in_progress"
  | "completed"
  | "no_answer"
  | "busy"
  | "failed"
  | "canceled";

export type CampaignStatus = "running" | "paused" | "completed" | "canceled";

export type CallRecord = {
  id: string;
  organization_id: string;
  contact_id: string | null;
  campaign_id: string | null;
  phone_number: string;
  status: CallStatus;
  attempt_count: number;
  max_attempts: number;
  scheduled_at: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  /** What the AI concluded, e.g. "interested". Set after the call ends. */
  outcome: string | null;
  next_action: string | null;
  summary: string | null;
  transcript: string | null;
  failure_reason: string | null;
  created_at: string;
};

export type CallPage = {
  items: CallRecord[];
  total: number;
  limit: number;
  offset: number;
  counts: Record<string, number>;
};

export type CallCampaign = {
  id: string;
  organization_id: string;
  name: string;
  status: CampaignStatus;
  /** Lines this campaign holds at once. Capped at the dealer's own ceiling. */
  concurrency: number;
  total_calls: number;
  agent_prompt: string | null;
  dataset_id: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type CampaignProgress = {
  total: number;
  completed: number;
  in_flight: number;
  pending: number;
  by_status: Record<string, number>;
};

export type CallCampaignDetail = CallCampaign & {
  progress: CampaignProgress;
  estimated_minutes: number | null;
};

export type CampaignPage = {
  items: CallCampaign[];
  total: number;
  limit: number;
  offset: number;
};

export type CampaignTarget = {
  phone_number?: string;
  contact_id?: string;
  lead_id?: string;
  metadata?: Record<string, unknown>;
};

export type CampaignCreateRequest = {
  name: string;
  /** A saved list or a group built on the Messages screen. */
  dataset_id?: string;
  /** Explicit numbers, when calling an ad-hoc selection instead of a list. */
  targets?: CampaignTarget[];
  agent_prompt?: string;
  /** ISO timestamp. Omit to start immediately. */
  scheduled_at?: string;
  limit?: number;
  max_attempts?: number;
  concurrency?: number;
  metadata?: Record<string, unknown>;
};

export type CampaignCreateResponse = {
  campaign: CallCampaign;
  workflow_id: string | null;
  started: boolean;
  estimated_minutes: number | null;
  /** Rows dropped from the list, so "I uploaded 300 and it called 240" has an answer. */
  skipped_no_phone: number;
  skipped_duplicate: number;
  message: string;
};

export type CallCapacity = {
  organization_id: string;
  organization_active: number;
  organization_limit: number;
  global_active: number;
  global_limit: number;
  accepting: boolean;
};

export type CallScriptDraft = {
  agent_prompt: string;
  opening_line: string;
  goals: string[];
};

export type CallScriptDraftResponse = {
  draft: CallScriptDraft;
  summary: string;
  warnings: string[];
  /** "ready" came from the AI, "fallback" was written without it. */
  status: "ready" | "fallback" | "empty";
};

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function createCallCampaign(payload: CampaignCreateRequest) {
  return apiFetch<CampaignCreateResponse>("/api/v1/calls/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listCallCampaigns(
  params: { status?: string; limit?: number; offset?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("limit", String(params.limit ?? 25));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<CampaignPage>(`/api/v1/calls/campaigns?${query}`);
}

export async function getCallCampaign(campaignId: string) {
  return apiFetch<CallCampaignDetail>(`/api/v1/calls/campaigns/${campaignId}`);
}

function campaignAction(campaignId: string, action: "pause" | "resume" | "cancel") {
  return apiFetch<CallCampaignDetail>(
    `/api/v1/calls/campaigns/${campaignId}/${action}`,
    { method: "POST" },
  );
}

export const pauseCallCampaign = (id: string) => campaignAction(id, "pause");
export const resumeCallCampaign = (id: string) => campaignAction(id, "resume");
export const cancelCallCampaign = (id: string) => campaignAction(id, "cancel");

// ---------------------------------------------------------------------------
// Individual calls
// ---------------------------------------------------------------------------

export async function listCalls(
  params: { status?: string; contactId?: string; limit?: number; offset?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.contactId) query.set("contact_id", params.contactId);
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<CallPage>(`/api/v1/calls?${query}`);
}

export async function getCallCapacity() {
  return apiFetch<CallCapacity>("/api/v1/calls/capacity");
}

// ---------------------------------------------------------------------------
// AI script writer
// ---------------------------------------------------------------------------

export async function draftCallScript(payload: {
  instruction: string;
  campaign_name?: string;
  language?: string;
  current_prompt?: string;
}) {
  return apiFetch<CallScriptDraftResponse>("/api/v1/agents/call-script/draft", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

// ---------------------------------------------------------------------------
// Presentation helpers
// ---------------------------------------------------------------------------

/** Terminal statuses, so the UI can stop polling a finished campaign. */
export const CAMPAIGN_FINISHED: CampaignStatus[] = ["completed", "canceled"];

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  queued: "Waiting",
  dialing: "Dialling",
  ringing: "Ringing",
  in_progress: "On the call",
  completed: "Completed",
  no_answer: "No answer",
  busy: "Busy",
  failed: "Failed",
  canceled: "Cancelled",
};

/**
 * A long campaign is normal, not broken. Ninety minutes for 200 leads on five
 * lines is arithmetic, so the UI says so up front rather than looking stuck.
 */
export function describeDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes <= 0) return "less than a minute";
  if (minutes < 60) return `about ${minutes} minutes`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourText = hours === 1 ? "1 hour" : `${hours} hours`;
  return rest ? `about ${hourText} ${rest} minutes` : `about ${hourText}`;
}
