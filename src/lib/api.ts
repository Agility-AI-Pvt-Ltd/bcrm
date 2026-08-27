const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "http://127.0.0.1:8000";

const TOKEN_KEY = "bcrm.access_token";
const USER_KEY = "bcrm.user";
const ORG_KEY = "bcrm.organization_id";

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  } | null;
};

/**
 * What to show a person when a call fails.
 *
 * The API answers every database fault with the same four words, "A database
 * error occurred", which is right in production and leaves an operator with
 * nothing to act on in development. When the backend is running in debug it adds
 * the real reason under `details.reason`, so surface it — one unreadable sentence
 * from Postgres is still far more use than none.
 */
export function failureText(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const details = error.details;
  const reason =
    details && typeof details === "object" && "reason" in details
      ? String((details as { reason: unknown }).reason)
      : "";
  return reason ? `${error.message}: ${reason}` : error.message;
}

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

function readOrgId(): string {
  if (typeof window === "undefined") return "default";
  const stored = window.localStorage.getItem(ORG_KEY);
  if (stored) return stored;
  try {
    const raw = window.localStorage.getItem(USER_KEY);
    if (!raw) return "default";
    const user = JSON.parse(raw) as { organization_id?: string };
    return user.organization_id || "default";
  } catch {
    return "default";
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  // FormData must keep its own content type: the browser appends the multipart
  // boundary, and forcing application/json here would make the upload unreadable.
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  if (!headers.has("Content-Type") && init.body && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  const token = readToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("X-Organization-Id")) {
    headers.set("X-Organization-Id", readOrgId());
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  let payload: ApiEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as ApiEnvelope<T>;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(
      payload?.error?.message || `Request failed (${response.status})`,
      response.status,
      payload?.error?.code,
      payload?.error?.details,
    );
  }

  return payload?.data as T;
}

export { API_BASE_URL, TOKEN_KEY, USER_KEY, ORG_KEY };
