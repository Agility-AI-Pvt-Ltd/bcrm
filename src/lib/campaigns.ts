/**
 * The campaign studio's API client.
 *
 * Every value on `/campaigns` used to be a literal in the component: 1,284
 * contacts, 12 active campaigns, an 18.6% reply rate and three invented rows of
 * "recent campaigns". Nothing here returns a number the backend did not count.
 */

import { apiFetch } from "@/lib/api";

export type Tone = "Professional" | "Friendly" | "Luxury" | "Urgent";
export type Channel = "WhatsApp" | "SMS" | "Email";

/** The only channel wired to a sender. The rest can be drafted, not launched. */
export const SENDABLE_CHANNELS: Channel[] = ["WhatsApp"];

export type CampaignStats = {
  total_contacts: number;
  active_campaigns: number;
  messages_sent: number;
  replies: number;
  /** null — not 0 — when nothing has been sent yet. */
  reply_rate: number | null;
};

export type RecentCampaign = {
  id: string;
  name: string;
  status: string;
  channel: Channel;
  total_recipients: number;
  sent_count: number;
  replied_count: number;
  failed_count: number;
  created_at?: string | null;
  started_at?: string | null;
};

export type Audience = { id: string; name: string; row_count: number };

export type GenerateResult = {
  name: string;
  message: string;
  tone: Tone;
  channel: Channel;
  /** "template" means no model wrote it — say so rather than implying AI. */
  source: "ai" | "template";
  variables: Record<string, string>;
  warnings: string[];
  notes: string;
};

export type LaunchResult = {
  campaign_id: string;
  dataset_id: string;
  name: string;
  status: string;
  queued: number;
  skipped: number;
  skipped_reasons: Record<string, number>;
  cold_capable: boolean;
  message: string;
};

export async function fetchCampaignStats() {
  return apiFetch<CampaignStats>("/api/v1/campaigns/stats");
}

export async function fetchRecentCampaigns(limit = 10) {
  return apiFetch<RecentCampaign[]>(`/api/v1/campaigns?limit=${limit}`);
}

export async function fetchAudiences() {
  return apiFetch<Audience[]>("/api/v1/campaigns/audiences");
}

export async function generateCampaign(body: {
  brief: string;
  tone: Tone;
  channel: Channel;
  name?: string | null;
  dataset_id?: string | null;
  current_message?: string | null;
}) {
  return apiFetch<GenerateResult>("/api/v1/campaigns/generate", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function launchCampaign(body: {
  name: string;
  brief: string;
  message: string;
  tone: Tone;
  channel: Channel;
  dataset_id?: string | null;
  audience?: { contacts: string[]; name?: string | null };
  template_name?: string | null;
  template_language?: string;
}) {
  return apiFetch<LaunchResult>("/api/v1/campaigns/launch", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/**
 * Phone numbers and email addresses out of pasted text.
 *
 * Mirrors `parse_contacts` in `app/modules/campaigns/service.py`. The server's
 * copy is the one that decides who gets messaged; this one only previews the
 * count as the operator types, so a paste can be corrected before it is sent.
 */
export function parseContacts(value: string): string[] {
  const matches =
    value.match(
      /(?:\+?\d[\d\s()-]{7,}\d)|(?:[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi,
    ) ?? [];
  return Array.from(
    new Set(matches.map((contact) => contact.replace(/[()\s-]/g, "").toLowerCase())),
  );
}
