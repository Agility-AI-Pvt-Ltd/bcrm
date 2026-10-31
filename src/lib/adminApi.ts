/**
 * The platform operator's API client. Deliberately separate from `apiFetch`.
 *
 * `apiFetch` attaches the agent's session token and an `X-Organization-Id`
 * header, because every call it makes is a call inside one tenant. An admin call
 * is the opposite: it belongs to no organisation and carries a different
 * credential, issued from a different table with a `purpose` claim the tenant
 * API refuses.
 *
 * Keeping the two clients apart is what keeps the two tokens apart. Sharing one
 * client and "just" swapping the header would mean one forgotten branch sends an
 * operator's credential to a tenant route, or an agent's token to the panel that
 * approves accounts — and the storage keys are separate for the same reason, so
 * signing into one never ends the other's session.
 */

import { API_BASE_URL, ApiError } from "@/lib/api";

const ADMIN_TOKEN_KEY = "bcrm.admin.access_token";
const ADMIN_KEY = "bcrm.admin.account";
const ADMIN_EXPIRY_KEY = "bcrm.admin.expires_at";

export type AdminAccount = {
  id: string;
  email: string;
  name: string;
  last_login_at?: string | null;
};

export type PendingPayment = {
  reference: string;
  method: string;
  note?: string | null;
};

export type AccountReview = {
  user_id: string;
  email: string;
  full_name: string;
  phone?: string | null;
  organization_id: string;
  organization_name?: string | null;
  signed_up_at: string;
  is_enabled: boolean;
  /** Whether the operator has allowed this account to use the AI callback at
   * all. Separate from the agency's own on/off switch, which only takes effect
   * while this is true. */
  ai_callback_allowed: boolean;
  subscription_id?: string | null;
  plan_code?: string | null;
  plan_name?: string | null;
  plan_price_inr?: number | null;
  status: string;
  payment?: PendingPayment | null;
  requested_at?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  review_note?: string | null;
};

export type AccountReviewPage = {
  items: AccountReview[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
};

export type QueueCounts = {
  pending: number;
  active: number;
  rejected: number;
  revoked: number;
};

export type AccountFilter = "pending" | "active" | "rejected" | "revoked" | "all";

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: { code: string; message: string; details?: unknown } | null;
};

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const expiresAt = Number(window.localStorage.getItem(ADMIN_EXPIRY_KEY) || 0);
    if (expiresAt && Date.now() > expiresAt) {
      clearAdminSession();
      return null;
    }
    return window.localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredAdmin(): AdminAccount | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ADMIN_KEY);
    return raw ? (JSON.parse(raw) as AdminAccount) : null;
  } catch {
    return null;
  }
}

export function clearAdminSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ADMIN_TOKEN_KEY);
    window.localStorage.removeItem(ADMIN_KEY);
    window.localStorage.removeItem(ADMIN_EXPIRY_KEY);
  } catch {
    /* private mode: nothing to clear */
  }
}

async function adminFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAdminToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    // An expired or revoked admin token should end the session here rather than
    // leave the panel showing a stale queue it can no longer act on.
    if (response.status === 401) clearAdminSession();
    throw new ApiError(
      payload?.error?.message || `Request failed (${response.status})`,
      response.status,
      payload?.error?.code,
      payload?.error?.details,
    );
  }
  return payload?.data as T;
}

export async function adminLogin(email: string, password: string): Promise<AdminAccount> {
  const result = await adminFetch<{
    access_token: string;
    expires_in: number;
    admin: AdminAccount;
  }>("/api/v1/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  try {
    window.localStorage.setItem(ADMIN_TOKEN_KEY, result.access_token);
    window.localStorage.setItem(ADMIN_KEY, JSON.stringify(result.admin));
    window.localStorage.setItem(
      ADMIN_EXPIRY_KEY,
      String(Date.now() + result.expires_in * 1000),
    );
  } catch {
    /* private mode: the session lasts until the tab closes */
  }
  return result.admin;
}

export async function fetchAdminMe(): Promise<AdminAccount> {
  return adminFetch<AdminAccount>("/api/v1/admin/me");
}

