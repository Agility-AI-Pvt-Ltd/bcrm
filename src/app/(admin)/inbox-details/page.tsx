import type { Metadata } from "next";
import InboxDetailsPage from "@/components/support/InboxDetailsPage";

export const metadata: Metadata = {
  title: "Inbox Details | RealtyReach",
  description: "Email inbox details",
};

export default function Page() {
  return <InboxDetailsPage />;
}
