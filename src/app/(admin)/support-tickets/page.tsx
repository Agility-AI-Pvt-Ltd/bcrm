import type { Metadata } from "next";
import SupportTicketsPage from "@/components/support/SupportTicketsPage";

export const metadata: Metadata = {
  title: "Support List | RealtyReach",
  description: "Support tickets list",
};

export default function Page() {
  return <SupportTicketsPage />;
}
