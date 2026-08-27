import ApiManagementForm from "@/components/user-profile/ApiManagementForm";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "API management | EstateFlow",
  description: "Manage OpenAI and Sarvam API keys for your organization",
};

export default function ApiManagementPage() {
  return <ApiManagementForm />;
}
