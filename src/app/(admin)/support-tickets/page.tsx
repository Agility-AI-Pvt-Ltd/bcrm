import type { Metadata } from "next";
import SupportTicketsPage from "@/components/support/SupportTicketsPage";

export const metadata: Metadata = {
  title: "Support List | EstateFlow",
  description: "Support tickets list",
};

export default function Page() {
  return <SupportTicketsPage />;
}
