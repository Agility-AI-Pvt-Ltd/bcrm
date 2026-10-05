import { redirect } from "next/navigation";

/**
 * Manual AI calls and call campaigns are switched off: outbound AI voice is used
 * only to call back WhatsApp enquiries, which is configured on the AI Callback page. The
 * old workspace (components/calls) is kept for when CALLS_MANUAL_ENABLED returns.
 */
export default function Page() {
  redirect("/ai-callback");
}
