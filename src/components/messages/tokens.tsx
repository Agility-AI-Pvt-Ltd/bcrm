/**
 * The shared visual vocabulary of the Messages screen.
 *
 * Four panels sit side by side here — filters, chat list, transcript, profile —
 * and before this file each one spelled its own labels and rules slightly
 * differently. Small differences in one screen read as carelessness, so every
 * label, field, hairline and status dot now comes from one place.
 *
 * Two rules the screen follows:
 *
 * * A rule means "different kind of fact". Horizontal between stacked
 *   categories, vertical between facts on one line. Never used as decoration.
 * * Colour lives in a dot, not in a second badge. A row carries at most one
 *   badge — the stage — because twenty-five rows of two coloured badges each is
 *   a colour chart, not a list you can scan.
 */

import type { ReactNode } from "react";
import { bandBadgeColor } from "@/lib/inbox";
import { stageBadgeColor } from "@/lib/outreach";

export type BadgeColor = ReturnType<typeof stageBadgeColor>;

/** The badge palette reduced to a dot, so a control keeps one uniform shape. */
export const DOT_COLORS: Record<BadgeColor, string> = {
  primary: "bg-brand-500",
  success: "bg-success-500",
  error: "bg-error-500",
  warning: "bg-warning-500",
  info: "bg-blue-light-500",
  light: "bg-gray-300 dark:bg-gray-600",
  dark: "bg-gray-700 dark:bg-gray-400",
};

export const LABEL =
  "block text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-500 dark:text-gray-400";

export const HINT = "text-[11px] leading-snug text-gray-400";

export const FIELD =
  "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 shadow-theme-xs transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:text-gray-300 dark:placeholder:text-white/30 dark:focus:border-brand-800";

export const SELECT = `${FIELD} dark:bg-gray-900`;

/** The one hairline in the screen. Everything that separates uses this colour. */
export const RULE = "border-gray-100 dark:border-gray-800";

/** Stacked categories, each fenced off from the next. */
export const DIVIDED = `divide-y divide-gray-100 dark:divide-gray-800`;

export function dotFor(band: string | null | undefined): string {
  return DOT_COLORS[bandBadgeColor(band)];
}

export function stageDot(stage: string | null | undefined): string {
  // `stageBadgeColor` takes a plain string and falls through to a neutral colour
  // for anything it does not recognise, so an unset stage becomes "" and lands on
  // that same neutral rather than needing a second branch here.
  return DOT_COLORS[stageBadgeColor(stage || "")];
}

/**
 * A vertical hairline between two facts on the same line.
 *
 * `aria-hidden` because it carries no meaning to a screen reader — the facts
 * either side are already separate elements.
 */
export function MetaRule() {
  return <span aria-hidden="true" className="h-3 w-px shrink-0 bg-gray-200 dark:bg-gray-700" />;
}

/** A small coloured dot. The only place status colour appears outside a badge. */
export function Dot({ className, title }: { className: string; title?: string }) {
  return <span title={title} className={`h-1.5 w-1.5 shrink-0 rounded-full ${className}`} />;
}

/**
 * A label with the rule running through it — the horizontal twin of `MetaRule`.
 *
 * Used where the categories are inline rather than stacked, so a `Section`
 * heading would sit in the wrong place: the day breaks in a transcript. The type
 * is a shade quieter than `LABEL` on purpose, because a date is a waypoint and
 * not a heading you read.
 */
export function SpanningLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3" role="separator">
      <span aria-hidden="true" className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-gray-400">
        {children}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
    </div>
  );
}

/** A labelled category. The rule above it comes from the parent's `DIVIDED`. */
export function Section({
  title,
  hint,
  aside,
  children,
}: {
  title: string;
  hint?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className={LABEL}>{title}</h3>
        {aside}
      </div>
      {hint && <p className={`mt-0.5 ${HINT}`}>{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function PillRow({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-1.5">{children}</div>;
}

export function Pill({
  label,
  hint,
  dot,
  active,
  onClick,
}: {
  label: string;
  hint?: string;
  dot?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-pressed={active}
      className={`inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition ${
        active
          ? "border-brand-500 bg-brand-50 font-medium text-brand-600 dark:bg-brand-500/10 dark:text-brand-400"
          : "border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-white/[0.03]"
      }`}
    >
      {dot && <Dot className={dot} />}
      {label}
    </button>
  );
}

// --- glyphs ----------------------------------------------------------------
// Drawn rather than typed as emoji: 📅 and ● render at a different size and
// colour on every platform, and in a CRM that reads as unfinished. These
// inherit `currentColor`, so they take the tone of the text beside them.

export function CalendarIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
      className={`h-3 w-3 shrink-0 ${className}`}
    >
      <rect x="1.75" y="2.75" width="10.5" height="9.5" rx="1.5" stroke="currentColor" />
      <path d="M1.75 5.75h10.5M4.75 1.5v2.5M9.25 1.5v2.5" stroke="currentColor" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
