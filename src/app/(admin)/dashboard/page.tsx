"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, getStoredUser } from "@/lib/auth";

/**
 * `/dashboard` is the signed-in entry point: it decides where "into the app"
 * means for this account rather than being a screen of its own. Guests go to
 * sign-in, accounts without a plan go to plans, everyone else goes to campaigns.
 *
 * It used to live at `/`. That address now belongs to the public landing page,
 * so anything inside the app that means "take me home" points here.
 */
export default function DashboardEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      router.replace("/signin");
      return;
    }
    const user = getStoredUser();
    if (user && !user.is_enabled) {
      router.replace("/plans");
      return;
    }
    router.replace("/campaigns");
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-gray-500">
      Loading…
    </div>
  );
}
