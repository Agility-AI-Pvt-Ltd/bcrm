import type { Metadata } from "next";
import ContactsPage from "@/components/campaigns/ContactsPage";

export const metadata: Metadata = {
  title: "Contacts | EstateFlow",
  description: "Manage contact lists for real-estate campaign outreach.",
};

export default function Page() {
  return <ContactsPage />;
}
