"use client";

/**
 * The public front door. Everything a stranger sees before they have an account.
 *
 * The brief was a quiet page in the spirit of a developer gateway site: one huge
 * statement, one sentence under it, one button. What differs here is what sits in
 * the middle. A gateway can put a copyable URL there because the URL *is* the
 * product; ours is a conversation, so `ConversationDemo` holds that spot and does
 * the explaining. Which means the copy above it can stay short, and the section
 * below it can be four sentences rather than a tour.
 *
 * Restraint is the design. One accent (the app's own brand blue), one hairline
 * rule language borrowed from the Messages screen so the marketing page and the
 * product do not look like two different products, and no decoration that is not
 * carrying information. Anyone tempted to add a testimonial strip, a logo wall or
 * a second gradient should add it to the product instead.
 *
 * Signed-in visitors do not belong here. They are forwarded to `/dashboard`, which
 * decides where "into the app" means for their account.
 */

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import ConversationDemo from "@/components/landing/ConversationDemo";

/**
 * The four capabilities, in the order someone new needs them: reach people, read
 * what comes back, know where each lead stands, and have it continue without you.
 * Not a numbered sequence — you get all four at once — so they are not numbered.
 */
const CAPABILITIES = [
  {
    title: "WhatsApp outreach",
    body: "Upload a customer list and the first message goes out at a pace WhatsApp is happy with, each send recorded against the person who received it.",
  },
  {
    title: "One inbox, ranked by interest",
    body: "Every reply in one place, ordered by how likely each person is to buy, with the 24-hour reply window shown before you start typing.",
  },
  {
    title: "A pipeline that stays current",
    body: "Six stages. A conversation moves when the customer's own answers change, not when someone remembers to drag a card across a board.",
  },
  {
    title: "An AI shift, every six hours",
    body: "It looks at what is outstanding, decides an order, and does the work: first messages, follow-ups for quiet leads, and the ones worth your own call.",
  },
];

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    // A token is enough to send them on. Where "on" leads — campaigns or plans —
    // is `/dashboard`'s decision, so it is not duplicated here.
    if (getAccessToken()) router.replace("/dashboard");
  }, [router]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-white dark:bg-gray-900">
      {/* A single soft bloom behind the headline. The page's only ornament. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[46rem]"
        style={{
          background:
            "radial-gradient(58% 52% at 50% 10%, rgba(70,95,255,0.10), rgba(70,95,255,0) 72%)",
        }}
      />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <span className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
            EstateFlow
          </span>
          <Link
            href="/signin"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-600 transition hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-white"
          >
            Sign in
          </Link>
        </header>

        <main className="flex flex-1 flex-col">
          <section className="flex flex-col items-center pt-12 pb-20 text-center sm:pt-20">
            <h1 className="max-w-4xl text-[clamp(2.5rem,7.5vw,5rem)] leading-[0.98] font-extrabold tracking-[-0.045em] text-balance text-gray-900 dark:text-white">
              Every enquiry answered, on WhatsApp, on its own.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-gray-500 dark:text-gray-400">
              EstateFlow messages your customer list, replies in context, scores who is
              actually interested, and hands you the ones worth calling.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/signup"
                className="rounded-full bg-brand-500 px-7 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                Get started
              </Link>
              <Link
                href="/signin"
                className="rounded-full border border-gray-300 px-7 py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.04]"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-16 w-full sm:mt-20">
              <ConversationDemo />
            </div>
          </section>

          <section className="pb-20">
            <h2 className="mb-8 text-center text-[11px] font-semibold tracking-[0.14em] text-gray-400 uppercase dark:text-gray-500">
              What it does
            </h2>
            {/* Stacked and ruled on a phone, one ruled row on a desktop. The rules
                are the same hairlines the Messages screen uses to fence its
                sections, which is why no card or shadow is needed here. */}
            <div className="divide-y divide-gray-200 border-y border-gray-200 lg:flex lg:divide-x lg:divide-y-0 dark:divide-gray-800 dark:border-gray-800">
              {CAPABILITIES.map((capability) => (
                <div key={capability.title} className="px-2 py-7 lg:flex-1 lg:px-6">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    {capability.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                    {capability.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 py-6 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <span>© {new Date().getFullYear()} EstateFlow</span>
          <span>AI-assisted real-estate campaign workspace</span>
        </footer>
      </div>
    </div>
  );
}
