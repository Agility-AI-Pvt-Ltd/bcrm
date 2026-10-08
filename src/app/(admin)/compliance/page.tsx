import type { Metadata } from "next";
import CompliancePage from "@/components/compliance/CompliancePage";

export const metadata: Metadata = {
  title: "Compliance | EstateFlow",
  description:
    "Consent, customer data requests, WhatsApp cost and your number's standing",
};

export default function Page() {
  return <CompliancePage />;
}
