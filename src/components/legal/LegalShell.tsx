/**
 * The chrome around the Privacy and Terms pages.
 *
 * Public, server-rendered, and **no auth gate** — that is the whole point.
 * Google opens these URLs during OAuth verification without signing in, and a
 * policy page that redirects a stranger to a login screen fails the review.
 *
 * It borrows the landing page's restraint rather than the product's: one
 * hairline rule language, one accent, no cards. A legal page that looks like a
 * different website than the homepage invites the question of whether it belongs
 * to the same company, which is exactly the question a reviewer is asking.
 */

import Link from "next/link";
import { COMPANY, CONTACT_EMAIL, EFFECTIVE_DATE, PRODUCT } from "@/lib/legal";

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-gray-200 py-8 dark:border-gray-800">
      <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-gray-600 dark:text-gray-300">
        {children}
      </div>
    </section>
  );
}

/** A labelled list, for the things these pages mostly consist of. */
export function Rows({
  items,
}: {
  items: Array<{ label: string; body: string }>;
}) {
  return (
    <dl className="divide-y divide-gray-100 dark:divide-gray-800/80">
      {items.map((item) => (
        <div key={item.label} className="py-3 sm:flex sm:gap-6">
          <dt className="shrink-0 text-sm font-medium text-gray-900 sm:w-56 dark:text-white">
            {item.label}
          </dt>
          <dd className="mt-1 text-sm leading-relaxed text-gray-600 sm:mt-0 dark:text-gray-300">
            {item.body}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function LegalShell({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <header className="flex items-center justify-between py-6">
          <Link
            href="/"
            className="text-base font-semibold tracking-tight text-gray-900 dark:text-white"
          >
            {PRODUCT}
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link
              href="/privacy"
              className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Terms
            </Link>
          </nav>
        </header>

        <main className="pb-16">
          <h1 className="pt-8 text-[clamp(2rem,5vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.035em] text-gray-900 dark:text-white">
            {title}
          </h1>
          <p className="mt-5 text-base leading-relaxed text-gray-500 dark:text-gray-400">
            {intro}
          </p>
          <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
            {PRODUCT} is operated by {COMPANY}. Last updated {EFFECTIVE_DATE}. Questions
            about anything on this page:{" "}
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="underline underline-offset-2 hover:text-gray-600 dark:hover:text-gray-300"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>

          <div className="mt-8">{children}</div>
        </main>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 py-6 text-xs text-gray-400 dark:border-gray-800 dark:text-gray-500">
          <span>
            © {new Date().getFullYear()} {COMPANY}
          </span>
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-300">
            Back to {PRODUCT}
          </Link>
        </footer>
      </div>
    </div>
  );
}
