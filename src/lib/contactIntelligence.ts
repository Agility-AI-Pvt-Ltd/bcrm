import { apiFetch } from "@/lib/api";

export type StoredContact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string;
  tag: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type AvailableColumn = {
  name: string;
  dtype?: string | null;
  null_percentage?: number | null;
  unique_count?: number | null;
  field?: string | null;
  confidence?: number | null;
  status?: string | null;
  reason?: string | null;
  suggested?: boolean;
};

export type ContactIntelligencePlan = {
  source_rows: number;
  source_columns: number;
  duplicate_contacts: number;
  importable_count: number;
  valid_phone_numbers: number;
  valid_emails: number;
  lead_fields_detected: number;
  ready_to_import: boolean;
  available_columns?: AvailableColumn[];
  preview_contacts: Array<{
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    source?: string | null;
    notes?: string | null;
  }>;
  segments?: Array<{ name: string; count: number }>;
  needs_user_decisions?: Array<{ column: string; field?: string | null }>;
  accepted_mappings?: Array<{ column: string; field?: string | null; confidence?: number }>;
};

export type ContactIntelligenceResult = {
  status: string;
  inferred_mapping?: Record<
    string,
    { column: string; field?: string | null; confidence?: number; status?: string }
  >;
  import_plan: ContactIntelligencePlan;
  imported_count?: number;
  privacy?: {
    mode: string;
    spreadsheet_sent_to_llm: boolean;
    allow_raw_spreadsheet_to_llm: boolean;
    llm_used?: boolean;
    llm_provider?: string | null;
    llm_reason?: string | null;
  };
};

export type ContactStats = {
  total: number;
  with_phone: number;
  with_email: number;
  google_sheets_connected: boolean;
};

export type PageResult<T> = {
  items: T[];
  total: number;
  page: number;
  page_size: number;
};

export type ContactDatasetSummary = {
  id: string;
  name: string;
  slug: string;
  source_file: string | null;
  source_type: string;
  selected_columns: string[];
  row_count: number;
  created_at: string;
  duplicate_count?: number;
  has_duplicates?: boolean;
};

export type DatasetDuplicateSample = {
  key: string;
  count: number;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
};

export type DatasetDuplicateReportItem = {
  dataset_id: string;
  name: string;
  row_count: number;
  duplicate_count: number;
  unique_identity_count: number;
  has_duplicates: boolean;
  identity_columns: Record<string, string | null>;
  samples: DatasetDuplicateSample[];
};

export type DatasetDuplicateReport = {
  total_duplicate_rows: number;
  tables_with_duplicates: number;
  items: DatasetDuplicateReportItem[];
};

export type ContactDataset = ContactDatasetSummary & {
  source_columns: string[];
  notes: string | null;
  updated_at: string;
  rows: Array<{
    id: string;
    row_index: number;
    data: Record<string, string>;
  }>;
};

export type ColumnMappingSuggestion = {
  source_column: string;
  target_column: string | null;
  confidence: number;
  status: "mapped" | "unmapped";
};

export type MatchingDatasetPreview = {
  id: string;
  name: string;
  slug: string;
  selected_columns: string[];
  row_count: number;
  overlap_score: number;
  mappings: ColumnMappingSuggestion[];
  unmappable_source_columns: string[];
  unmappable_target_columns: string[];
};

export type DatasetMergePreview = {
  has_matches: boolean;
  matches: MatchingDatasetPreview[];
  identity_columns: Record<string, string | null>;
  message: string;
};

export type DuplicateWarning = {
  has_duplicates: boolean;
  duplicate_count: number;
  duplicates_against_existing: Array<Record<string, unknown>>;
  duplicates_within_import: Array<Record<string, unknown>>;
  warning: string | null;
  contacts_skipped_as_duplicates: number;
};

export type ContactDatasetWriteResult = {
  action: "created" | "merged";
  dataset: ContactDataset;
  columns_added: string[];
  unmapped_columns_skipped: string[];
  rows_added: number;
  also_imported_to_contacts: boolean;
  contacts_created: number;
  duplicates: DuplicateWarning;
};

export type DropDuplicatesResult = {
  dataset: ContactDataset;
  rows_removed: number;
  rows_remaining: number;
  message: string;
};

