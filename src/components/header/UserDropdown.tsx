"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { logoutAccount } from "@/lib/auth";
import { useStoredUser } from "@/hooks/useStoredUser";
import { profileAvatarName, resolveProfileAvatar } from "@/lib/avatars";

const MENU_ITEMS = [
  { href: "/profile", label: "Edit profile" },
  { href: "/profile/work-locations", label: "Work locations" },
  { href: "/profile/api-management", label: "API management" },
  { href: "/profile/change-password", label: "Change password" },
  { href: "/plans", label: "Plans" },
] as const;

export default function UserDropdown() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  // Subscribed, not read once on mount: saving a new avatar on /profile has to
  // change this header immediately, without a reload.
  const user = useStoredUser();

  function toggleDropdown(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  const goTo = (href: string) => {
    closeDropdown();
    router.push(href);
  };

  const onSignOut = async () => {
    closeDropdown();
    await logoutAccount();
    router.push("/signin");
  };

  const displayName = user
    ? `${user.first_name} ${user.last_name}`.trim() || user.email
    : "Account";
  const avatarSrc = resolveProfileAvatar(user?.avatar);

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="dropdown-toggle flex items-center text-gray-700 dark:text-gray-400"
      >
        <span className="mr-3 h-11 w-11 overflow-hidden rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            width={44}
            height={44}
            src={avatarSrc}
            alt={`${displayName} — ${profileAvatarName(avatarSrc)} avatar`}
          />
        </span>
        <span className="text-theme-sm mr-1 block font-medium">{displayName}</span>
        <svg
          className={`stroke-gray-500 transition-transform duration-200 dark:stroke-gray-400 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[280px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        <div>
          <span className="text-theme-sm block font-medium text-gray-700 dark:text-gray-400">
            {displayName}
          </span>
          <span className="text-theme-xs mt-0.5 block text-gray-500 dark:text-gray-400">
            {user?.email || "Not signed in"}
          </span>
        </div>

        <ul className="flex flex-col gap-1 border-b border-gray-200 pt-4 pb-3 dark:border-gray-800">
          {MENU_ITEMS.map((item) => (
            <li key={item.href}>
              <DropdownItem
                onItemClick={() => goTo(item.href)}
                className="group text-theme-sm flex items-center gap-3 rounded-lg px-3 py-2 font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
              >
                {item.label}
              </DropdownItem>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void onSignOut()}
          className="group text-theme-sm flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
        >
          Sign out
        </button>
      </Dropdown>
    </div>
  );
}
