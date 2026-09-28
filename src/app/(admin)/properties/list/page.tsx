import type { Metadata } from "next";
import { Suspense } from "react";
import PropertyListView from "@/components/campaigns/PropertyListView";

export const metadata: Metadata = {
  title: "Property list | EstateFlow",
  description: "Browse property listings by status.",
};

export default function Page() {
  // useSearchParams needs a Suspense boundary during prerender.
  return (
    <Suspense fallback={null}>
      <PropertyListView />
    </Suspense>
  );
}
