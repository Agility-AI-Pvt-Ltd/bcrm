import type { Metadata } from "next";
import CampaignWorkspace from "@/components/campaigns/CampaignWorkspace";

export const metadata: Metadata = {
  title: "Campaigns | RealtyReach",
  description:
    "Create AI-assisted real-estate campaigns and prepare contact outreach.",
};

export default function CampaignsPage() {
  return <CampaignWorkspace />;
}
