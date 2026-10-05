import type { Metadata } from "next";
import AiCallbackActivityList from "@/components/ai-callback/AiCallbackActivityList";
import AiCallbackForm from "@/components/ai-callback/AiCallbackForm";
import AiTestCall from "@/components/ai-callback/AiTestCall";

export const metadata: Metadata = {
  title: "AI Callback | EstateFlow",
  description: "Phone quiet WhatsApp enquiries, collect their requirements, and follow up on WhatsApp",
};

export default function Page() {
  return (
    <>
      <AiCallbackForm />
      <AiTestCall />
      <AiCallbackActivityList />
    </>
  );
}
