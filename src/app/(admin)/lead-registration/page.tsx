import type { Metadata } from "next";
import AttributionPage from "@/components/attribution/AttributionPage";

export const metadata: Metadata = {
  title: "Lead Registration | EstateFlow",
  description:
    "Timestamped lead registration and site-visit proof, so a commission claim can be shown rather than argued",
};

export default function Page() {
  return <AttributionPage />;
}
