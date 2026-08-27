"use client";

/**
 * The one memorable thing on the landing page: a real conversation, typing itself.
 *
 * Everything else on that page is deliberately quiet, so this carries the whole
 * explanation. A screenshot would show the software; this shows the *work* — an
 * enquiry arriving in the customer's own words, an answer with the detail a broker
 * would have had to look up, a visit booked, and the lead moving stage on its own.
 * That last line matters: it is the only place the page mentions scoring and the
 * pipeline, and it earns them by demonstration instead of a second section.
 *
 * Two rules shape the implementation. The thread fills from the bottom like a real
 * chat, inside a card tall enough for the finished conversation, so the page never
 * reflows while it plays. And a visitor who has asked for less motion gets the
 * completed thread immediately — the content is the point, the typing is not.
 */

import { useEffect, useState } from "react";

type Turn = {
  from: "customer" | "ai";
  text: string;
};

/** A Noida enquiry, because that is the stock this workspace was built around. */
const THREAD: Turn[] = [
  { from: "customer", text: "is the 3 bhk in sector 150 still available?" },
  {
    from: "ai",
    text: "Yes — 1,845 sq ft, ₹1.72 Cr, 11th floor and park facing. Shall I send the floor plan?",
  },
  { from: "customer", text: "yes. can i see it saturday" },
  {
    from: "ai",
    text: "Saturday suits. 4pm or 6pm? I'll hold the slot with the site team.",
  },
];

/** Long enough to read as deliberate, short enough that nobody waits for it. */
const OPENING_PAUSE_MS = 450;
const CUSTOMER_PAUSE_MS = 550;
const TYPING_MS = 1000;
const SETTLE_MS = 550;

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export default function ConversationDemo() {
  const [shown, setShown] = useState(0);
  const [typing, setTyping] = useState(false);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const pause = (ms: number) =>
      new Promise<void>((resolve) => {
        timers.push(setTimeout(resolve, ms));
      });

    const play = async () => {
      // The preference is read here rather than in state: the server render has
      // no window, and reading it inside the schedule keeps the first paint
      // identical on both sides. Reduced motion collapses the whole schedule to
      // its final frame — one step, so there is no flicker of it assembling.
      if (window.matchMedia(REDUCED_MOTION_QUERY).matches) {
        await pause(0);
        if (cancelled) return;
        setShown(THREAD.length);
        setSettled(true);
        return;
      }

      await pause(OPENING_PAUSE_MS);
      for (let index = 0; index < THREAD.length; index += 1) {
        if (cancelled) return;
        if (THREAD[index].from === "ai") {
          setTyping(true);
          await pause(TYPING_MS);
          if (cancelled) return;
          setTyping(false);
        } else {
          await pause(CUSTOMER_PAUSE_MS);
        }
        if (cancelled) return;
        setShown(index + 1);
      }
      await pause(SETTLE_MS);
      if (!cancelled) setSettled(true);
    };

    void play();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <figure
      className="mx-auto w-full max-w-md text-left"
      // The conversation is the argument, so it has to reach someone who cannot
      // watch it play. One description, in full, instead of four silent bubbles.
      role="img"
      aria-label={
        "An example WhatsApp conversation. The customer asks whether the 3BHK in " +
        "Sector 150 is still available. EstateFlow replies that it is — 1,845 " +
        "square feet, ₹1.72 crore, 11th floor and park facing — and offers the " +
        "floor plan. The customer asks to see it on Saturday, and EstateFlow " +
        "offers 4pm or 6pm and holds the slot. The lead is scored at 82 and moves " +
        "to the site visit stage."
      }
    >
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04),0_24px_48px_-24px_rgba(16,24,40,0.18)] dark:border-gray-800 dark:bg-white/[0.04]">
        {/* Who this is, and what the AI already thinks of them. */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            P
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">
              Priya Menon
            </span>
            <span className="block text-xs text-gray-400 dark:text-gray-500">
              WhatsApp · +91 98••• ••210
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
            <span className="size-1.5 rounded-full bg-success-500" />
            High interest
          </span>
        </div>

        {/* Fills from the bottom, so the newest line is always where the eye is. */}
        <div className="flex min-h-[17rem] flex-col justify-end gap-2 px-4 py-4">
          {THREAD.slice(0, shown).map((turn, index) => (
            <Bubble key={index} from={turn.from} text={turn.text} />
          ))}
          {typing ? <Typing /> : null}
        </div>

        {/* The quiet payoff: nobody typed this, and nobody moved the card. */}
        <div
          className={`flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 transition-opacity duration-500 dark:border-gray-800 ${
            settled ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="text-[11px] font-medium tracking-wide text-gray-400 uppercase dark:text-gray-500">
            Answered by EstateFlow
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Interest 82 · moved to Site visit
          </span>
        </div>
      </div>
    </figure>
  );
}

function Bubble({ from, text }: Turn) {
  const isAi = from === "ai";
  return (
    <span
      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-snug ${
        isAi
          ? "self-end rounded-br-md bg-brand-500 text-white"
          : "self-start rounded-bl-md bg-gray-100 text-gray-800 dark:bg-white/[0.07] dark:text-gray-200"
      }`}
    >
      {text}
    </span>
  );
}

function Typing() {
  return (
    <span
      aria-hidden
      className="flex w-fit items-center gap-1 self-end rounded-2xl rounded-br-md bg-brand-500/15 px-3.5 py-3"
    >
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="size-1.5 animate-pulse rounded-full bg-brand-500 dark:bg-brand-300"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </span>
  );
}
