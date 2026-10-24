"use client";

import { useRouter } from "next/navigation";
import { useStoredUser } from "@/hooks/useStoredUser";
import { logoutAccount } from "@/lib/auth";

/**
 * Shown on every page while a developer — not the agent — is inside this
 * account. A developer opened it with a code emailed to their own address, so it
 * must never look like the agent's own session: anything they change, they
 * change in a real agency's live account.
 */
export default function DeveloperSessionBanner() {
  const router = useRouter();
  const user = useStoredUser();
  const developer = user?.acting_developer;
  if (!developer) return null;

  const leave = async () => {
    await logoutAccount();
    router.replace("/signin");
  };

  const agency = user.organization_name || user.email;
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-2 border-b border-warning-200 bg-warning-50 px-4 py-2 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
    >
      <span>
        <strong>Developer session.</strong> You ({developer.email}) are inside{" "}
        <strong>{agency}</strong>&apos;s live account. Every change is real and is logged.
      </span>
      <button
        type="button"
        onClick={() => void leave()}
        className="rounded-md border border-warning-300 px-3 py-1 text-xs font-medium hover:bg-warning-100 dark:border-warning-500/40 dark:hover:bg-warning-500/20"
      >
        Leave account
      </button>
    </div>
  );
}
