import type { Metadata } from "next";
import PropertiesPage from "@/components/campaigns/PropertiesPage";

export const metadata: Metadata = {
  title: "Properties | RealtyReach",
  description: "Manage property listings for real-estate campaigns.",
};

export default function Page() {
  return <PropertiesPage />;
}
