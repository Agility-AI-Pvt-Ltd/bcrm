import type { Metadata } from "next";
import TemplatesPage from "@/components/whatsapp-templates/TemplatesPage";

export const metadata: Metadata = {
  title: "WhatsApp Templates | EstateFlow",
  description:
    "Which of your WhatsApp templates Meta has approved, which are still under review, and which features are waiting on them",
};

export default function Page() {
  return <TemplatesPage />;
}