export async function analyzeContacts(payload: {
  raw_csv?: string;
  rows?: Record<string, string>[];
  google_sheet_url?: string;
  worksheet_tab?: string;
  worksheet_tabs?: string[];
  all_worksheets?: boolean;
  contact_column?: string;
  file_name?: string;
  user_decisions?: Record<string, string>;
  auto_import?: boolean;
}) {
  return apiFetch<ContactIntelligenceResult>(
    "/api/v1/agents/contact-intelligence/analyze",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export type GoogleWorksheetInfo = {
  index: number;
  title: string;
  gid: string;
  row_count?: number | null;
};

export type GoogleSheetInspectResult = {
  spreadsheet_url: string;
  spreadsheet_id: string;
  worksheets: GoogleWorksheetInfo[];
  mode: string;
  message: string;
};

export async function inspectGoogleSheet(spreadsheetUrl: string) {
  return apiFetch<GoogleSheetInspectResult>("/api/v1/imports/google-sheets/inspect", {
    method: "POST",
    body: JSON.stringify({ spreadsheet_url: spreadsheetUrl }),
  });
}

export async function previewDatasetMerge(payload: {
  selected_columns: string[];
  name?: string;
}) {
  return apiFetch<DatasetMergePreview>("/api/v1/contacts/datasets/preview-merge", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createContactDataset(payload: {
  name?: string;
  selected_columns: string[];
  raw_csv?: string;
  rows?: Record<string, string>[];
  google_sheet_url?: string;
  worksheet_tab?: string;
  worksheet_tabs?: string[];
  all_worksheets?: boolean;
  contact_column?: string;
  file_name?: string;
  notes?: string;
  merge_mode?: "create_new" | "merge";
  target_dataset_id?: string;
  column_mapping?: Record<string, string | null>;
  add_unmapped_columns?: boolean;
  also_import_to_contacts?: boolean;
}) {
  return apiFetch<ContactDatasetWriteResult>("/api/v1/contacts/datasets", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function listContactDatasets() {
  return apiFetch<ContactDatasetSummary[]>("/api/v1/contacts/datasets");
}

export async function getDatasetDuplicateReport() {
  return apiFetch<DatasetDuplicateReport>("/api/v1/contacts/datasets/duplicate-report");
}

export async function getContactDataset(datasetId: string) {
  return apiFetch<ContactDataset>(`/api/v1/contacts/datasets/${datasetId}`);
}

export async function dropDatasetDuplicates(datasetId: string) {
  return apiFetch<DropDuplicatesResult>(
    `/api/v1/contacts/datasets/${datasetId}/drop-duplicates`,
    { method: "POST" },
  );
}

export async function listContacts(page = 1, pageSize = 50) {
  return apiFetch<PageResult<StoredContact>>(
    `/api/v1/contacts?page=${page}&page_size=${pageSize}`,
  );
}

export async function getContactStats() {
  return apiFetch<ContactStats>("/api/v1/contacts/stats");
}

export type ContactsAssistantChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ContactsAssistantChatResult = {
  answer: string;
  refused: boolean;
  tool_trace: Array<Record<string, unknown>>;
  rules?: {
    agent_id?: string;
    version?: string;
    allowed_operations?: string[];
    forbidden_operations?: string[];
    allowed_tables?: string[];
    memory?: Record<string, unknown>;
  } | null;
  rules_version?: string | null;
  memory_enabled?: boolean;
  memory_hits?: string[];
  session_id?: string | null;
};

export async function chatContactsAssistant(payload: {
  question: string;
  history?: ContactsAssistantChatMessage[];
  session_id?: string;
}) {
  return apiFetch<ContactsAssistantChatResult>("/api/v1/agents/contacts-assistant/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function pasteToCsv(raw: string): string {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return "";

  if (lines[0].toLowerCase().includes("name") || lines[0].includes(",")) {
    return raw;
  }

  const rows = ["Name,Phone,Email"];
  for (const line of lines) {
    if (line.includes("@")) {
      rows.push(`,,${JSON.stringify(line).slice(1, -1)}`);
    } else {
      rows.push(`,${JSON.stringify(line).slice(1, -1)},`);
    }
  }
  return rows.join("\n");
}
