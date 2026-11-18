import type { Metadata } from "next";
import LeadsPage from "@/components/campaigns/LeadsPage";

export const metadata: Metadata = {
  title: "Home | EstateFlow",
  description: "Contacts who replied to you on WhatsApp — one reply makes a lead.",
};

export default function Page() {
  return <LeadsPage />;
}
