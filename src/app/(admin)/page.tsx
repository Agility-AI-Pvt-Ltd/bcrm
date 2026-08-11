import type { Metadata } from "next";
import CampaignWorkspace from "@/components/campaigns/CampaignWorkspace";

export const metadata: Metadata = {
  title: "Campaign Studio | Real Estate Outreach",
  description:
    "Create AI-assisted real-estate campaigns and prepare contact outreach.",
};

export default function CampaignStudioPage() {
  return <CampaignWorkspace />;
}
