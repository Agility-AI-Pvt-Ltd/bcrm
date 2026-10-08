"use client";

import { useSidebar } from "@/context/SidebarContext";
import AuthGate from "@/components/auth/AuthGate";
import AppHeader from "@/layout/AppHeader";
import AppSidebar from "@/layout/AppSidebar";
import Backdrop from "@/layout/Backdrop";
import React from "react";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  const mainContentMargin = isMobileOpen
    ? "ml-0"
    : isExpanded || isHovered
      ? "lg:ml-[290px]"
      : "lg:ml-[90px]";

  return (
    <AuthGate>
      <div className="min-h-screen xl:flex">
        <AppSidebar />
        <Backdrop />
        {/* `min-w-0` is load-bearing. A flex child defaults to `min-width: auto`,
            which means its *content's* intrinsic width wins over the container —
            so one wide table anywhere inside pushed this div past the viewport and
            the whole page scrolled sideways, carrying the sidebar off-screen with
            it. With `min-w-0` the div stays the width of the screen and a wide
            table scrolls inside its own `overflow-x-auto` card, which is what that
            wrapper was always for. */}
        <div
          className={`min-w-0 flex-1 transition-all duration-300 ease-in-out ${mainContentMargin}`}
        >
          <AppHeader />
          <div className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">{children}</div>
        </div>
      </div>
    </AuthGate>
  );
}
