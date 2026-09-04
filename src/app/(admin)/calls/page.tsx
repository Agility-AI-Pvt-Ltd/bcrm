import type { Metadata } from "next";
import CallCampaignWorkspace from "@/components/calls/CallCampaignWorkspace";

export const metadata: Metadata = {
  title: "AI Calling | EstateFlow",
  description:
    "Call a whole group with an AI agent, decide how it should talk, and read a summary of every conversation.",
};

export default function Page() {
  return <CallCampaignWorkspace />;
}
