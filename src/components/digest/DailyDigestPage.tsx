"use client";

import { useState } from "react";
import DigestHistoryTable from "./DigestHistoryTable";
import DigestNumberCard from "./DigestNumberCard";
import DigestPreviewCard from "./DigestPreviewCard";
import DigestSettingsCard from "./DigestSettingsCard";

/**
 * Daily digest: the whole flow on one screen.
 *
 *   customer → business WhatsApp → EstateFlow → AI + CRM → digest → your WhatsApp
 *
 * Read top to bottom: what it is and when it goes out, your own number, the message
 * with today's real numbers, and then what has actually been sent.
 */
export default function DailyDigestPage() {
  // One counter, bumped by whichever card changed something the others display:
  // saving a number changes the recipient list, and a send changes the log.
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((value) => value + 1);

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Daily digest</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          Every morning, each teammate gets one WhatsApp message on their own number: how many
          leads came in overnight, how many are hot, how many follow-ups are due, and who has not
          been contacted at all. Nobody has to open the CRM to know what the day looks like.
        </p>
        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
          {[
            "Customer messages your business number",
            "EstateFlow replies and qualifies",
            "AI scores the lead",
            "9am digest",
            "Your WhatsApp",
          ].map((step, index, all) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 dark:bg-white/[0.06]">
                {step}
              </span>
              {index < all.length - 1 ? <span aria-hidden>→</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <DigestSettingsCard onChanged={refresh} />
      <DigestNumberCard onSaved={refresh} />
      <DigestPreviewCard refreshKey={version} onSent={refresh} />
      <DigestHistoryTable refreshKey={version} />
    </div>
  );
}
