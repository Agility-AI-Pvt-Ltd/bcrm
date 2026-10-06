import { apiFetch } from "./api";

/**
 * Zoho CRM is the lead source of truth: portals (99acres, MagicBricks,
 * Housing.com, website, Meta ads) feed Zoho, and EstateFlow keeps a synced copy
 * of Zoho's Leads. Tokens never reach the browser; these calls only see status.
 */
export type ZohoSyncRun = {
  id: string;
  kind: "initial" | "incremental" | "manual" | "reconciliation";
  status: "pending" | "syncing" | "completed" | "failed" | "cancelled";
  phase: "mapping" | "records" | "deleted" | "done";
  started_at: string | null;
  completed_at: string | null;
  current_page: number;
  total_fetched: number;
  /** Known only when the sync has reached the end of Zoho's list. */
  total_estimate: number | null;
  processed: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  deleted: number;
  last_error: string | null;
};

export type ZohoStatus = {
  configured: boolean;
  status: "disconnected" | "connecting" | "connected" | "needs_reconnect";
  connected: boolean;
  zoho_org_name: string | null;
  location: string | null;
  connected_at: string | null;
  last_successful_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  leads_synced: number;
  realtime: boolean;
  sync_interval_minutes: number;
  suggested_mappings: number;
  sync: ZohoSyncRun | null;
  warnings: string[];
};

export type ZohoMapping = {
  source_field_name: string;
  source_field_label: string | null;
  target_field_name: string | null;
  mapping_source: "standard" | "llm" | "manual";
  status: "active" | "suggested" | "unmapped" | "ignored";
  confidence: number | null;
  reason: string | null;
  approved_by_user: boolean;
  approved_at: string | null;
};

export type ZohoMappingTarget = { name: string; description: string };

export type ZohoMappingChange = {
  source_field_name: string;
  action: "accept" | "set" | "ignore";
  target_field_name?: string | null;
};

export type ZohoLead = {
  id: string;
  external_lead_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  external_status: string | null;
  owner_name: string | null;
  location: string | null;
  budget: string | null;
  external_created_at: string | null;
  external_updated_at: string | null;
  last_synced_at: string | null;
  is_deleted: boolean;
};

export type ZohoLeadPage = {
  items: ZohoLead[];
  total: number;
  page: number;
  page_size: number;
};

export type ZohoSyncStart = {
  started: boolean;
  reason: string;
  sync: ZohoSyncRun | null;
};

const BASE = "/api/v1/integrations/zoho";

export const getZohoStatus = () => apiFetch<ZohoStatus>(`${BASE}/status`);

/** The Zoho consent page URL; the browser navigates there. */
export const getZohoConnectUrl = () =>
  apiFetch<{ authorize_url: string }>(`${BASE}/connect`);

export const syncZohoNow = () => apiFetch<ZohoSyncStart>(`${BASE}/sync`, { method: "POST" });

export const disconnectZoho = () => apiFetch<ZohoStatus>(`${BASE}/disconnect`, { method: "POST" });

export const getZohoMappings = () =>
  apiFetch<{ mappings: ZohoMapping[]; targets: ZohoMappingTarget[]; standard_fields: string[] }>(
    `${BASE}/mappings`,
  );

export const saveZohoMappings = (changes: ZohoMappingChange[]) =>
  apiFetch<{ mappings: ZohoMapping[]; resync: ZohoSyncStart | null }>(`${BASE}/mappings`, {
    method: "PUT",
    body: JSON.stringify({ changes }),
  });

export const getZohoLeads = (page = 1, pageSize = 25) =>
  apiFetch<ZohoLeadPage>(`${BASE}/leads?page=${page}&page_size=${pageSize}`);

/** CONNECTING / SYNCING / COMPLETED / FAILED, as one label for the card. */
export function zohoPhase(status: ZohoStatus | null): "disconnected" | "connecting" | "syncing" | "completed" | "failed" | "reconnect" {
  if (!status) return "disconnected";
  if (status.status === "needs_reconnect") return "reconnect";
  if (status.status === "connecting") return "connecting";
  if (!status.connected) return "disconnected";
  const run = status.sync;
  if (run && (run.status === "pending" || run.status === "syncing")) return "syncing";
  if (run && run.status === "failed") return "failed";
  return "completed";
}

export function formatWhen(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}
