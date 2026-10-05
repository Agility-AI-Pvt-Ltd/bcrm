import AiCallbackForm from "@/components/user-profile/AiCallbackForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "AI callback | EstateFlow",
  description: "Phone quiet WhatsApp enquiries, collect their requirements, and follow up on WhatsApp",
};

export default function AiCallbackPage() {
  return <AiCallbackForm />;
}
