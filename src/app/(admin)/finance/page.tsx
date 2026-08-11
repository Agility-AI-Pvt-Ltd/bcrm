import type { Metadata } from "next";
import DashboardPlaceholder from "@/components/common/DashboardPlaceholder";

export const metadata: Metadata = {
  title: "Finance Dashboard | RealtyReach",
  description: "Finance dashboard placeholder for the real-estate campaign portal.",
};

export default function FinanceDashboardPage() {
  return (
    <DashboardPlaceholder
      title="Finance"
      description="This dashboard view is reserved for later. Use Campaign Studio to build outreach, then expand this page when you are ready."
    />
  );
}
