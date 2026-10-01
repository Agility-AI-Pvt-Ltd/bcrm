import type { Metadata } from "next";
import FollowUpsPage from "@/components/outreach/FollowUpsPage";

export const metadata: Metadata = {
  title: "Follow-ups | EstateFlow",
  description: "Re-engage leads who went quiet, and hand cold ones to a human.",
};

export default function Page() {
  return <FollowUpsPage />;
}
