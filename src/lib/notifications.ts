import { apiFetch } from "./api";

/**
 * The broker's notification inbox — one org, one list.
 *
 * Unread is `viewed === false`. Clicking an item marks it viewed *and* clicked
 * before the UI follows `href`; opening the full page marks the loaded rows as
 * viewed without pretending they were handled.
 */

export type NotificationKind =
  | "new_customer"
  | "reply"
  | "call_answered"
  | "call_completed"
  | "visit_booked"
  | "callback_requested";

export type OrgNotification = {
  id: string;
  organization_id: string;
  kind: NotificationKind;
  actor_name: string;
  action: string;
  target: string;
  category: string;
  href: string;
  preview: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  call_id: string | null;
  viewed: boolean;
  clicked: boolean;
  viewed_at: string | null;
  clicked_at: string | null;
  created_at: string;
};

export type NotificationPage = {
  items: OrgNotification[];
  total: number;
  limit: number;
  offset: number;
  unread_count: number;
};

export async function listNotifications(params?: {
  limit?: number;
  offset?: number;
  unreadOnly?: boolean;
}) {
  const query = new URLSearchParams();
  if (params?.limit != null) query.set("limit", String(params.limit));
  if (params?.offset != null) query.set("offset", String(params.offset));
  if (params?.unreadOnly) query.set("unread_only", "true");
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return apiFetch<NotificationPage>(`/api/v1/notifications${suffix}`);
}

export async function getUnreadCount() {
  const data = await apiFetch<{ unread_count: number }>(
    "/api/v1/notifications/unread-count",
  );
  return data.unread_count;
}

export async function clickNotification(id: string) {
  return apiFetch<OrgNotification>(`/api/v1/notifications/${id}/click`, {
    method: "POST",
  });
}

export async function markNotificationsViewed(payload: {
  ids?: string[];
  all?: boolean;
}) {
  return apiFetch<{ unread_count: number }>("/api/v1/notifications/viewed", {
    method: "POST",
    body: JSON.stringify({
      ids: payload.ids ?? [],
      all: payload.all ?? false,
    }),
  });
}

/**
 * The header bell polls every 30 s. When this tab changes what is read (the
 * Notifications page, a click), it says so at once instead, so the bell and the
 * list never disagree until the next poll.
 */
export const UNREAD_CHANGED = "notifications:unread-changed";

export function announceUnread(count: number): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<number>(UNREAD_CHANGED, { detail: count }));
}

export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 45) return "just now";
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return minutes === 1 ? "1 min ago" : `${minutes} min ago`;
  }
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600);
    return hours === 1 ? "1 hr ago" : `${hours} hr ago`;
  }
  const days = Math.floor(seconds / 86400);
  return days === 1 ? "1 day ago" : `${days} days ago`;
}

export function statusDotClass(item: OrgNotification): string {
  if (!item.viewed) {
    return item.kind === "callback_requested" || item.kind === "visit_booked"
      ? "bg-error-500"
      : "bg-success-500";
  }
  return "bg-gray-400";
}
