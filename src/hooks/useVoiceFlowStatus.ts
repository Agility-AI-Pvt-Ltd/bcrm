"use client";

import { useEffect, useState } from "react";
import { getVoiceFlowStatus, type VoiceFlowStatus } from "@/lib/voiceFlow";

/**
 * Whether this session may use Flow voice (vc_v1), asked once per page load and
 * shared by the sidebar and the page. Null while unknown, and treated as "no":
 * the entry appears only once the API has said yes.
 */
let cached: Promise<VoiceFlowStatus> | null = null;

export function useVoiceFlowStatus(enabled = true): VoiceFlowStatus | null {
  const [status, setStatus] = useState<VoiceFlowStatus | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    cached ??= getVoiceFlowStatus().catch((): VoiceFlowStatus => {
      cached = null; // ask again next time rather than remembering an outage
      return { available: false, reason: null, message: "Could not check Flow voice." };
    });
    void cached.then((value) => {
      if (alive) setStatus(value);
    });
    return () => {
      alive = false;
    };
  }, [enabled]);
  return status;
}
