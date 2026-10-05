"use client";

/**
 * "Call me now": rings your own phone with this business's real AI call, through
 * the same path a customer callback takes. If it does not ring, the status says
 * why within seconds — the quickest way to find a setup problem.
 */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import { getAiCall, placeTestCall, type AiCallDetail } from "@/lib/aiCallback";
import { AI_CALLBACK_LIVE_PHASES } from "@/lib/inbox";
import { AiCallbackStrip } from "@/components/messages/AiCallbackStatus";
import AiCallDetails from "@/components/ai-callback/AiCallDetails";

const POLL_MS = 3_000;

export default function AiTestCall() {
  const [phone, setPhone] = useState("");
  const [call, setCall] = useState<AiCallDetail | null>(null);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);

  const refresh = useCallback(async (callId: string) => {
    try {
      setCall(await getAiCall(callId));
    } catch {
      // The next tick tries again.
    }
  }, []);

  // Follow the call until it is over, then once more a little later so the
  // transcript (saved a few seconds after hang-up) appears.
  const live = !!call && AI_CALLBACK_LIVE_PHASES.has(call.ai_callback.phase);
  const awaitingTranscript =
    !!call && !!call.answered_at && call.transcript.length === 0 && !live;
  useEffect(() => {
    if (!call || (!live && !awaitingTranscript)) return;
    const timer = setInterval(() => void refresh(call.id), POLL_MS);
    return () => clearInterval(timer);
  }, [call, live, awaitingTranscript, refresh]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPlacing(true);
    setError("");
    try {
      setCall(await placeTestCall(phone));
    } catch (err) {
      setError(failureText(err, "Could not place the test call."));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Test call</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Ring your own phone with the exact call a customer would get — your business name,
        the greeting and the questions. If it doesn&rsquo;t ring, the reason shows here.
      </p>

      <form onSubmit={(event) => void onSubmit(event)} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Your phone (blank = your profile number)"
          className="h-11 w-full max-w-xs rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90"
        />
        <button
          type="submit"
          disabled={placing || live}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {placing ? "Placing…" : live ? "Calling…" : "Call me now"}
        </button>
      </form>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

      {call ? (
        <div className="mt-2">
          <AiCallbackStrip view={call.ai_callback} />
          <div className="mt-3">
            <AiCallDetails call={call} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
