import { apiFetch } from "@/lib/api";

export type LeadStateEnum =
  | "active"
  | "snoozed_fixed"
  | "snoozed_conditional"
  | "pending_family_decision"
  | "blocked_dnd"
  | "parked_financing"
  | "at_risk_competitor"
  | "no_show_reschedule"
  | "ghosted"
  | "archived";

export type LeadTier = "hot" | "warm" | "cold";

export type FollowupStatus = "pending" | "approved_sent" | "edited_sent" | "dismissed";

export interface LeadScoreBreakdown {
  base_score?: number;
  budget_profile_present?: number;
  property_interest_present?: number;
  phone_profile_present?: number;
  conversation_depth?: number;
  [key: string]: number | undefined;
}

export interface LeadPriorityItem {
  id: string;
  name: string;
  phone: string | null;
  score: number;
  tier: LeadTier;
  score_breakdown: LeadScoreBreakdown;
  reason: string;
}

export interface RecommendedChannelResult {
  channel: "voice" | "whatsapp" | "call";
  reason: string;
}

export interface TimelineItem {
  id: string;
  role: "customer" | "broker" | "agent" | "system";
  message_type: "text" | "audio" | "call_log" | "state_change" | string;
  text: string | null;
  transcript: string | null;
  transcript_language: string | null;
  extracted_entities?: {
    callback_condition?: string | null;
    sentiment?: string | null;
    [key: string]: any;
  } | null;
  audio_url: string | null;
  created_at: string;
}

export interface FollowupDraftItem {
  id: string;
  lead_id: string;
  channel: "whatsapp" | "call_script" | string;
  draft_text: string;
  generation_reason: string;
  status: FollowupStatus;
  created_at: string;
}

export interface AgentSettings {
  id?: string;
  preferred_language: string;
  working_hours: {
    start: string;
    end: string;
  };
  dnd_windows: Array<{
    start: string;
    end: string;
  }>;
  scoring_weights: {
    budget: number;
    property_interest: number;
    conversation_depth: number;
    [key: string]: number;
  };
  cadence_rules: {
    followup_interval_days: number;
    [key: string]: any;
  };
  voice_provider: string;
}

// Leads and Priority Queue Endpoints
export async function getPriorityQueue(limit = 50): Promise<LeadPriorityItem[]> {
  return apiFetch<LeadPriorityItem[]>(`/api/v1/leads/priority-queue?limit=${limit}`);
}

export async function getRecommendedChannel(leadId: string): Promise<RecommendedChannelResult> {
  return apiFetch<RecommendedChannelResult>(`/api/v1/leads/${leadId}/recommended-channel`);
}

export async function changeLeadState(
  leadId: string,
  state: LeadStateEnum,
  reason?: string,
): Promise<{ id: string; current_state: string; state_reason: string | null }> {
  return apiFetch<{ id: string; current_state: string; state_reason: string | null }>(
    `/api/v1/leads/${leadId}/state`,
    {
      method: "POST",
      body: JSON.stringify({ current_state: state, state_reason: reason }),
    },
  );
}

export async function getLeadTimeline(leadId: string): Promise<TimelineItem[]> {
  return apiFetch<TimelineItem[]>(`/api/v1/leads/${leadId}/timeline`);
}

// Conversations & Media Uploads Endpoints
export async function uploadVoiceNote(
  leadId: string,
  file: File,
): Promise<{ message_id: string; audio_url: string; status: string }> {
  const formData = new FormData();
  formData.append("lead_id", leadId);
  formData.append("file", file);

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/v1/conversations/voice-note`,
    {
      method: "POST",
      body: formData,
      headers: {
        "X-Organization-Id": "default",
      },
    },
  );

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message || "Voice note upload failed");
  }
  return payload.data;
}

export async function logOutboundCall(
  leadId: string,
  duration: number,
  audioUrl?: string,
): Promise<{ message_id: string; status: string }> {
  const params = new URLSearchParams();
  params.append("lead_id", leadId);
  params.append("duration", String(duration));
  if (audioUrl) {
    params.append("audio_url", audioUrl);
  }

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"}/api/v1/conversations/call-log`,
    {
      method: "POST",
      body: params,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Organization-Id": "default",
      },
    },
  );

  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.error?.message || "Outbound call logging failed");
  }
  return payload.data;
}

// Follow-up Draft Reviews Endpoints
export async function getPendingFollowups(): Promise<FollowupDraftItem[]> {
  return apiFetch<FollowupDraftItem[]>("/api/v1/followups/pending");
}

export async function approveFollowup(
  draftId: string,
  draftText?: string,
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(`/api/v1/followups/${draftId}/approve`, {
    method: "POST",
    body: draftText ? JSON.stringify({ draft_text: draftText }) : undefined,
  });
}

export async function dismissFollowup(draftId: string): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(`/api/v1/followups/${draftId}/dismiss`, {
    method: "POST",
  });
}

// Settings Endpoints
export async function getAgentSettings(agentId = "current"): Promise<AgentSettings> {
  return apiFetch<AgentSettings>(`/api/v1/settings/agent/${agentId}`);
}

export async function updateAgentSettings(
  settings: Partial<AgentSettings>,
  agentId = "current",
): Promise<{ id: string; status: string }> {
  return apiFetch<{ id: string; status: string }>(`/api/v1/settings/agent/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}
