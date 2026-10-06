import type { Metadata } from "next";
import { Suspense } from "react";
import ZohoIntegrationPage from "@/components/integrations/ZohoIntegrationPage";

export const metadata: Metadata = {
  title: "Zoho CRM | EstateFlow",
  description: "Connect your Zoho CRM to EstateFlow and keep your leads in sync",
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ZohoIntegrationPage />
    </Suspense>
  );
}
