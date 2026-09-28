import { apiFetch } from "@/lib/api";
import type { PropertyImportColumn } from "@/lib/properties";

export type SheetSyncStatus = "pending" | "syncing" | "ok" | "error";

/** Who wins when a sheet row names a listing that already exists by hand. */
export type ManualConflictPolicy = "keep_manual" | "take_sheet";

/** A sheet row held back because a hand-entered listing owns its identity. */
export type SheetConflict = {
  title: string;
  location: string;
  property_id: string;
};

export type SheetWorksheet = {
  index: number;
  title: string;
  gid: string;
  row_count: number | null;
};

export type SheetConnection = {
  id: string;
  organization_id: string;
  name: string;
  spreadsheet_url: string;
  spreadsheet_id: string;
  worksheet_tabs: string[];
  all_worksheets: boolean;
  column_mapping: Record<string, string | null>;
  sync_enabled: boolean;
  sync_interval_minutes: number;
  manual_conflict_policy: ManualConflictPolicy | string;
  next_sync_at: string | null;
  last_sync_at: string | null;
  sync_status: SheetSyncStatus | string;
  last_error: string | null;
  last_row_count: number;
  last_created: number;
  last_updated: number;
  last_removed: number;
  last_duplicates: number;
  last_skipped: number;
  last_adopted: number;
  last_blocked: number;
  last_conflicts: SheetConflict[];
  property_count: number;
  created_at: string;
  updated_at: string;
};

export type SheetAnalyze = {
  spreadsheet_url: string;
  spreadsheet_id: string;
  worksheets: string[];
  source_rows: number;
  source_columns: number;
  columns: PropertyImportColumn[];
  allowed_fields: string[];
  column_mapping: Record<string, string | null>;
  sample_rows: Array<Record<string, unknown>>;
  preview: Array<Record<string, unknown>>;
  preview_skipped: number;
  unmapped_columns: string[];
  ready: boolean;
  llm: {
    used: boolean;
    provider?: string | null;
    reason?: string;
    suggestions?: number;
    sample_rows?: number;
  };
};

export type SheetSyncResult = {
  connection_id: string;
  rows?: number;
  created?: number;
  updated?: number;
  removed?: number;
  duplicates?: number;
  skipped?: number;
  adopted?: number;
  blocked?: number;
  conflicts?: SheetConflict[];
  total?: number;
  worksheets?: string[];
  synced_at?: string;
  error?: string;
};

/**
 * The deployment's Google service account. One account platform-wide: customers
 * share their spreadsheet with `client_email` rather than supplying a key.
 */
export type GoogleCredentialStatus = {
  configured: boolean;
  /** The address to share spreadsheets with. */
  client_email: string | null;
  project_id: string | null;
  source: "env" | "file" | "none" | string;
  /** null unless a verify was requested. */
  verified: boolean | null;
  error: string | null;
};

export type SheetAccessCheck = {
  readable: boolean;
  /** How it was read — "private" means properly shared with the account. */
  access: "private" | "public" | "none" | string;
  worksheets: SheetWorksheet[];
  share_with: string | null;
  error: string | null;
};

export async function getGoogleCredential(verify = false) {
  return apiFetch<GoogleCredentialStatus>(
    `/api/v1/properties/sheets/credentials${verify ? "?verify=true" : ""}`,
  );
}

export async function testGoogleCredential() {
  return apiFetch<GoogleCredentialStatus>(
    "/api/v1/properties/sheets/credentials/test",
    { method: "POST" },
  );
}

export async function checkSheetAccess(spreadsheetUrl: string) {
  return apiFetch<SheetAccessCheck>("/api/v1/properties/sheets/check-access", {
    method: "POST",
    body: JSON.stringify({ spreadsheet_url: spreadsheetUrl }),
  });
}

export async function listSheetConnections() {
  return apiFetch<SheetConnection[]>("/api/v1/properties/sheets");
}

