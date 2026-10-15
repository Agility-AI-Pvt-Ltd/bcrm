import { apiFetch } from "@/lib/api";
import type { AccountSpendDetail } from "@/lib/adminApi";

export type { AccountSpend, AccountSpendDetail, SpendEntry, SpendLine } from "@/lib/adminApi";
export { quantity, rupees } from "@/lib/adminApi";

/** This agency's own costs. Scoped by the signed-in user's organisation on the
 *  server, so there is nothing to pass and nothing to get wrong. */
export async function getMySpend(days = 30, limit = 50): Promise<AccountSpendDetail> {
  return apiFetch<AccountSpendDetail>(`/api/v1/billing/summary?days=${days}&limit=${limit}`);
}

/** Labels for the detail rows. A kind with no entry shows as itself rather than
 *  as a friendly name that hides which provider was billed. */
export function kindLabel(kind: string): string {
  return (
    {
      call: "AI calls",
      llm: "AI text",
      whatsapp: "WhatsApp",
      storage: "Storage",
    }[kind] || kind
  );
}

export function kindTone(kind: string): "success" | "warning" | "error" | "info" | "dark" {
  return (
    ({ call: "info", llm: "warning", whatsapp: "success", storage: "dark" } as const)[
      kind as "call" | "llm" | "whatsapp" | "storage"
    ] || "dark"
  );
}
