import type { Metadata } from "next";
import DailyDigestPage from "@/components/digest/DailyDigestPage";

export const metadata: Metadata = {
  title: "Daily Digest | EstateFlow",
  description:
    "One WhatsApp message each morning on every agent's own number: new leads by interest, follow-ups due, and anyone not yet contacted",
};

export default function Page() {
  return <DailyDigestPage />;
}
