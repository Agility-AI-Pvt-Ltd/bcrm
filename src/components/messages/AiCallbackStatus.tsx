"use client";

/**
 * The AI callback, as the Messages screen shows it: a live countdown while the
 * timer runs ("AI call in 4:32"), then whether the call is ringing, done or
 * failed. A compact badge for the chat list, a fuller strip for the chat header.
 */

import { useEffect, useState } from "react";
import type { AiCallbackView } from "@/lib/inbox";
import { PhoneCallIcon } from "@/icons";

const TONES: Record<string, { badge: string; strip: string; dot: string }> = {
  info: {
    badge: "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-300",
    strip: "border-brand-200 bg-brand-50 dark:border-brand-500/30 dark:bg-brand-500/10",
    dot: "bg-brand-500",
  },
  success: {
    badge: "border-success-200 bg-success-50 text-success-700 dark:border-success-500/40 dark:bg-success-500/10 dark:text-success-400",
    strip: "border-success-200 bg-success-50 dark:border-success-500/30 dark:bg-success-500/10",
    dot: "bg-success-500",
  },
  error: {
    badge: "border-error-200 bg-error-50 text-error-700 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-400",
    strip: "border-error-200 bg-error-50 dark:border-error-500/30 dark:bg-error-500/10",
    dot: "bg-error-500",
  },
  neutral: {
    badge: "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300",
    strip: "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-white/[0.03]",
    dot: "bg-gray-400",
  },
};

function tone(view: AiCallbackView) {
  return TONES[view.tone] ?? TONES.neutral;
}

/** "4:32", or "1:04:05" past an hour. */
export function formatCountdown(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * Seconds left, ticking once a second. The deadline is fixed when the server's
 * `seconds_left` arrives (and again on each re-read), so re-renders do not reset
 * it and the browser's own clock setting does not matter.
 */
function useCountdown(secondsLeft: number | null): number | null {
  const [left, setLeft] = useState(secondsLeft);
  const [source, setSource] = useState(secondsLeft);
  // A fresh value from the server restarts the count from it. Adjusting state
  // during render, React's pattern for state derived from a changing prop.
  if (source !== secondsLeft) {
    setSource(secondsLeft);
    setLeft(secondsLeft);
  }

  useEffect(() => {
    if (secondsLeft === null) return;
    const deadline = Date.now() + secondsLeft * 1000;
    const timer = setInterval(() => {
      setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  return left;
}

/** The short text, with the live countdown folded in while it runs. */
function useLabel(view: AiCallbackView): string {
  const left = useCountdown(view.phase === "scheduled" ? view.seconds_left : null);
  if (view.phase === "scheduled") {
    return left && left > 0 ? `AI call in ${formatCountdown(left)}` : "Placing AI call…";
  }
  return view.label;
}

export function AiCallbackBadge({ view }: { view: AiCallbackView }) {
  const label = useLabel(view);
  const styles = tone(view);
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${styles.badge}`}
      title={view.detail ?? label}
    >
      <PhoneCallIcon className="h-3 w-3" aria-hidden="true" />
      {label}
    </span>
  );
}

export function AiCallbackStrip({ view }: { view: AiCallbackView }) {
  const label = useLabel(view);
  const styles = tone(view);
  const live = ["scheduled", "checking", "dialing", "ringing", "on_call"].includes(view.phase);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`mt-3 flex items-start gap-3 rounded-lg border px-3 py-2.5 ${styles.strip}`}
    >
      <span className="relative mt-1 flex h-2.5 w-2.5 shrink-0">
        {live ? (
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${styles.dot}`} />
        ) : null}
        <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${styles.dot}`} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold tabular-nums text-gray-800 dark:text-white/90">
          {label}
        </p>
        {view.detail ? (
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">{view.detail}</p>
        ) : null}
      </div>
    </div>
  );
}
