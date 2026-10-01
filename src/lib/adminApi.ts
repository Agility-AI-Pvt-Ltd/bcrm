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

export type QueueCounts = { pending: number; active: number; rejected: number };

export type AccountFilter = "pending" | "active" | "rejected" | "all";

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
  decision: "approve" | "reject" | "revoke",
  note?: string,
): Promise<AccountReview> {
  return adminFetch<AccountReview>(`/api/v1/admin/accounts/${userId}/${decision}`, {
    method: "POST",
    body: JSON.stringify({ note: note?.trim() || null }),
  });
}
