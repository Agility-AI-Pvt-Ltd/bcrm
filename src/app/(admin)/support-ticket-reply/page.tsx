import type { Metadata } from "next";
import SupportReplyPage from "@/components/support/SupportReplyPage";

export const metadata: Metadata = {
  title: "Support Reply | EstateFlow",
  description: "Support ticket reply",
};

export default function Page() {
  return <SupportReplyPage />;
}
