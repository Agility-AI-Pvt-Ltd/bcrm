import { apiFetch } from "./api";

/**
 * WhatsApp replies that failed: the customer got an apology instead, or a send
 * was cut off and may or may not have arrived. Listed so a person can retry or
 * close them; the owner is alerted through the bell when one fails.
 */
export type FailedReply = {
  id: string;
  status: "failed" | "needs_review";
  customer_name: string | null;
  customer_phone: string | null;
  /** What the customer wrote, so the person retrying knows what is unanswered. */
  message_text: string | null;
  conversation_id: string;
  attempts: number;
  /** In plain words, not the raw error. */
  reason: string;
  /**
   * The reply may already be on the customer's phone. WhatsApp cannot confirm
   * whether a cut-off send arrived, so retrying could answer them twice.
   */
  may_have_sent: boolean;
  /** A reply was already generated; a retry resends it without a new AI turn. */
  has_reply_ready: boolean;
  failed_at: string;
  received_at: string;
};

export async function listFailedReplies() {
  return apiFetch<{ items: FailedReply[]; total: number }>("/api/v1/failed-replies");
}

export async function retryFailedReply(id: string, confirmPossibleDuplicate = false) {
  return apiFetch<FailedReply>(`/api/v1/failed-replies/${id}/retry`, {
    method: "POST",
    body: JSON.stringify({ confirm_possible_duplicate: confirmPossibleDuplicate }),
  });
}

export async function markFailedReplyHandled(id: string) {
  return apiFetch<FailedReply>(`/api/v1/failed-replies/${id}/handled`, { method: "POST" });
}