export async function fetchQueueCounts(): Promise<QueueCounts> {
  return adminFetch<QueueCounts>("/api/v1/admin/queue-counts");
}

export async function listAccounts(params: {
  status: AccountFilter;
  search?: string;
  page?: number;
  pageSize?: number;
}): Promise<AccountReviewPage> {
  const query = new URLSearchParams({ status: params.status });
  if (params.search?.trim()) query.set("search", params.search.trim());
  query.set("page", String(params.page || 1));
  query.set("page_size", String(params.pageSize || 25));
  return adminFetch<AccountReviewPage>(`/api/v1/admin/accounts?${query.toString()}`);
}

export async function decideAccount(
  userId: string,
  decision: "approve" | "reject" | "revoke" | "reinstate",
  note?: string,
): Promise<AccountReview> {
  return adminFetch<AccountReview>(`/api/v1/admin/accounts/${userId}/${decision}`, {
    method: "POST",
    body: JSON.stringify({ note: note?.trim() || null }),
  });
}

// --- feature grants ---------------------------------------------------------
//
// What an agency is allowed to use, as opposed to whether they have paid. The
// AI callback is the first: it dials their customers on our telephony account,
// so the operator decides whether they may, and the agency decides whether they
// do. Revoking here leaves the agency's own switch alone; it just stops having
// any effect.

export const FEATURE_AI_CALLBACK = "ai_callback";

export type FeatureGrant = {
  feature: string;
  label: string;
  description: string;
  allowed: boolean;
  note?: string | null;
  decided_at?: string | null;
  decided_by?: string | null;
};

export type OrganizationFeatureGrants = {
  organization_id: string;
  items: FeatureGrant[];
};

export async function fetchAccountFeatures(
  userId: string,
): Promise<OrganizationFeatureGrants> {
  return adminFetch<OrganizationFeatureGrants>(
    `/api/v1/admin/accounts/${userId}/features`,
  );
}

export async function setAccountFeature(
  userId: string,
  feature: string,
  allowed: boolean,
  note?: string,
): Promise<OrganizationFeatureGrants> {
  return adminFetch<OrganizationFeatureGrants>(
    `/api/v1/admin/accounts/${userId}/features/${feature}`,
    {
      method: "PUT",
      body: JSON.stringify({ allowed, note: note?.trim() || null }),
    },
  );
}

// --- what each account costs us to serve ------------------------------------

export type SpendLine = {
  kind: string;
  label: string;
  unit: string;
  unit_label: string;
  /** Decimal as a string. Parsing it to a float loses the last places of a
   *  per-token rate, and these numbers get compared against provider invoices. */
  quantity: string;
  amount: string;
  unpriced_quantity: string;
  events: number;
};

export type SpendEntry = {
  kind: string;
  key: string;
  unit: string;
  quantity: string;
  unit_rate: string | null;
  amount: string | null;
  occurred_at: string | null;
  source: string | null;
  reference_id: string | null;
  detail: Record<string, unknown>;
};

export type AccountSpend = {
  organization_id: string;
  organization_name: string | null;
  period_start: string;
  period_end: string;
  currency: string;
  total: string;
  lines: SpendLine[];
  customers: number;
  new_customers: number;
  cost_per_customer: string | null;
  /** Some usage happened that nobody had priced. The screens say so next to the
   *  total, so a small number is not read as a small bill. */
  has_unpriced: boolean;
};

export type AccountSpendDetail = AccountSpend & { entries: SpendEntry[] };

export type UsageRate = {
  id: string | null;
  kind: string;
  key: string;
  unit: string;
  unit_label: string;
  /** The group this sits under on the rate screen. */
  kind_label: string;
  /** Where to find this figure on the provider's invoice. */
  help: string | null;
  amount: string | null;
  currency: string;
  effective_from: string | null;
  note: string | null;
  /** False for a unit we know how to meter and nobody has priced yet. */
  configured: boolean;
  /** The window the two usage figures below cover. */
  usage_days: number;
  /** Units metered against this key in that window, across every account. */
  usage_quantity: string;
  /** What that came to. Null when the unit is unpriced — the usage is real and
   * the money is unknown, which is not the same as nothing. */
  usage_amount: string | null;
};

