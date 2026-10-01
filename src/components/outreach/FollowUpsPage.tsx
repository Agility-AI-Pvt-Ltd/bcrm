"use client";

/**
 * Follow-ups: what happens to a lead after it has been contacted.
 *
 * Deliberately not part of Outreach. Outreach is about getting a campaign's
 * messages out; a lead can go quiet weeks after that campaign finished and
 * still needs following up, so the two run on separate schedules and are
 * switched on and off independently.
 */

import { useCallback, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import OfficeShiftCard from "@/components/outreach/OfficeShiftCard";

export default function FollowUpsPage() {
  const [, setReloadKey] = useState(0);
  const onWorkDone = useCallback(() => setReloadKey((value) => value + 1), []);

  return (
    <div>
      <PageBreadcrumb pageTitle="Follow-ups" />

      <div className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h2 className="font-semibold text-gray-900 dark:text-white/90">
          Keeping leads warm
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Every few hours the AI looks for leads who have gone quiet and writes
          each one a fresh message — never a repeat of what they already got —
          then decides how long to wait before trying again. Leads who have been
          silent for a week but were genuinely engaged are handed to you instead
          of being chased further.
        </p>
        <ul className="mt-3 space-y-1 text-sm text-gray-600 dark:text-gray-300">
          <li>• Re-engage quiet conversations with a new angle each time</li>
          <li>• Re-grade engagement as high, medium or low from replies</li>
          <li>• Hand long-quiet but engaged leads to a human</li>
        </ul>
        <p className="mt-3 text-xs text-gray-400">
          Campaign sending lives on the Outreach page. This shift never sends a
          campaign.
        </p>
      </div>

      <OfficeShiftCard kind="followup" onWorkDone={onWorkDone} />
    </div>
  );
}
