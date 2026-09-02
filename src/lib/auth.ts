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
  // Meta's verified business name for that number, e.g. "ABC Realty". Null on connections
  // made before the backend started keeping it, so the card omits the line rather than
  // rendering an empty one; POST /meta/test fills it in on the first check.
  whatsapp_verified_name: string | null;
};

export type MetaConfig = {
  configured: boolean;
  app_id: string | null;
  config_id: string | null;
  graph_version: string;
  // Whether a Redirect URI is registered, i.e. whether setup links can be minted at all.
  // Separate from `configured` because the popup needs no Redirect URI, so a server can
  // legitimately support one door and not the other.
  hosted_signup_available: boolean;
  // Which Embedded Signup flow to ask Meta for, passed through as extras.featureType.
  // Empty is Meta's standard flow. The server owns this because Coexistence — letting the
  // agency keep the WhatsApp Business app on the number they connect — is only allowed once
  // Meta has allow-listed the app, and that is a fact about the server's Meta app, not
  // about the browser. Optional so an older API that predates the field reads as "" here
  // rather than sending undefined into the SDK.
  feature_type?: string;
};

export type MetaSignupLink = {
  url: string;
  expires_at: string;
  expires_in_minutes: number;
};

export type MetaConnectResult = {
  connected: boolean;
  phone_number_id: string;
  display_number: string | null;
  verified_name: string | null;
  business_id: string;
  business_name: string | null;
  warnings: string[];
  // Means the same as MetaConnectionTest.can_register: Meta reported this number as not yet
  // registered for sending. Here so the PIN field can appear with the warning that asks for
  // one, rather than behind a Test Connection nobody has a reason to press yet. Optional
  // because it was added after this type existed — a backend that predates it reads as
  // undefined, which keeps the old behaviour instead of claiming a registered number.
  can_register?: boolean;
  message: string;
};

/**
 * The result of asking Meta about the connection we already hold.
 *
 * Field for field the backend's `MetaConnectionTest`. Read live rather than from the
 * settings row, because a number can be registered, banned or re-rated at Meta long after
 * its id was stored — which is the whole reason there is a button for this.
 *
 * `ok` and `can_send` are separate on purpose. `ok` means the stored token worked and Meta
 * described the number; `can_send` means a message would actually go out. A valid token on
 * an unregistered number is both `ok: true` and `can_send: false`, and that is the case the
 * card has to explain rather than paper over.
 */
export type MetaConnectionTest = {
  ok: boolean;
  token_valid: boolean;
  phone_number_id: string | null;
  display_number: string | null;
  verified_name: string | null;
  business_id: string | null;
  // Meta's own word — CONNECTED, PENDING, FLAGGED, RESTRICTED — not narrowed to a union,
  // because Meta has added values here before and an unknown one should reach the screen.
  status: string | null;
  quality_rating: string | null;
  can_send: boolean;
  // True when offering registration makes sense. The PIN field appears on this, so the card
  // never asks for a PIN it has nowhere to send.
  can_register: boolean;
  warnings: string[];
  message: string;
  checked_at: string;
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

/**
 * Ask Meta whether the connection we hold still works.
 *
 * Sends no WhatsApp message. A test that sent one would need a recipient, would count
 * against the account's messaging limits and would turn up in somebody's chat — so the
 * backend asks Meta about the number instead, which is what actually breaks: a revoked
 * token, a number moved to another business, a number never registered for sending.
 */
export async function testWhatsAppConnection() {
  return apiFetch<MetaConnectionTest>("/api/v1/meta/test", { method: "POST" });
}

/**
 * Finish the one step a connect cannot do: register the number for sending.
 *
 * The PIN is the number's own six-digit two-step verification PIN at Meta, and it is only
 * ever passed through — never kept here, never stored on the server. Whoever owns the
 * number supplies it, which is why this is a field on the card and not a server setting.
 *
 * Returns the same shape as `testWhatsAppConnection`, because the backend re-reads the
 * number afterwards: Meta accepting a registration does not always mean the number is ready
 * that instant.
 */
export async function registerWhatsAppNumber(pin: string) {
  return apiFetch<MetaConnectionTest>("/api/v1/meta/register", {
    method: "POST",
    body: JSON.stringify({ pin }),
  });
}

/**
 * Mint a single-use link that lets someone else finish the WhatsApp setup.
 *
 * For the common case where the person holding the agency's Facebook password is not the
 * person sitting in front of EstateFlow. The returned URL is a credential — it carries a
 * signed token naming this organization — so treat it like one: send it to the person who
 * needs it, not into a group chat. Each call invalidates any link issued before it.
 */
export async function createWhatsAppSignupLink() {
  return apiFetch<MetaSignupLink>("/api/v1/meta/signup-link", { method: "POST" });
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
