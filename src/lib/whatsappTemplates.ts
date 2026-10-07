import { apiFetch } from "./api";

/**
 * WhatsApp templates: what Meta has approved, what it is still reviewing, and what
 * it refused.
 *
 * This matters more here than it looks. Every message EstateFlow sends *first* — the
 * morning digest, the first touch on a portal lead, visit reminders — can only go out
 * on an approved template. Until Meta approves one, that automation is skipped, so the
 * status of a template is really the status of a feature. That is why the required list
 * comes from the server with the feature name and what breaks attached, rather than
 * being a lookup table in the browser that could drift from the code that sends.
 */

/** Meta's statuses, plus the one we add for "never submitted". */
export type TemplateStatus =
  | "APPROVED"
  | "PENDING"
  | "REJECTED"
  | "DRAFT"
  | "PAUSED"
  | "DISABLED"
  | "SUBMIT_FAILED"
  | "NOT_SUBMITTED";

export type RequiredTemplate = {
  name: string;
  language: string;
  /** The feature, as a person would name it. */
  feature: string;
  /** What stops working while this is not approved. */
  blocks: string;
  /** Where that feature is configured. */
  settings_path: string;
  status: TemplateStatus | string;
  approved: boolean;
  pending: boolean;
  rejection_reason: string | null;
  template_id: string | null;
  /** Present when a starter exists, so "not submitted" comes with a button. */
  catalog_template_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
};

export type TemplateSummary = {
  approved: number;
  pending: number;
  rejected: number;
  draft: number;
  other: number;
  total: number;
  /** Required templates that are not approved — what is broken today. */
  blocking: string[];
  whatsapp_connected: boolean;
};

export type OrganizationTemplate = {
  id: string;
  catalog_template_id: string | null;
  meta_template_name: string;
  language: string;
  category: string;
  body: string;
  sample_values: Record<string, string>;
  variable_labels: Record<string, string>;
  status: TemplateStatus | string;
  rejection_reason: string | null;
  meta_template_id: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  synced_at: string | null;
};

export type CatalogTemplate = {
  id: string;
  name: string;
  category: string;
  language: string;
  body: string;
  description: string;
  sample_values: Record<string, string>;
  variable_labels: Record<string, string>;
  is_active: boolean;
  sort_order: number;
  /** What this agency has done with this starter, if anything. */
  submission_status: string | null;
};

export type TemplateSyncResult = { checked: number; changed: number };

const BASE = "/api/v1/whatsapp/templates";

export const getRequiredTemplates = () => apiFetch<RequiredTemplate[]>(`${BASE}/required`);

export const getTemplateSummary = () => apiFetch<TemplateSummary>(`${BASE}/summary`);

export const getMyTemplates = () => apiFetch<OrganizationTemplate[]>(`${BASE}/submissions`);

export const getTemplateCatalog = () => apiFetch<CatalogTemplate[]>(`${BASE}/catalog`);

export const syncTemplates = () =>
  apiFetch<TemplateSyncResult>(`${BASE}/sync`, { method: "POST" });

export const submitStarter = (catalogId: string) =>
  apiFetch<OrganizationTemplate>(`${BASE}/catalog/${catalogId}/submit`, { method: "POST" });

export const submitTemplate = (templateId: string) =>
  apiFetch<OrganizationTemplate>(`${BASE}/${templateId}/submit`, { method: "POST" });

/** "Awaiting Meta review" says what is happening; "PENDING" does not. */
export function statusLabel(status: string): string {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "PENDING":
      return "Awaiting Meta review";
    case "REJECTED":
      return "Rejected by Meta";
    case "DRAFT":
      return "Draft — not sent to Meta";
    case "PAUSED":
      return "Paused by Meta";
    case "DISABLED":
      return "Disabled by Meta";
    case "SUBMIT_FAILED":
      return "Could not be submitted";
    case "NOT_SUBMITTED":
      return "Not submitted yet";
    default:
      return status.toLowerCase().replace(/_/g, " ");
  }
}

export const STATUS_CHIP: Record<string, string> = {
  APPROVED: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  PENDING: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  REJECTED: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  SUBMIT_FAILED: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  PAUSED: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
  DISABLED: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
  DRAFT: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400",
  NOT_SUBMITTED: "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300",
};

export function statusChip(status: string): string {
  return STATUS_CHIP[status] || STATUS_CHIP.NOT_SUBMITTED;
}

/** True when this template can be sent as a business-initiated message today. */
export function isApproved(status: string): boolean {
  return status === "APPROVED";
}

/** True when Meta still has it, so the only useful action is waiting. */
export function isPending(status: string): boolean {
  return status === "PENDING";
}

/** A status the agency can act on: edit and resubmit, or submit for the first time. */
export function needsAction(status: string): boolean {
  return ["REJECTED", "DRAFT", "SUBMIT_FAILED", "NOT_SUBMITTED"].includes(status);
}

export function formatStamp(value: string | null): string {
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
