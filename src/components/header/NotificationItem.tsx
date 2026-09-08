"use client";

import AvatarText from "@/components/ui/avatar/AvatarText";
import {
  relativeTime,
  statusDotClass,
  type OrgNotification,
} from "@/lib/notifications";

export default function NotificationItem({
  item,
  onOpen,
}: {
  item: OrgNotification;
  onOpen: (item: OrgNotification) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className={`flex w-full gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 text-left hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
        item.viewed ? "" : "bg-gray-50 dark:bg-white/[0.04]"
      }`}
    >
      <span className="relative block h-10 w-10 max-w-10 shrink-0">
        <AvatarText name={item.actor_name} className="h-10 w-10" />
        <span
          className={`absolute bottom-0 right-0 z-10 h-2.5 w-2.5 rounded-full border-[1.5px] border-white dark:border-gray-900 ${statusDotClass(item)}`}
        />
      </span>
      <span className="block min-w-0">
        <span className="mb-1.5 block space-x-1 text-theme-sm text-gray-500 dark:text-gray-400">
          <span className="font-medium text-gray-800 dark:text-white/90">
            {item.actor_name}
          </span>
          <span>{item.action}</span>
          <span className="font-medium text-gray-800 dark:text-white/90">
            {item.target}
          </span>
        </span>
        <span className="flex items-center gap-2 text-theme-xs text-gray-500 dark:text-gray-400">
          <span>{item.category}</span>
          <span className="h-1 w-1 rounded-full bg-gray-400" />
          <span>{relativeTime(item.created_at)}</span>
        </span>
      </span>
    </button>
  );
}
