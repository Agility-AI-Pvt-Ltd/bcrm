import type { Metadata } from "next";
import ContactsPage from "@/components/campaigns/ContactsPage";

export const metadata: Metadata = {
  title: "Contacts | RealtyReach",
  description: "Manage contact lists for real-estate campaign outreach.",
};

export default function Page() {
  return <ContactsPage />;
}
