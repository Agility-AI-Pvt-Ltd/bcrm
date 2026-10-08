import { apiFetch } from "./api";

/**
 * Attribution: who registered this buyer first, and can the visit be proved.
 *
 * A channel partner's commission rests on two facts holding up months later — an
 * earlier registration than the next broker's, and evidence that they are the one who
 * walked the buyer round the site. Both are decided on timestamps, so both are
 * recorded by the server and locked into a per-agency hash chain. Nothing here can
 * set a time: that is the point.
 */

export type RegistrationStatus =
  | "active"
  | "contested"
  | "expired"
  | "converted"
  | "released";

export type Registration = {
  id: string;
  /** Quotable down a phone: "NHR-2026-00017". */
  registration_no: string;
  customer_phone: string;
  customer_name: string | null;
  project_name: string;
  developer_name: string | null;
  agent_user_id: string | null;
  property_id: string | null;
  source: string | null;
  registered_at: string;
  valid_until: string | null;
  status: RegistrationStatus | string;
  /** When someone got there first, the claim that beat this one. */
  conflicts_with_id: string | null;
  status_note: string | null;
  notes: string | null;
  chain_index: number;
  content_hash: string;
  chain_hash: string;
  evidence: Record<string, unknown>;
  /** "62 days left" / "Expired 3 days ago". */
  expiry_label: string;
  days_left: number | null;
};

export type RegistrationList = {
  items: Registration[];
  total: number;
  counts: Record<string, number>;
};

export type ChainReport = {
  checked: number;
  intact: boolean;
  breaks: Array<{ chain_index: number; registration_no: string; reason: string }>;
};

export type VisitProof = {
  grade: "strong" | "partial" | "weak" | "none" | string;
  /** The argument behind the grade — what a developer actually reads. */
  reasons: string[];
  gaps: string[];
  checked_in_at: string | null;
  check_in_source: string | null;
  metres_from_pin: number | null;
  minutes_from_slot: number | null;
  customer_words: string;
};

export type DossierVisit = {
  visit_id: string;
  status: string;
  scheduled_at: string | null;
  property_title: string | null;
  property_location: string | null;
  proof: VisitProof;
  proof_label: string;
};

export type Dossier = {
  phone: string;
  generated_at: string;
  registration: Record<string, string | number | null> | null;
  claims: Array<Record<string, string | number | null>>;
  first_contact: {
    at: string | null;
    channel: string | null;
    text: string | null;
    provider_message_id: string | null;
  } | null;
  visits: DossierVisit[];
  strongest_visit_proof: string;
  chain: ChainReport;
  /** What cannot be shown. Named rather than quietly omitted. */
  gaps: string[];
  summary: string;
};

export type AttributionSettings = {
  valid_days: number;
  number_prefix: string | null;
  block_duplicate_claims: boolean;
  expiry_warning_days: number;
};

export type RegisterLeadBody = {
  customer_phone: string;
  project_name: string;
  customer_name?: string | null;
  developer_name?: string | null;
  property_id?: string | null;
  source?: string | null;
  notes?: string | null;
};

const BASE = "/api/v1/attribution";

export const registerLead = (body: RegisterLeadBody) =>
  apiFetch<Registration>(`${BASE}/registrations`, {
    method: "POST",
    body: JSON.stringify(body),
  });

export const listRegistrations = (params: {
  status?: string;
  mine?: boolean;
  limit?: number;
  offset?: number;
} = {}) => {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.mine) query.set("mine", "true");
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  return apiFetch<RegistrationList>(`${BASE}/registrations?${query}`);
};

export const closeRegistration = (
  id: string,
  status: "converted" | "released",
  note?: string,
) =>
  apiFetch<Registration>(`${BASE}/registrations/${id}/close`, {
    method: "POST",
    body: JSON.stringify({ status, note: note || null }),
  });

export const verifyChain = () => apiFetch<ChainReport>(`${BASE}/verify`);

export const getDossier = (phone: string) =>
  apiFetch<Dossier>(`${BASE}/dossier?phone=${encodeURIComponent(phone)}`);

export const getAttributionSettings = () =>
  apiFetch<AttributionSettings>(`${BASE}/settings`);

export const saveAttributionSettings = (body: Partial<AttributionSettings>) =>
  apiFetch<AttributionSettings>(`${BASE}/settings`, {
    method: "PUT",
    body: JSON.stringify(body),
  });

export const STATUS_LABELS: Record<string, string> = {
  active: "Live claim",
  contested: "Someone registered first",
  expired: "Lapsed",
  converted: "Converted",
  released: "Released",
};

export const STATUS_CHIP: Record<string, string> = {
  active: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  contested: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  expired: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
  converted: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  released: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
};

export const PROOF_CHIP: Record<string, string> = {
  strong: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  partial: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  weak: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  none: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
};

/** A claim worth chasing before it lapses. */
export function isExpiringSoon(row: Registration, warnDays = 7): boolean {
  return (
    row.status === "active" && row.days_left !== null && row.days_left <= warnDays
  );
}

export function formatStamp(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDay(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** The first eight characters are enough to compare two hashes by eye. */
export function shortHash(hash: string | null | undefined): string {
  return (hash || "").slice(0, 8);
}
