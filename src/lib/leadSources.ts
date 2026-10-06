import { apiFetch } from "./api";

/**
 * Lead sources: property portals (99acres) push enquiries to a per-agency
 * webhook URL, and each new lead gets the WhatsApp follow-up automatically once
 * the agency's template is approved.
 */

export type LeadSourceKey = "99acres";

export type FollowupTemplate = {
  name: string;
  id: string | null;
  /** null = not started; DRAFT, PENDING, APPROVED, REJECTED, SUBMIT_FAILED… */
  status: string | null;
  rejection_reason: string | null;
  body: string | null;
  catalog_id: string | null;
};

export type LeadSource = {
  source: LeadSourceKey;
  connected: boolean;
  is_active: boolean;
  auto_send: boolean;
  webhook_url: string | null;
  last_received_at: string | null;
  /** By WhatsApp status, plus `total`. */
  counts: Record<string, number>;
  template: FollowupTemplate;
};

export type PortalLead = {
  id: string;
  source: string;
  name: string | null;
  phone: string;
  email: string | null;
  property_name: string | null;
  property_id: string | null;
  city: string | null;
  locality: string | null;
  budget: string | null;
  message: string | null;
  received_at: string | null;
  created_at: string | null;
  contact_id: string | null;
  lead_id: string | null;
  conversation_id: string | null;
  whatsapp_status: "pending" | "waiting_for_template" | "sent" | "failed" | "skipped" | string;
  whatsapp_reason: string | null;
  whatsapp_sent_at: string | null;
};

const base = (source: LeadSourceKey) => `/api/v1/lead-sources/${source}`;

export const getLeadSource = (source: LeadSourceKey) => apiFetch<LeadSource>(base(source));

export const connectLeadSource = (source: LeadSourceKey) =>
  apiFetch<LeadSource>(`${base(source)}/connect`, { method: "POST" });

export const rotateLeadSource = (source: LeadSourceKey) =>
  apiFetch<LeadSource>(`${base(source)}/rotate`, { method: "POST" });

export const updateLeadSource = (
  source: LeadSourceKey,
  payload: { is_active?: boolean; auto_send?: boolean },
) =>
  apiFetch<LeadSource>(base(source), { method: "PATCH", body: JSON.stringify(payload) });

export const listPortalLeads = (source: LeadSourceKey, limit = 50) =>
  apiFetch<PortalLead[]>(`${base(source)}/leads?limit=${limit}`);

export const sendPortalFollowup = (source: LeadSourceKey, leadId: string) =>
  apiFetch<PortalLead>(`${base(source)}/leads/${encodeURIComponent(leadId)}/send`, {
    method: "POST",
  });

export const sendWaitingFollowups = (source: LeadSourceKey) =>
  apiFetch<Record<string, number>>(`${base(source)}/send-waiting`, { method: "POST" });

/** Submit (or resubmit) this agency's follow-up template to WhatsApp for approval. */
export async function submitFollowupTemplate(template: FollowupTemplate) {
  if (!template.id) {
    if (!template.catalog_id) throw new Error("The 99acres template is not set up on this server.");
    return apiFetch(`/api/v1/whatsapp/templates/catalog/${template.catalog_id}/submit`, {
      method: "POST",
    });
  }
  const action = template.status === "REJECTED" ? "resubmit" : "submit";
  return apiFetch(`/api/v1/whatsapp/templates/${template.id}/${action}`, { method: "POST" });
}

/** Ask Meta for the latest template verdicts (for a missed webhook). */
export const syncTemplates = () =>
  apiFetch("/api/v1/whatsapp/templates/sync", { method: "POST" });

export const WHATSAPP_STATUS: Record<string, { label: string; className: string }> = {
  sent: { label: "WhatsApp sent", className: "border-success-200 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400" },
  waiting_for_template: { label: "Waiting for template approval", className: "border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/40 dark:bg-warning-500/10 dark:text-warning-400" },
  pending: { label: "Sending…", className: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300" },
  failed: { label: "WhatsApp failed", className: "border-error-200 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400" },
  skipped: { label: "Not sent", className: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300" },
};

export const TEMPLATE_STATUS: Record<string, { label: string; tone: string }> = {
  APPROVED: { label: "Approved — sending automatically", tone: "text-success-600" },
  PENDING: { label: "Waiting for WhatsApp approval", tone: "text-warning-600" },
  DRAFT: { label: "Draft — not submitted yet", tone: "text-gray-600" },
  REJECTED: { label: "Rejected by WhatsApp", tone: "text-error-600" },
  SUBMIT_FAILED: { label: "Could not reach WhatsApp — try again", tone: "text-error-600" },
  PAUSED: { label: "Paused by WhatsApp", tone: "text-warning-600" },
  DISABLED: { label: "Disabled by WhatsApp", tone: "text-error-600" },
};
