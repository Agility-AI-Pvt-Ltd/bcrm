import type { Metadata } from "next";
import SourcePerformancePage from "@/components/reporting/SourcePerformancePage";

export const metadata: Metadata = {
  title: "Reporting | EstateFlow",
  description:
    "Cost per site visit and per booking, by lead source — and what is left before you are live",
};

export default function Page() {
  return <SourcePerformancePage />;
}
