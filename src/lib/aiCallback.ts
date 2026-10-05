import { apiFetch } from "./api";
import type { AiCallbackView } from "./inbox";

/**
 * The enquiry callback: when someone messages on WhatsApp, the AI replies, and
 * they go quiet, the AI phones them after `delay_minutes`, asks budget / BHK /
 * locality / move-in, and the details follow on WhatsApp.
 */
export type AiCallbackSettings = {
  enabled: boolean;
  delay_minutes: number;
  min_delay_minutes: number;
  max_delay_minutes: number;
  /** False when this deployment cannot place calls yet (Vobiz, caller ID…). */
  voice_ready: boolean;
  warnings: string[];
  /** Calls ring, but status updates or transcripts will not work. */
  advisories: string[];
};

export type AiCallbackUpdate = {
  enabled?: boolean;
  delay_minutes?: number;
};

export async function getAiCallback() {
  return apiFetch<AiCallbackSettings>("/api/v1/profile/ai-callback");
}

export async function updateAiCallback(payload: AiCallbackUpdate) {
  return apiFetch<AiCallbackSettings>("/api/v1/profile/ai-callback", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export type AiCallbackActivityItem = {
  id: string;
  conversation_id: string;
  /** Set once the timer fired and a call was placed. */
  call_id: string | null;
  customer_name: string | null;
  phone: string | null;
  created_at: string | null;
  ai_callback: AiCallbackView;
};

export type AiCallbackActivity = {
  items: AiCallbackActivityItem[];
  /** How many of `items` are in each phase. */
  counts: Record<string, number>;
};

/** Upcoming and recent AI callbacks, newest first. */
export async function getAiCallbackActivity(limit = 50) {
  return apiFetch<AiCallbackActivity>(`/api/v1/profile/ai-callback/activity?limit=${limit}`);
}

/** One AI call, as this organisation sees it: what was said and learned. */
export type AiCallDetail = {
  id: string;
  status: string;
  phone: string;
  customer_name: string | null;
  business_name: string | null;
  conversation_id: string | null;
  is_test: boolean;
  created_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  outcome: string | null;
  next_action: string | null;
  summary: string | null;
  /** budget / bhk / locality / move_in / purpose, as the customer said them. */
  requirements: Record<string, string>;
  language: string | null;
  transcript: { speaker: "customer" | "ai" | string; text: string }[];
  /** Why the call failed, in words a broker can act on. */
  failure_reason: string | null;
  whatsapp_followup: string | null;
  ai_callback: AiCallbackView;
};

export async function getAiCall(callId: string) {
  return apiFetch<AiCallDetail>(
    `/api/v1/profile/ai-callback/calls/${encodeURIComponent(callId)}`,
  );
}

/** Ring your own phone with the real script, through the real path. */
export async function placeTestCall(phone?: string) {
  return apiFetch<AiCallDetail>("/api/v1/profile/ai-callback/test-call", {
    method: "POST",
    body: JSON.stringify({ phone: phone?.trim() || null }),
  });
}

/** Every AI call made for one chat, oldest first. */
export async function listConversationAiCalls(conversationId: string) {
  return apiFetch<AiCallDetail[]>(
    `/api/v1/conversations/${encodeURIComponent(conversationId)}/ai-calls`,
  );
}
