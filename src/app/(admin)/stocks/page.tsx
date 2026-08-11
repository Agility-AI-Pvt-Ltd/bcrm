import type { Metadata } from "next";
import DashboardPlaceholder from "@/components/common/DashboardPlaceholder";

export const metadata: Metadata = {
  title: "Stocks Dashboard | RealtyReach",
  description: "Stocks dashboard placeholder for the real-estate campaign portal.",
};

export default function StocksDashboardPage() {
  return (
    <DashboardPlaceholder
      title="Stocks"
      description="This dashboard view is reserved for later. Use Campaign Studio to build outreach, then expand this page when you are ready."
    />
  );
}
