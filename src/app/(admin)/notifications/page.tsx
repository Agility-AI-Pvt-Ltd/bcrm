import NotificationsWorkspace from "@/components/header/NotificationsWorkspace";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "Notifications | EstateFlow",
  description: "Replies, answered calls, site visits, and callbacks for your team",
};

export default function NotificationsPage() {
  return <NotificationsWorkspace />;
}
