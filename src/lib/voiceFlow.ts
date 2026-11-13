import { API_BASE_URL, ApiError, TOKEN_KEY, apiFetch } from "./api";

/**
 * Flow voice (vc_v1): the prerecorded, flow-based voice agent, tried out in the
 * browser. A separate thing from the AI callback, which runs on the
 * pipecat_sarvam agent; nothing here touches that.
 *
 * Every sentence the agent says is fixed by the flow. The caller speaks through
 * the microphone; the API transcribes it and the flow decides what comes next.
 *
 * Off unless the server switches it on, BCRM allows the account, and (while it
 * is in testing) the session is a developer's. `getVoiceFlowStatus` says which.
 */

export type VoiceFlowStatus = {
  available: boolean;
  reason: "switched_off" | "not_configured" | "not_granted" | "developers_only" | null;
  message: string | null;
};

export type VoiceFlowFlow = {
  file: string;
  label: string;
  languages: string[];
  default_language: string;
  slots: string[];
};

export type VoiceFlowConfig = {
  tts_available: boolean;
  stt_available: boolean;
  voice: string;
  model: string;
  no_input_timeout_ms: number;
  ai_available: boolean;
  ai_model: string | null;
  flows: VoiceFlowFlow[];
};

export type VoiceFlowAgentEvent = {
  role: "agent";
  state: string;
  text: string;
  clips: string[];
  barge_in: boolean;
};

export type VoiceFlowCallerEvent = {
  role: "caller";
  kind: "speech" | "silence" | "hangup";
  text: string;
  over_prompt: boolean;
  via?: "mic";
  stt_ms?: number;
  /** Set when the rules could not place the answer and the AI chose a branch. */
  ai?: { placed: string; kind: string; reason: string };
};

export type VoiceFlowOutcome = {
  disposition: string;
  next_action: string;
  reason: string;
  final_state: string;
  turns: number;
  slots: Record<string, string>;
  flow: string;
  language: string;
};

export type VoiceFlowEndEvent = { role: "end"; outcome: VoiceFlowOutcome };

export type VoiceFlowEvent = VoiceFlowAgentEvent | VoiceFlowCallerEvent | VoiceFlowEndEvent;

export type VoiceFlowSnapshot = {
  session_id: string;
  /** Only the events after the `since` the request sent. */
  events: VoiceFlowEvent[];
  /** How many events the call has in all; send it back as `since`. */
  cursor: number;
  language: string;
  state: { id: string; kind: string; purpose: string; collect: string | null };
  playing: boolean;
  listening: boolean;
  ended: boolean;
  slots: Record<string, string>;
  /** ISO dates behind values a spoken date decided ("20 November" -> move_in). */
  dates?: Record<string, string>;
  counters: { no_input: number; no_match: number; off_topic: number };
  turns: number;
  outcome: VoiceFlowOutcome | null;
};

export async function getVoiceFlowStatus() {
  return apiFetch<VoiceFlowStatus>("/api/v1/voice-flow/status");
}

export async function getVoiceFlowConfig() {
  return apiFetch<VoiceFlowConfig>("/api/v1/voice-flow/config");
}

export async function startVoiceFlowCall(payload: {
  customer_name?: string;
  language?: string;
  ai_fallback: boolean;
}) {
  return apiFetch<VoiceFlowSnapshot>("/api/v1/voice-flow/calls", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** The prompt finished playing, the caller stayed silent, or hung up. */
export async function controlVoiceFlowCall(
  sessionId: string,
  type: "played" | "silence" | "hangup",
  since: number,
) {
  return apiFetch<VoiceFlowSnapshot>(`/api/v1/voice-flow/calls/${sessionId}/input`, {
    method: "POST",
    body: JSON.stringify({ type, since }),
  });
}

/** One spoken answer, as 16 kHz mono WAV. */
export async function sendVoiceFlowAudio(sessionId: string, wav: Blob, since: number) {
  return apiFetch<VoiceFlowSnapshot>(
    `/api/v1/voice-flow/calls/${sessionId}/audio?since=${since}`,
    { method: "POST", body: wav, headers: { "Content-Type": "audio/wav" } },
  );
}

/** The agent's voice for the prompt at `index` in this call's events. */
export async function fetchVoiceFlowPrompt(sessionId: string, index: number): Promise<Blob> {
  const token = typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY);
  const response = await fetch(
    `${API_BASE_URL}/api/v1/voice-flow/calls/${sessionId}/events/${index}/audio`,
    { headers: token ? { Authorization: `Bearer ${token}` } : {} },
  );
  if (!response.ok) {
    let message = `Voice failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: { message?: string } };
      message = payload.error?.message || message;
    } catch {
      // Not JSON; keep the status line.
    }
    throw new ApiError(message, response.status);
  }
  return response.blob();
}
