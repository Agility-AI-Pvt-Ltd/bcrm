/**
 * Typed client for the /outreach API: mass WhatsApp sends, the six-stage lead
 * pipeline, and the AI's 6-hourly office shift.
 *
 * Two backend behaviours shape everything here.
 *
 * 1. Temporal is optional. Lifecycle calls return `scheduled: false` instead of
 *    failing when no worker is running, and the work stays queued in Postgres.
 *    So `scheduled === false` must be rendered as "queued", never as an error.
 * 2. Nothing deletes a recipient. A recipient row is the record of whether a
 *    lead was reached, so cancelling only changes the campaign status.
 */

import { apiFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// Vocabulary — mirrors app/modules/outreach/policy.py
// ---------------------------------------------------------------------------

export const CUSTOMER_STAGES = [
  "New",
  "Contacted",
  "Replied",
  "Visit Scheduled",
  "Negotiating",
  "Closed",
] as const;

export type CustomerStage = (typeof CUSTOMER_STAGES)[number];

export const ENGAGEMENT_TIERS = ["high", "medium", "low"] as const;
export type EngagementTier = (typeof ENGAGEMENT_TIERS)[number];

export const SEND_STATUSES = [
  "pending",
  "queued",
  "sent",
  "delivered",
  "read",
  "replied",
  "failed",
  "skipped",
] as const;

export type SendStatus = (typeof SEND_STATUSES)[number];

export type CampaignStatus =
  | "draft"
  | "queued"
  | "running"
  | "paused"
  | "completed"
  | "failed";

/** Task names the office shift understands, in the order it prefers them. */
export const OFFICE_TASKS = [
  "retry_failed_sends",
  "send_pending_first_touch",
  "start_nurture_workflows",
  "refresh_engagement_tiers",
  "flag_stale_for_broker",
] as const;

export type OfficeTask = (typeof OFFICE_TASKS)[number];

export const OFFICE_TASK_LABELS: Record<string, string> = {
  retry_failed_sends: "Retry failed sends",
  send_pending_first_touch: "Send the queued first messages",
  start_nurture_workflows: "Start follow-ups for quiet leads",
  refresh_engagement_tiers: "Re-grade engagement tiers",
  flag_stale_for_broker: "Hand cold leads to a human",
};

/** Human wording for the office snapshot counters. */
export const OFFICE_COUNT_LABELS: Record<string, string> = {
  never_messaged: "Never messaged",
  failed_sends: "Failed sends to retry",
  pending_recipients: "Waiting to be sent",
  awaiting_nurture: "Quiet, follow-up due",
  tier_drift: "Tiers out of date",
  stale_leads: "Gone cold",
  replied_awaiting_stage: "Replied, stage behind",
  uncampaigned_rows: "Uploaded, no campaign",
};

/** Why a row was left out of a campaign audience — keys from outreach/audience.py. */
export const SKIP_REASON_LABELS: Record<string, string> = {
  no_phone: "No usable phone number",
  duplicate_in_file: "Same number appears twice in the file",
  already_messaged: "Already messaged by an earlier campaign",
  already_in_campaign: "Another live campaign is already targeting them",
  opted_out: "Opted out",
  stage_closed: "Lead already closed",
  not_a_row: "Empty row",
};

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export type CampaignProgress = {
  total: number;
  completed: number;
  percent: number;
};

export type CampaignSummary = {
  id: string;
  name: string;
  status: CampaignStatus | string;
  dataset_id: string | null;
  source_file: string | null;
  template_name: string | null;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  replied_count: number;
  outstanding: number;
  counts: Partial<Record<SendStatus | "total", number>>;
  progress: CampaignProgress;
  workflow_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  created_at: string | null;
};

export type CampaignCreateRequest = {
  dataset_id: string;
  name?: string;
  template_name?: string;
  template_language?: string;
  template_body?: string;
  template_variables?: Record<string, string>;
  message_body?: string;
  batch_size?: number;
  throttle_seconds?: number;
  auto_nurture?: boolean;
  only_not_messaged?: boolean;
  exclude_other_campaigns?: boolean;
  limit?: number;
  start_now?: boolean;
};

export type CampaignCreateResponse = {
  campaign: CampaignSummary;
  queued: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  message: string;
  workflow_id: string | null;
  scheduled: boolean;
};

export type CampaignActionResponse = {
  campaign: CampaignSummary;
  message: string;
  workflow_id: string | null;
  scheduled: boolean;
};

export type AudienceRefreshResponse = {
  campaign: CampaignSummary;
  added: number;
  message: string;
};

export type BatchRunResponse = {
  campaign_id: string;
  status: string;
  sent: number;
  failed: number;
  skipped: number;
  outstanding: number;
  paused: boolean;
};

export type Recipient = {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  name: string | null;
  phone: string;
  email: string | null;
  row_index: number | null;
  send_status: SendStatus | string;
  send_mode: string;
  rendered_message: string | null;
  provider_message_id: string | null;
  attempts: number;
  error: string | null;
  skip_reason: string | null;
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  replied_at: string | null;
  failed_at: string | null;
  created_at: string;
};

export type RecipientPage = {
  items: Recipient[];
  counts: Partial<Record<SendStatus | "total", number>>;
  limit: number;
  offset: number;
};

export type Lead = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  customer_stage: CustomerStage | string;
  engagement_tier: EngagementTier | string;
  intent_score: number | null;
  reply_count: number;
  messaged_count: number;
  last_reply_at: string | null;
  /**
   * What the customer last wrote to us, kept on the contact by the backend at
   * reply time. Null when they have never replied, or when their only reply was
   * media with no caption — render a dash, not an empty quote.
   */
  last_reply_text: string | null;
  first_messaged_at: string | null;
  outreach_paused: boolean;
  preferred_location: string | null;
  bhk: string | null;
  budget_label: string | null;
  source_dataset_id: string | null;
  updated_at: string;
};

