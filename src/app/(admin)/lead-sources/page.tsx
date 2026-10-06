import type { Metadata } from "next";
import LeadSourcesPage from "@/components/lead-sources/LeadSourcesPage";

export const metadata: Metadata = {
  title: "Lead Sources | EstateFlow",
  description: "Receive 99acres enquiries automatically and follow them up on WhatsApp.",
};

export default function Page() {
  return <LeadSourcesPage />;
}
