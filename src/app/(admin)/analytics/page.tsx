import type { Metadata } from "next";
import DashboardPlaceholder from "@/components/common/DashboardPlaceholder";

export const metadata: Metadata = {
  title: "Analytics Dashboard | RealtyReach",
  description: "Analytics dashboard placeholder for the real-estate campaign portal.",
};

export default function AnalyticsDashboardPage() {
  return (
    <DashboardPlaceholder
      title="Analytics"
      description="This dashboard view is reserved for later. Use Campaign Studio to build outreach, then expand this page when you are ready."
    />
  );
}
