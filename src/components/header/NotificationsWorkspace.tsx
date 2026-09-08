"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import NotificationItem from "@/components/header/NotificationItem";
import { failureText } from "@/lib/api";
import {
  clickNotification,
  listNotifications,
  markNotificationsViewed,
  type OrgNotification,
} from "@/lib/notifications";

const PAGE_SIZE = 25;

export default function NotificationsWorkspace() {
  const router = useRouter();
  const [items, setItems] = useState<OrgNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const page = await listNotifications({
        limit: PAGE_SIZE,
        offset,
        unreadOnly,
      });
      setItems(page.items);
      setTotal(page.total);
      setUnread(page.unread_count);
      setError("");
      const unseen = page.items.filter((item) => !item.viewed).map((item) => item.id);
      if (unseen.length > 0) {
        const result = await markNotificationsViewed({ ids: unseen });
        setUnread(result.unread_count);
        setItems((current) =>
          current.map((item) => (unseen.includes(item.id) ? { ...item, viewed: true } : item)),
        );
      }
    } catch (err) {
      setError(failureText(err, "Could not load notifications."));
    } finally {
      setLoading(false);
    }
  }, [offset, unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const openItem = async (item: OrgNotification) => {
    try {
      await clickNotification(item.id);
    } catch {
      // Still take them to the work.
    }
    router.push(item.href);
  };

  const markAll = async () => {
    try {
      const result = await markNotificationsViewed({ all: true });
      setUnread(result.unread_count);
      setItems((current) => current.map((item) => ({ ...item, viewed: true })));
    } catch (err) {
      setError(failureText(err, "Could not mark notifications as read."));
    }
  };

  const showingTo = Math.min(offset + items.length, total);

  return (
    <div>
      <PageBreadcrumb pageTitle="Notifications" />
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              All notifications
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {unread > 0
                ? `${unread} unread. Opening this page marks what you can see as viewed.`
                : "You're caught up."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                checked={unreadOnly}
                onChange={(event) => {
                  setUnreadOnly(event.target.checked);
                  setOffset(0);
                }}
              />
              Unread only
            </label>
            <button
              type="button"
              onClick={() => void markAll()}
              disabled={unread === 0}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Mark all as read
            </button>
          </div>
        </div>

        {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}

        {loading && items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Loading…</p>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">
            Nothing here yet. When a customer replies, picks up a call, or books a
            visit, it will land on this list.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationItem item={item} onOpen={(next) => void openItem(next)} />
              </li>
            ))}
          </ul>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              {offset + 1}–{showingTo} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset === 0}
                onClick={() => setOffset((value) => Math.max(0, value - PAGE_SIZE))}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset((value) => value + PAGE_SIZE)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
