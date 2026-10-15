"use client";

import { useEffect, useRef } from "react";

/**
 * Feedback that stays where the eye is.
 *
 * This page is long, and its most consequential actions are near the bottom: you
 * approve a deletion in the requests list, or purge a retained file, and the
 * sentence telling you what actually happened used to render at the very top —
 * off-screen, behind two thousand pixels of scroll. People repeated the action
 * because nothing appeared to acknowledge it.
 *
 * Fixed to the viewport, and announced politely so a screen reader hears the
 * outcome of an action whose button is now disabled.
 */
export default function Toast({
  kind,
  message,
  onDismiss,
}: {
  kind: "success" | "error";
  message: string;
  onDismiss: () => void;
}) {
  // Held in a ref and synced in its own effect, so a parent re-render with a new
  // inline callback does not restart the countdown — and so nothing writes to a
  // ref during render.
  const dismiss = useRef(onDismiss);
  useEffect(() => {
    dismiss.current = onDismiss;
  });

  useEffect(() => {
    // Errors stay until dismissed: they usually need reading twice, and one that
    // vanishes mid-sentence is worse than none.
    if (kind === "error") return;
    const timer = setTimeout(() => dismiss.current(), 6000);
    return () => clearTimeout(timer);
  }, [kind, message]);

  const tone =
    kind === "success"
      ? "border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500"
      : "border-error-200 bg-error-50 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4"
    >
      <div
        className={`pointer-events-auto flex max-w-xl items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${tone}`}
      >
        <span className="flex-1">{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 text-xs underline opacity-70 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
