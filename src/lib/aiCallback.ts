import { apiFetch } from "./api";

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
