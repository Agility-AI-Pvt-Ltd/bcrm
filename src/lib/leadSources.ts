import { apiFetch } from "@/lib/api";

/** One lead source's light: red when broken, amber when quiet, green when leads arrive. */
export type LeadSource = {
  key: string;
  label: string;
  light: "green" | "amber" | "red" | "grey";
  last_lead_at: string | null;
  leads_7d: number;
  /** "last lead 12 min ago", or what is wrong and what to do. */
  note: string;
  /** Where to fix a broken connection. */
  fix_href: string | null;
};

export function getLeadSources() {
  return apiFetch<LeadSource[]>("/api/v1/leads/sources/status");
}

export type DeletedRecord = { id: string; name: string; phone: string | null; deleted_at?: string | null; updated_at?: string };

export function getDeletedContacts() {
  return apiFetch<DeletedRecord[]>("/api/v1/contacts/deleted");
}

export function getDeletedLeads() {
  return apiFetch<DeletedRecord[]>("/api/v1/leads/deleted");
}

export function restoreRecord(kind: "contacts" | "leads", id: string) {
  return apiFetch<DeletedRecord>(`/api/v1/${kind}/${encodeURIComponent(id)}/restore`, { method: "POST" });
}
