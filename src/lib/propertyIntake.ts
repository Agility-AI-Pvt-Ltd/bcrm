import { apiFetch } from "@/lib/api";

/** One colleague, and whether they may file listings over WhatsApp. */
export type IntakeStaff = {
  user_id: string;
  name: string;
  email: string;
  whatsapp: string | null;
  enabled: boolean;
  /** False when they have no WhatsApp number saved — there would be nothing to
   *  recognise their messages by, so the switch is shown disabled rather than
   *  silently doing nothing. */
  can_enable: boolean;
};

export type IntakeSession = {
  id: string;
  state: string;
  staff_name: string;
  staff_phone: string;
  message_count: number;
  media_count: number;
  photos_stored: number;
  media_failed: number;
  draft_version: number | null;
  draft_status: string | null;
  missing: string[];
  property_id: string | null;
  started_at: string | null;
  last_message_at: string | null;
};

export async function listIntakeStaff(): Promise<IntakeStaff[]> {
  return apiFetch<IntakeStaff[]>("/api/v1/property-intake/staff");
}

export async function setIntakeStaff(userId: string, enabled: boolean): Promise<IntakeStaff> {
  return apiFetch<IntakeStaff>(`/api/v1/property-intake/staff/${userId}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}

export async function listIntakeSessions(limit = 10): Promise<IntakeSession[]> {
  return apiFetch<IntakeSession[]>(`/api/v1/property-intake/sessions?limit=${limit}`);
}

/** What the broker is waiting on, in words rather than a state name. */
export function intakeStateLabel(state: string): string {
  return (
    {
      receiving: "Receiving",
      ready_for_extraction: "Reading it",
      draft_ready: "Waiting for their confirmation",
      needs_input: "Needs more details",
      confirmed: "Publishing",
      published: "Published",
      cancelled: "Discarded",
    }[state] || state
  );
}

export function intakeStateTone(state: string): "success" | "warning" | "error" | "dark" {
  if (state === "published") return "success";
  if (state === "needs_input") return "warning";
  if (state === "cancelled") return "dark";
  return "dark";
}
