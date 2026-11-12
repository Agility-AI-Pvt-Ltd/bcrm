"use client";

/**
 * Flow voice (vc_v1). Separate from the AI Callback page, which runs on the
 * pipecat_sarvam agent: this one is the prerecorded, flow-based agent, tried in
 * the browser. The API decides who may open it; this page only shows the answer.
 */

import { useStoredUser } from "@/hooks/useStoredUser";
import { useVoiceFlowStatus } from "@/hooks/useVoiceFlowStatus";
import VoiceFlowConsole from "@/components/voice-flow/VoiceFlowConsole";

export default function VoiceFlowPage() {
  const user = useStoredUser();
  const status = useVoiceFlowStatus();

  return (
    <>
      <div className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">Flow Voice</h2>
          <span className="rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
            vc_v1 · testing
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          A controlled voice agent: every sentence it says is written in advance, and it follows a
          fixed flow of questions. Talk to it with your microphone, as a customer would on a call.
          This is separate from AI Callback.
        </p>
      </div>

      {status === null ? (
        <p className="text-sm text-gray-500">Checking access…</p>
      ) : status.available ? (
        <VoiceFlowConsole defaultCustomerName={user?.first_name ?? ""} />
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400">
          {status.message || "Flow voice is not available on this account."}
        </div>
      )}
    </>
  );
}
