import type { Metadata } from "next";
import SiteVisitsPage from "@/components/site-visits/SiteVisitsPage";

export const metadata: Metadata = {
  title: "Site Visits | EstateFlow",
  description:
    "Slot booking, reminders, the location pin, check-in and post-visit feedback for every site visit",
};

export default function Page() {
  return <SiteVisitsPage />;
}
