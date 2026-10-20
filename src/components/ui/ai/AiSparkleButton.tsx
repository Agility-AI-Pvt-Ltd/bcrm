"use client";

/**
 * The round "AI" button: a gradient sparkle that opens an AI feature.
 *
 * AI tools that fill a form for you are useful once and in the way every other
 * time, so they stay behind this button instead of sitting open above the form.
 * The sparkle says "AI" at a glance; the label that appears on hover and focus
 * says *which* AI feature it is, because an unexplained icon is one nobody
 * presses.
 *
 * The mark is a generic four-point sparkle with a smaller companion — the
 * common shorthand for "AI" — drawn here rather than any vendor's logo.
 */

import { useId } from "react";

export default function AiSparkleButton({
  label,
  hint,
  open,
  onClick,
  controls,
}: {
  /** The feature's name, e.g. "AI Profile Fill". Shown on hover and read aloud. */
  label: string;
  /** One line on what it does, under the name in the hover card. */
  hint?: string;
  open: boolean;
  onClick: () => void;
  /** The id of the panel this button opens, for screen readers. */
  controls?: string;
}) {
  // useId gives ":r1:"-style ids; colons inside an SVG `url(#…)` reference
  // break the gradient in some browsers, so they are stripped.
  const base = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const gradient = `ai-spark-${base}`;
  const tipId = `ai-spark-tip-${base}`;
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-expanded={open}
        aria-controls={controls}
        aria-label={open ? `Close ${label}` : `Open ${label}`}
        aria-describedby={tipId}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full border transition focus:outline-none focus-visible:ring-3 focus-visible:ring-brand-500/30 ${
          open
            ? "border-brand-300 bg-brand-50 dark:border-brand-500/50 dark:bg-brand-500/15"
            : "border-gray-200 bg-white hover:border-brand-300 hover:shadow-theme-xs dark:border-gray-700 dark:bg-white/[0.03]"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
          <defs>
            <linearGradient id={gradient} x1="3" y1="3" x2="21" y2="21" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--color-blue-light-400, #36bffa)" />
              <stop offset="0.55" stopColor="var(--color-brand-500, #465fff)" />
              <stop offset="1" stopColor="#c026d3" />
            </linearGradient>
          </defs>
          {/* Large sparkle: four concave points. */}
          <path
            fill={`url(#${gradient})`}
            d="M10 2.5c.5 3.9 2.6 6 6.5 6.5-3.9.5-6 2.6-6.5 6.5-.5-3.9-2.6-6-6.5-6.5 3.9-.5 6-2.6 6.5-6.5Z"
          />
          {/* Small companion sparkle, bottom right. */}
          <path
            fill={`url(#${gradient})`}
            d="M17.5 13.5c.25 1.9 1.1 2.75 3 3-1.9.25-2.75 1.1-3 3-.25-1.9-1.1-2.75-3-3 1.9-.25 2.75-1.1 3-3Z"
          />
        </svg>
      </button>
      {/* The hint. Shown on hover and keyboard focus, never on top of the
          open panel — once it is open, the panel says what it is. */}
      <span
        id={tipId}
        role="tooltip"
        className={`pointer-events-none absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-gray-200 bg-white px-3 py-2 text-left shadow-theme-lg transition dark:border-gray-700 dark:bg-gray-900 ${
          open
            ? "invisible opacity-0"
            : "invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
        }`}
      >
        <span className="block text-xs font-semibold text-gray-900 dark:text-white/90">
          {label}
        </span>
        {hint ? (
          <span className="mt-0.5 block text-[11px] leading-snug text-gray-500 dark:text-gray-400">
            {hint}
          </span>
        ) : null}
      </span>
    </span>
  );
}
