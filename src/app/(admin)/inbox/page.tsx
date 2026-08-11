import type { Metadata } from "next";
import InboxPage from "@/components/support/InboxPage";

export const metadata: Metadata = {
  title: "Inbox | RealtyReach",
  description: "Email inbox",
};

export default function Page() {
  return <InboxPage />;
}
