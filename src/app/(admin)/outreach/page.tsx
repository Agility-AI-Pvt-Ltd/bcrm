import type { Metadata } from "next";
import OutreachWorkspace from "@/components/outreach/OutreachWorkspace";

export const metadata: Metadata = {
  title: "WhatsApp Outreach | EstateFlow",
  description:
    "Send WhatsApp messages to a whole list, track every send, and let the AI follow up.",
};

export default function Page() {
  return <OutreachWorkspace />;
}