export async function listSheetWorksheets(spreadsheetUrl: string) {
  return apiFetch<{ worksheets: SheetWorksheet[] }>(
    "/api/v1/properties/sheets/worksheets",
    { method: "POST", body: JSON.stringify({ spreadsheet_url: spreadsheetUrl }) },
  );
}

export async function analyzeSheet(input: {
  spreadsheet_url: string;
  worksheet_tabs?: string[];
  all_worksheets?: boolean;
}) {
  return apiFetch<SheetAnalyze>("/api/v1/properties/sheets/analyze", {
    method: "POST",
    body: JSON.stringify({
      spreadsheet_url: input.spreadsheet_url,
      worksheet_tabs: input.worksheet_tabs ?? [],
      all_worksheets: input.all_worksheets ?? false,
    }),
  });
}

export async function createSheetConnection(input: {
  name?: string;
  spreadsheet_url: string;
  worksheet_tabs?: string[];
  all_worksheets?: boolean;
  column_mapping?: Record<string, string | null>;
  sync_enabled?: boolean;
  sync_interval_minutes?: number;
  manual_conflict_policy?: ManualConflictPolicy;
  sync_now?: boolean;
}) {
  return apiFetch<{ connection: SheetConnection; sync: SheetSyncResult | null }>(
    "/api/v1/properties/sheets",
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name ?? "",
        spreadsheet_url: input.spreadsheet_url,
        worksheet_tabs: input.worksheet_tabs ?? [],
        all_worksheets: input.all_worksheets ?? false,
        column_mapping: input.column_mapping ?? null,
        sync_enabled: input.sync_enabled ?? true,
        sync_interval_minutes: input.sync_interval_minutes ?? 5,
        manual_conflict_policy: input.manual_conflict_policy ?? "keep_manual",
        sync_now: input.sync_now ?? true,
      }),
    },
  );
}

export async function updateSheetConnection(
  id: string,
  patch: Partial<
    Pick<
      SheetConnection,
      "name" | "sync_enabled" | "sync_interval_minutes" | "all_worksheets"
    > & {
      worksheet_tabs: string[];
      column_mapping: Record<string, string | null>;
      manual_conflict_policy: ManualConflictPolicy;
    }
  >,
) {
  return apiFetch<SheetConnection>(`/api/v1/properties/sheets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function syncSheetConnection(id: string) {
  return apiFetch<{ sync: SheetSyncResult; connection: SheetConnection }>(
    `/api/v1/properties/sheets/${id}/sync`,
    { method: "POST" },
  );
}

/**
 * Hand blocked listings to the sheet and re-sync. One-off: this does not change
 * the connection's standing policy. Omit propertyIds to resolve all reported.
 */
export async function resolveSheetConflicts(id: string, propertyIds?: string[]) {
  return apiFetch<{ resolved: number; sync: SheetSyncResult | null }>(
    `/api/v1/properties/sheets/${id}/resolve-conflicts`,
    {
      method: "POST",
      body: JSON.stringify({ property_ids: propertyIds ?? null }),
    },
  );
}

export async function deleteSheetConnection(id: string, deleteProperties = false) {
  return apiFetch<null>(
    `/api/v1/properties/sheets/${id}?delete_properties=${deleteProperties}`,
    { method: "DELETE" },
  );
}

export function sheetStatusTone(
  status: string,
): "success" | "warning" | "error" | "dark" {
  if (status === "ok") return "success";
  if (status === "syncing" || status === "pending") return "warning";
  if (status === "error") return "error";
  return "dark";
}

/** "in 3 min" / "2 min ago" — the sync cadence only matters in relative terms. */
export function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const deltaSec = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(deltaSec);
  if (abs < 45) return deltaSec >= 0 ? "in a moment" : "just now";
  const mins = Math.round(abs / 60);
  if (mins < 60) return deltaSec >= 0 ? `in ${mins} min` : `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return deltaSec >= 0 ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return deltaSec >= 0 ? `in ${days} d` : `${days} d ago`;
}
