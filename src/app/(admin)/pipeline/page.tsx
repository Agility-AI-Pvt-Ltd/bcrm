import type { Metadata } from "next";
import PipelinePage from "@/components/outreach/PipelinePage";

export const metadata: Metadata = {
  title: "Lead Pipeline | EstateFlow",
  description:
    "Six-stage lead pipeline with engagement tiers, kept up to date by the AI.",
};

export default function Page() {
  return <PipelinePage />;
}
