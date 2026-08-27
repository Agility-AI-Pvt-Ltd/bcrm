import { apiFetch, ApiError, ORG_KEY, TOKEN_KEY, USER_KEY } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  office_phone?: string | null;
  address?: string | null;
  office_address?: string | null;
  work_locations?: string[];
  bio?: string | null;
  /** Preset avatar path only (e.g. /images/avatars/avatar-01.svg). */
  avatar?: string | null;
  role: string;
  organization_id: string;
  organization_name?: string | null;
  is_enabled: boolean;
  is_active: boolean;
  created_at?: string | null;
};

export type TokenResponse = {
  access_token: string;
  token_type: string;
  user: AuthUser;
};

export type ApiKeysState = {
  openai_api_key_masked: string | null;
  sarvam_api_key_masked: string | null;
  openai_configured: boolean;
  sarvam_configured: boolean;
  openai_enabled: boolean;
  sarvam_enabled: boolean;
  whatsapp_phone_number_id: string | null;
  whatsapp_access_token_masked: string | null;
  whatsapp_business_id: string | null;
  whatsapp_configured: boolean;
  whatsapp_enabled: boolean;
  // The number as WhatsApp shows it, and how it was connected — "embedded_signup" or
  // "manual". Both come from stored data, so the settings screen can name the connected
  // number without waiting on a call to Meta.
  whatsapp_display_number: string | null;
  whatsapp_connected_via: string | null;
};

export type MetaConfig = {
  configured: boolean;
  app_id: string | null;
  config_id: string | null;
  graph_version: string;
};

export type MetaConnectResult = {
  connected: boolean;
  phone_number_id: string;
  display_number: string | null;
  verified_name: string | null;
  business_id: string;
  business_name: string | null;
  warnings: string[];
  message: string;
};

export type Plan = {
  code: "1_month" | "3_month" | "1_year";
  name: string;
  duration_days: number;
  price_inr: number;
  description: string;
  features: string[];
  popular: boolean;
};

export type ActivatePlanResult = {
  user: AuthUser;
  subscription: {
    plan_code: string;
    status: string;
    starts_at: string;
    ends_at: string;
  };
  message: string;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

/* ---------------------------------------------------------------------------
 * The signed-in user, as a subscribable store.
 *
 * localStorage has no way to tell React that it changed, so a component that
 * read the user on mount kept rendering that copy — which is why a saved avatar
 * only appeared after a page reload. Every write now goes through `cacheStoredUser`,
 * and that is the single place that notifies, so "the save returned" and "the UI
 * caught up" cannot drift apart.
 *
 * Read it from a component with `useStoredUser()` (src/hooks/useStoredUser.ts).
 * ------------------------------------------------------------------------- */

const userListeners = new Set<() => void>();

// `useSyncExternalStore` re-renders forever if getSnapshot returns a fresh object
// each call, so the parsed user is cached against the exact raw string it came
// from and only re-parsed when that string actually changes.
let cachedRaw: string | null = null;
let cachedUser: AuthUser | null = null;

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    if (!raw) {
      cachedUser = null;
    } else {
      try {
        cachedUser = JSON.parse(raw) as AuthUser;
      } catch {
        cachedUser = null;
      }
    }
  }
  return cachedUser;
}

function notifyUserChanged() {
  getStoredUser(); // refresh the cache before any listener reads it
  for (const listener of [...userListeners]) listener();
}

let onStorage: ((event: StorageEvent) => void) | null = null;

export function subscribeStoredUser(listener: () => void) {
  userListeners.add(listener);
  // A tab never receives its own `storage` event, so the explicit notify above
  // covers this tab and this listener covers the others.
  if (!onStorage) {
    onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === USER_KEY) notifyUserChanged();
    };
    window.addEventListener("storage", onStorage);
  }
  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0 && onStorage) {
      window.removeEventListener("storage", onStorage);
      onStorage = null;
    }
  };
}

/**
 * Replace the cached user without touching the token — the shape of every
 * profile update. Call this after any request that returns a fresh `AuthUser`.
 */
export function cacheStoredUser(user: AuthUser) {
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  window.localStorage.setItem(ORG_KEY, user.organization_id);
  notifyUserChanged();
}

export function persistSession(token: string, user: AuthUser) {
  window.localStorage.setItem(TOKEN_KEY, token);
  cacheStoredUser(user);
}

export function clearSession() {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  notifyUserChanged();
}

export async function registerAccount(payload: {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  organization_name?: string;
  phone?: string;
}) {
  const data = await apiFetch<TokenResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  persistSession(data.access_token, data.user);
  return data;
}

export async function loginAccount(payload: { email: string; password: string }) {
  const data = await apiFetch<TokenResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  persistSession(data.access_token, data.user);
  return data;
}

export async function logoutAccount() {
  try {
    await apiFetch<{ message: string }>("/api/v1/auth/logout", { method: "POST" });
  } catch {
    // clear local session regardless
  } finally {
    clearSession();
  }
}

export async function fetchMe() {
  const user = await apiFetch<AuthUser>("/api/v1/auth/me");
  cacheStoredUser(user);
  return user;
}

export async function updateProfile(payload: {
  first_name?: string;
  last_name?: string;
  phone?: string | null;
  office_phone?: string | null;
  address?: string | null;
  office_address?: string | null;
  work_locations?: string[];
  bio?: string | null;
  avatar?: string | null;
}) {
  const user = await apiFetch<AuthUser>("/api/v1/auth/me", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  // The token is untouched by a profile edit, so cache the user directly rather
  // than going through persistSession — this is what makes the header repaint
  // the moment Save returns instead of on the next reload.
  cacheStoredUser(user);
  return user;
}

export async function changePassword(payload: {
  current_password: string;
  new_password: string;
}) {
  return apiFetch<{ message: string }>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getApiKeys() {
  return apiFetch<ApiKeysState>("/api/v1/profile/api-keys");
}

export async function updateApiKeys(payload: {
  openai_api_key?: string | null;
  sarvam_api_key?: string | null;
  openai_enabled?: boolean;
  sarvam_enabled?: boolean;
  whatsapp_phone_number_id?: string | null;
  whatsapp_access_token?: string | null;
  whatsapp_business_id?: string | null;
  whatsapp_enabled?: boolean;
}) {
  return apiFetch<ApiKeysState>("/api/v1/profile/api-keys", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function getMetaConfig() {
  return apiFetch<MetaConfig>("/api/v1/meta/config");
}

export async function connectWhatsApp(payload: {
  code: string;
  waba_id?: string | null;
  phone_number_id?: string | null;
}) {
  return apiFetch<MetaConnectResult>("/api/v1/meta/connect", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function disconnectWhatsApp() {
  return apiFetch<ApiKeysState>("/api/v1/meta/disconnect", { method: "POST" });
}

export async function listPlans() {
  return apiFetch<Plan[]>("/api/v1/plans");
}

export async function activatePlan(plan_code: Plan["code"]) {
  const result = await apiFetch<ActivatePlanResult>("/api/v1/plans/activate", {
    method: "POST",
    body: JSON.stringify({ plan_code }),
  });
  cacheStoredUser(result.user);
  return result;
}

export { ApiError };