export type LeadPage = {
  items: Lead[];
  total: number;
  limit: number;
  offset: number;
};

export type PipelineSnapshot = {
  stages: string[];
  tiers: string[];
  counts: Record<string, number>;
};

export type OfficeSnapshot = {
  organization_id: string;
  counts: Record<string, number>;
  plan: string[];
};

export type OfficeTaskResult = {
  task: string;
  handled?: number;
  error?: string;
  detail?: Record<string, unknown>;
};

export type OfficeShiftResult = {
  organization_id: string;
  snapshot: Record<string, number>;
  plan: string[];
  results: OfficeTaskResult[];
  summary: string;
  totals: Record<string, number>;
};

export type OfficeScheduleResult = {
  organization_id: string;
  scheduled: boolean;
  cron: string;
  workflow_id: string;
  message: string;
};

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

export async function listCampaigns(params: {
  status?: string;
  limit?: number;
} = {}) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("limit", String(params.limit ?? 50));
  return apiFetch<CampaignSummary[]>(`/api/v1/outreach/campaigns?${query}`);
}

export async function createCampaign(payload: CampaignCreateRequest) {
  return apiFetch<CampaignCreateResponse>("/api/v1/outreach/campaigns", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getCampaign(campaignId: string) {
  return apiFetch<CampaignSummary>(`/api/v1/outreach/campaigns/${campaignId}`);
}

async function campaignAction(campaignId: string, action: string) {
  return apiFetch<CampaignActionResponse>(
    `/api/v1/outreach/campaigns/${campaignId}/${action}`,
    { method: "POST" },
  );
}

export const startCampaign = (id: string) => campaignAction(id, "start");
export const pauseCampaign = (id: string) => campaignAction(id, "pause");
export const resumeCampaign = (id: string) => campaignAction(id, "resume");
export const cancelCampaign = (id: string) => campaignAction(id, "cancel");

export async function refreshCampaignAudience(campaignId: string) {
  return apiFetch<AudienceRefreshResponse>(
    `/api/v1/outreach/campaigns/${campaignId}/refresh-audience`,
    { method: "POST" },
  );
}

/** Send one slice immediately. Safe to repeat until `outstanding` is 0. */
export async function sendCampaignBatch(campaignId: string, limit?: number) {
  const query = limit ? `?limit=${limit}` : "";
  return apiFetch<BatchRunResponse>(
    `/api/v1/outreach/campaigns/${campaignId}/send-batch${query}`,
    { method: "POST" },
  );
}

export async function listCampaignRecipients(
  campaignId: string,
  params: { status?: string; limit?: number; offset?: number } = {},
) {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  query.set("limit", String(params.limit ?? 100));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<RecipientPage>(
    `/api/v1/outreach/campaigns/${campaignId}/recipients?${query}`,
  );
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

export async function getPipeline() {
  return apiFetch<PipelineSnapshot>("/api/v1/outreach/pipeline");
}

/**
 * One page of the pipeline.
 *
 * `replied: true` is what makes the Leads page different from the Pipeline page:
 * it keeps only people who actually answered on WhatsApp. The backend filters on
 * the reply counter rather than the stage, so a hand-set stage never fabricates a
 * lead and a single reply is always enough to create one.
 */
export async function listLeads(
  params: {
    stage?: string;
    tier?: string;
    replied?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
) {
  const query = new URLSearchParams();
  if (params.stage) query.set("stage", params.stage);
  if (params.tier) query.set("tier", params.tier);
  if (params.replied) query.set("replied", "true");
  if (params.search) query.set("search", params.search);
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<LeadPage>(`/api/v1/outreach/leads?${query}`);
}

// ---------------------------------------------------------------------------
// The AI's office shift
// ---------------------------------------------------------------------------

export async function getOfficeSnapshot() {
  return apiFetch<OfficeSnapshot>("/api/v1/outreach/office/snapshot");
}

export async function runOfficeShift(plan?: string[]) {
  return apiFetch<OfficeShiftResult>("/api/v1/outreach/office/run", {
    method: "POST",
    body: JSON.stringify({ plan: plan ?? null }),
  });
}

export async function scheduleOfficeShift() {
  return apiFetch<OfficeScheduleResult>("/api/v1/outreach/office/schedule", {
    method: "POST",
  });
}

// ---------------------------------------------------------------------------
// Writing the message with the AI
// ---------------------------------------------------------------------------

/** The composer's fields, exactly as the form holds them. */
export type ComposerDraft = {
  campaign_name: string;
  template_name: string;
  template_language: string;
  template_body: string;
  /** Placeholder number → column name, e.g. `{ "1": "Full Name" }`. */
  variables: Record<string, string>;
  message_body: string;
  notes: string;
};

export type ComposerDraftResponse = {
  draft: ComposerDraft;
  summary: string;
  /** Decisions for the operator, not failures. */
  warnings: string[];
  /** `ready`, `fallback` (written without the LLM) or `empty`. */
  status: string;
  columns: string[];
  llm: Record<string, unknown>;
};

/**
 * Ask the AI to write a campaign for one list.
 *
 * The list id is required rather than optional: placeholders are resolved against
 * that list's column names, and a draft written without them sends empty
 * parameters that WhatsApp rejects. Only the column *names* reach the model — the
 * backend never sends a customer's details.
 *
 * `current` is whatever is already typed, so "make it shorter" has something to
 * shorten. What comes back is a proposal; nothing is sent and every field stays
 * editable.
 */
export async function draftCampaignMessage(payload: {
  instruction: string;
  dataset_id: string;
  current?: Partial<ComposerDraft>;
}) {
  return apiFetch<ComposerDraftResponse>("/api/v1/agents/campaign-composer/draft", {
    method: "POST",
    body: JSON.stringify({
      instruction: payload.instruction,
      dataset_id: payload.dataset_id,
      current: payload.current ?? {},
    }),
  });
}

// ---------------------------------------------------------------------------
// Uploading a spreadsheet — one file becomes one table
// ---------------------------------------------------------------------------

export type UploadedDataset = {
  action: string;
  dataset: {
    id: string;
    name: string;
    slug: string;
    source_file: string | null;
    source_type: string;
    selected_columns: string[];
    row_count: number;
    created_at: string;
  };
  rows_added: number;
  contacts_created: number;
  duplicates: { has_duplicates: boolean; duplicate_count: number; warning: string | null };
};

/**
 * Upload an .xlsx/.xlsm/.csv/.tsv as a single tracked table.
 *
 * `Content-Type` is left unset on purpose: the browser has to write the
 * multipart boundary itself, and `apiFetch` only adds a JSON content type when
 * the body is not already a FormData.
 */
export async function uploadSpreadsheet(
  file: File,
  options: { importToContacts?: boolean; notes?: string } = {},
) {
  const form = new FormData();
  form.append("file", file);
  form.append("import_to_contacts", String(options.importToContacts ?? true));
  if (options.notes) form.append("notes", options.notes);
  return apiFetch<UploadedDataset>("/api/v1/contacts/datasets/upload", {
    method: "POST",
    body: form,
  });
}

// ---------------------------------------------------------------------------
// Small formatting helpers shared by the outreach views
// ---------------------------------------------------------------------------

export function stageBadgeColor(
  stage: string,
): "primary" | "success" | "error" | "warning" | "info" | "light" | "dark" {
  switch (stage) {
    case "Closed":
      return "dark";
    case "Negotiating":
      return "warning";
    case "Visit Scheduled":
      return "success";
    case "Replied":
      return "info";
    case "Contacted":
      return "primary";
    default:
      return "light";
  }
}

export function tierBadgeColor(
  tier: string,
): "primary" | "success" | "error" | "warning" | "info" | "light" | "dark" {
  if (tier === "high") return "success";
  if (tier === "medium") return "warning";
  return "light";
}

export function sendStatusBadgeColor(
  status: string,
): "primary" | "success" | "error" | "warning" | "info" | "light" | "dark" {
  switch (status) {
    case "replied":
      return "success";
    case "read":
    case "delivered":
      return "info";
    case "sent":
      return "primary";
    case "failed":
      return "error";
    case "skipped":
      return "light";
    default:
      return "warning";
  }
}

export function campaignStatusBadgeColor(
  status: string,
): "primary" | "success" | "error" | "warning" | "info" | "light" | "dark" {
  switch (status) {
    case "running":
      return "primary";
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "paused":
      return "warning";
    case "queued":
      return "info";
    default:
      return "light";
  }
}

export function formatWhen(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "3 days ago" style, because a broker cares about the gap, not the timestamp. */
export function formatSince(value: string | null | undefined) {
  if (!value) return "never";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function shortFileLabel(source: string | null | undefined) {
  if (!source) return "—";
  if (source.includes("docs.google.com/spreadsheets")) return "Google Sheet";
  const file = source.split("/").pop() || source;
  return file.length > 42 ? `${file.slice(0, 39)}…` : file;
}
