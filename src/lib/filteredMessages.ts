import { apiFetch } from "./api";

/**
 * Messages the inbound filter held back instead of letting the AI answer:
 * another company's auto-reply, an advertisement, an OTP or bank alert, an RBI
 * notice, a reaction. Held, not deleted — release one and the AI answers it and
 * trusts that number from then on.
 */
export type FilteredStatus = "held" | "released" | "dismissed";

export type FilteredMessage = {
  id: string;
  sender_phone: string;
  sender_name: string | null;
  category: "automated" | "promotional" | "official" | "system" | "repeated" | string;
  category_label: string;
  /** The signals that decided it, in words. */
  reason: string;
  text: string | null;
  status: FilteredStatus;
  created_at: string | null;
  reviewed_at: string | null;
};

export type FilteredPage = {
  items: FilteredMessage[];
  total: number;
  /** How many are waiting for review, whatever status was asked for. */
  held: number;
};

const BASE = "/api/v1/filtered-messages";

export const listFilteredMessages = (status: FilteredStatus | "all" = "held", limit = 50) =>
  apiFetch<FilteredPage>(`${BASE}?status=${status}&limit=${limit}`);

export const releaseFilteredMessage = (id: string) =>
  apiFetch<FilteredMessage>(`${BASE}/${id}/release`, { method: "POST" });

export const dismissFilteredMessage = (id: string) =>
  apiFetch<FilteredMessage>(`${BASE}/${id}/dismiss`, { method: "POST" });
