import type { Metadata } from "next";
import LeadsPage from "@/components/campaigns/LeadsPage";

export const metadata: Metadata = {
  title: "Leads | RealtyReach",
  description: "Track buyer leads from campaign replies and follow-ups.",
};

export default function Page() {
  return <LeadsPage />;
}
