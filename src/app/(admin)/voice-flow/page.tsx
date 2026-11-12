import type { Metadata } from "next";
import VoiceFlowPage from "@/components/voice-flow/VoiceFlowPage";

export const metadata: Metadata = {
  title: "Flow Voice | EstateFlow",
  description: "Try the flow-based voice agent (vc_v1) in the browser with your microphone",
};

export default function Page() {
  return <VoiceFlowPage />;
}
