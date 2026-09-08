"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import NotificationItem from "@/components/header/NotificationItem";
import { failureText } from "@/lib/api";
import {
  clickNotification,
  getUnreadCount,
  listNotifications,
  type OrgNotification,
} from "@/lib/notifications";

const POLL_MS = 30_000;
const DROPDOWN_LIMIT = 8;

export default function NotificationDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<OrgNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");

  const refreshCount = useCallback(async () => {
    try {
      setUnread(await getUnreadCount());
    } catch {
      // A missed badge is not worth a red error on every header poll.
    }
  }, []);

  const refreshList = useCallback(async () => {
    try {
      const page = await listNotifications({ limit: DROPDOWN_LIMIT });
      setItems(page.items);
      setUnread(page.unread_count);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load notifications."));
    }
  }, []);

  useEffect(() => {
    void refreshCount();
    const timer = window.setInterval(() => {
      void refreshCount();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [refreshCount]);

  const toggleDropdown = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) void refreshList();
  };

  const closeDropdown = () => setIsOpen(false);

  const openItem = async (item: OrgNotification) => {
    closeDropdown();
    try {
      await clickNotification(item.id);
      setUnread((count) => Math.max(0, count - (item.viewed ? 0 : 1)));
    } catch {
      // Navigate anyway — the click mark is best-effort.
    }
    router.push(item.href);
  };

  const badge =
    unread > 99 ? "99+" : unread > 0 ? String(unread) : null;

  return (
    <div className="relative">
      <button
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
        aria-label={
          unread > 0 ? `${unread} unread notifications` : "Notifications"
        }
      >
        {badge ? (
          <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-400 px-1 text-[10px] font-semibold text-white">
            {badge}
          </span>
        ) : null}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notification
          </h5>
          <button
            onClick={toggleDropdown}
            className="dropdown-toggle text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            aria-label="Close notifications"
          >
            <svg
              className="fill-current"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
        {error ? (
          <p className="px-3 py-6 text-center text-sm text-error-500">{error}</p>
        ) : (
          <ul className="custom-scrollbar flex h-auto flex-col overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-3 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
                No notifications yet. Replies, answered calls, and site visits
                will show up here.
              </li>
            ) : (
              items.map((item) => (
                <li key={item.id}>
                  <NotificationItem item={item} onOpen={(next) => void openItem(next)} />
                </li>
              ))
            )}
          </ul>
        )}
        <Link
          href="/notifications"
          onClick={closeDropdown}
          className="mt-3 block rounded-lg border border-gray-300 bg-white px-4 py-2 text-center text-sm font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View All Notifications
        </Link>
      </Dropdown>
    </div>
  );
}
