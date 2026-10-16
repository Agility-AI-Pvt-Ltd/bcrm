"use client";

import { useState } from "react";
import DigestHistoryTable from "./DigestHistoryTable";
import DigestNumberCard from "./DigestNumberCard";
import DigestPreviewCard from "./DigestPreviewCard";
import DigestSectionsCard from "./DigestSectionsCard";
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

      {/* Discoverability for the on-demand path. The 9am send is a template, so
          it depends on Meta's approval and the account's billing currency and
          goes quiet when either is missing — this one depends on neither, and
          nobody would guess it exists. */}
      <section className="rounded-2xl border border-brand-200 bg-brand-50/50 p-5 dark:border-brand-500/30 dark:bg-brand-500/10 lg:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Or just message your own business number
        </h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-600 dark:text-gray-300">
          Send <strong>hi</strong> from the personal WhatsApp number you saved below, and
          you&rsquo;ll get three buttons back: today&rsquo;s numbers, this week&rsquo;s, and who
          is waiting for a call. Tap one and it arrives straight away.
        </p>
        <p className="mt-2 max-w-3xl text-xs text-gray-500 dark:text-gray-400">
          This works even when the 9am digest does not. The morning message is a template,
          so it needs Meta&rsquo;s approval and a billing currency set on your WhatsApp
          account; asking for one yourself opens the 24-hour window, and the reply goes
          back as an ordinary chat message with neither requirement. You can also type{" "}
          <strong>today</strong>, <strong>week</strong> or <strong>calls</strong> instead of
          tapping.
        </p>
      </section>

      <DigestSettingsCard onChanged={refresh} />
      <DigestNumberCard onSaved={refresh} />
      <DigestSectionsCard onChanged={refresh} />
      <DigestPreviewCard refreshKey={version} onSent={refresh} />
      <DigestHistoryTable refreshKey={version} />
    </div>
  );
}
