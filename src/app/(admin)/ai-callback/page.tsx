import type { Metadata } from "next";
import AiCallbackForm from "@/components/ai-callback/AiCallbackForm";

export const metadata: Metadata = {
  title: "AI Callback | EstateFlow",
  description: "Phone quiet WhatsApp enquiries, collect their requirements, and follow up on WhatsApp",
};

export default function Page() {
  return <AiCallbackForm />;
}
