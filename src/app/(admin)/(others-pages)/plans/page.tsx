import PlansPageClient from "@/components/billing/PlansPageClient";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Plans | EstateFlow",
  description: "Choose a plan to enable your EstateFlow account",
};

export default function PlansPage() {
  return <PlansPageClient />;
}
