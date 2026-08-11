import type { Metadata } from "next";
import DashboardPlaceholder from "@/components/common/DashboardPlaceholder";

export const metadata: Metadata = {
  title: "Sales Dashboard | RealtyReach",
  description: "Sales dashboard placeholder for the real-estate campaign portal.",
};

export default function SalesDashboardPage() {
  return (
    <DashboardPlaceholder
      title="Sales"
      description="This dashboard view is reserved for later. Use Campaign Studio to build outreach, then expand this page when you are ready."
    />
  );
}
