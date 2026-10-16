"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAdminToken } from "@/lib/adminApi";
import AdminNav from "./AdminNav";
import AdminRateCard from "./AdminRateCard";

/**
 * The rate card on a page of its own.
 *
 * It is still on the spend screen, where it answers "why is this total wrong" —
 * nearly always a unit nobody has priced, and the fix three feet away rather
 * than in a deploy. This page is for the other half of the job: an invoice
 * arrives with new prices on it and an operator comes to type them in, having
 * no reason to be looking at anybody's spend.
 */
export default function AdminRatesClient() {
  const router = useRouter();

  useEffect(() => {
    if (!getAdminToken()) router.replace("/admin/login");
  }, [router]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
          EstateFlow operator
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">
          Rate card
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
          What one unit of everything costs us, from your own provider invoices. A new
          price applies to usage from today onwards, so a correction typed in now never
          moves a figure already reported. Each line shows how much has actually been
          metered against it, so you can see which prices are worth chasing an invoice
          for — or press <strong>Price it with AI</strong> to have the whole card
          estimated, then check the numbers before saving them.
        </p>
      </header>
      <AdminRateCard heading={false} detailed />
    </div>
  );
}
