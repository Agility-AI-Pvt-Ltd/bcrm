import type { Metadata } from "next";
import InboxPage from "@/components/support/InboxPage";

export const metadata: Metadata = {
  title: "Inbox | EstateFlow",
  description: "Email inbox",
};

export default function Page() {
  return <InboxPage />;
}