/**
 * One price a model proposed.
 *
 * Not a price until an operator applies it. These come from what the model was
 * trained on rather than from an invoice, so each carries the basis it worked
 * from and the screen says plainly that they are estimates.
 */
export type RateSuggestion = {
  kind: string;
  key: string;
  unit: string;
  amount: string;
  basis: string;
};

export type RateSuggestions = {
  items: RateSuggestion[];
  /** How many units were asked about — usually more than came back. */
  asked: number;
  notice: string;
  /** False when no model is configured, so an empty answer can be explained. */
  available: boolean;
};

export async function listAccountSpend(days = 30): Promise<AccountSpend[]> {
  return adminFetch<AccountSpend[]>(`/api/v1/admin/spend?days=${days}`);
}

export async function getAccountSpend(
  organizationId: string,
  days = 30,
): Promise<AccountSpendDetail> {
  return adminFetch<AccountSpendDetail>(
    `/api/v1/admin/spend/${organizationId}?days=${days}&limit=200`,
  );
}

export async function listUsageRates(usageDays = 30): Promise<UsageRate[]> {
  return adminFetch<UsageRate[]>(`/api/v1/admin/rates?usage_days=${usageDays}`);
}

/**
 * Ask the model to price the card. Writes nothing — what comes back fills the
 * boxes, and the operator applies it.
 */
export async function suggestUsageRates(): Promise<RateSuggestions> {
  return adminFetch<RateSuggestions>("/api/v1/admin/rates/suggest", {
    method: "POST",
  });
}

export async function setUsageRate(input: {
  kind: string;
  key: string;
  unit: string;
  amount: string | null;
  effective_from?: string;
  note?: string;
}): Promise<UsageRate> {
  return adminFetch<UsageRate>("/api/v1/admin/rates", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

/** Rupees, from a decimal string. Returns a dash for an unpriced value, never ₹0 —
 *  showing zero would claim we know it was free. */
export function rupees(value: string | null | undefined, places = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  })}`;
}

/** A quantity, trimmed of the trailing zeros a six-place decimal carries. */
export function quantity(value: string | null | undefined): string {
  if (!value) return "0";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return String(value);
  return amount.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

// --- developers ----------------------------------------------------------------
//
// Who may open an agent's account with an emailed code (sent through Brevo), and
// which accounts. Only an operator can change this list.

export type DeveloperAccount = {
  user_id: string;
  email: string;
  name: string;
  organization_id?: string | null;
  organization_name?: string | null;
  granted_at?: string | null;
};

export type DeveloperAccessEvent = {
  event: string;
  account_email: string;
  organization_name?: string | null;
  ip_address?: string | null;
  detail?: string | null;
  at: string;
};

export type Developer = {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  all_accounts: boolean;
  last_login_at?: string | null;
  created_at?: string | null;
  accounts: DeveloperAccount[];
  recent: DeveloperAccessEvent[];
};

export async function listDevelopers(): Promise<Developer[]> {
  return adminFetch<Developer[]>("/api/v1/admin/developers");
}

export async function createDeveloper(input: {
  email: string;
  name?: string;
  all_accounts?: boolean;
  account_emails?: string[];
}): Promise<Developer> {
  return adminFetch<Developer>("/api/v1/admin/developers", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateDeveloper(
  developerId: string,
  input: { name?: string; is_active?: boolean; all_accounts?: boolean },
): Promise<Developer> {
  return adminFetch<Developer>(`/api/v1/admin/developers/${encodeURIComponent(developerId)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function grantDeveloperAccount(
  developerId: string,
  accountEmail: string,
): Promise<Developer> {
  return adminFetch<Developer>(
    `/api/v1/admin/developers/${encodeURIComponent(developerId)}/accounts`,
    { method: "POST", body: JSON.stringify({ account_email: accountEmail }) },
  );
}

export async function revokeDeveloperAccount(
  developerId: string,
  userId: string,
): Promise<Developer> {
  return adminFetch<Developer>(
    `/api/v1/admin/developers/${encodeURIComponent(developerId)}/accounts/${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
}
