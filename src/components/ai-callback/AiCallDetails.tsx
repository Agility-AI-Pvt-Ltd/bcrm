"use client";

/**
 * What one AI call learned: the summary, the requirements it gathered (budget,
 * BHK, locality, move-in) and the transcript. Used on the AI Callback page and
 * inside the customer's chat on Messages.
 */

import type { AiCallDetail } from "@/lib/aiCallback";

const REQUIREMENT_LABELS: Record<string, string> = {
  budget: "Budget",
  bhk: "BHK",
  locality: "Locality",
  move_in: "Move-in",
  purpose: "Buy / rent",
};

const LANGUAGE_NAMES: Record<string, string> = {
  "hi-IN": "Hindi / English",
  "bn-IN": "Bengali",
  "gu-IN": "Gujarati",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "mr-IN": "Marathi",
  "od-IN": "Odia",
  "pa-IN": "Punjabi",
  "ta-IN": "Tamil",
  "te-IN": "Telugu",
};

export function formatDuration(seconds: number | null): string | null {
  if (!seconds || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s} s` : `${s} s`;
}

export default function AiCallDetails({ call }: { call: AiCallDetail }) {
  const requirements = Object.entries(call.requirements || {});
  const facts = [
    formatDuration(call.duration_seconds),
    call.language ? LANGUAGE_NAMES[call.language] ?? call.language : null,
    call.outcome ? call.outcome.replace(/_/g, " ") : null,
    call.whatsapp_followup === "sent" ? "details sent on WhatsApp" : null,
  ].filter(Boolean);

  return (
    <div className="space-y-3 text-sm">
      {call.failure_reason ? (
        <p className="rounded-md bg-error-50 px-3 py-2 text-xs text-error-700 dark:bg-error-500/10 dark:text-error-400">
          {call.failure_reason}
        </p>
      ) : null}

      {facts.length > 0 ? (
        <p className="text-xs text-gray-500">{facts.join(" · ")}</p>
      ) : null}

      {call.summary ? (
        <p className="text-gray-700 dark:text-gray-200">{call.summary}</p>
      ) : null}

      {requirements.length > 0 ? (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500">Gathered on the call</p>
          <div className="flex flex-wrap gap-1.5">
            {requirements.map(([key, value]) => (
              <span
                key={key}
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <span className="text-gray-400">{REQUIREMENT_LABELS[key] ?? key}:</span> {value}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {call.transcript.length > 0 ? (
        <details className="group rounded-lg border border-gray-200 dark:border-gray-700">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-300">
            Transcript ({call.transcript.length} turns)
          </summary>
          <ol className="max-h-80 space-y-2 overflow-y-auto border-t border-gray-100 px-3 py-3 dark:border-gray-800">
            {call.transcript.map((turn, index) => (
              <li key={index} className="flex gap-2 text-xs leading-relaxed">
                <span
                  className={`w-16 shrink-0 font-semibold ${
                    turn.speaker === "customer" ? "text-gray-700 dark:text-gray-200" : "text-brand-600 dark:text-brand-400"
                  }`}
                >
                  {turn.speaker === "customer" ? "Customer" : call.business_name || "AI"}
                </span>
                <span className="text-gray-700 dark:text-gray-300">{turn.text}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : call.answered_at ? (
        <p className="text-xs text-gray-500">The transcript will appear once the call is saved.</p>
      ) : null}
    </div>
  );
}
