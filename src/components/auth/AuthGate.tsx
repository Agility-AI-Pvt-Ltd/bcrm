"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  fetchMe,
  getAccessToken,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth";

/** Routes a disabled user may still open. */
function isAllowedWhenDisabled(pathname: string) {
  return pathname === "/plans" || pathname === "/profile" || pathname.startsWith("/profile/");
}

/**
 * Blocks the entire admin UI until the user is authenticated.
 * Guests are sent to /signin — no dashboard chrome is shown.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);
  const [, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const token = getAccessToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setReady(false);
          router.replace("/signin");
        }
        return;
      }

      try {
        const me = await fetchMe();
        if (cancelled) return;
        setUser(me);
        if (!me.is_enabled && !isAllowedWhenDisabled(pathname)) {
          setReady(false);
          router.replace("/plans");
          return;
        }
        setReady(true);
      } catch {
        if (cancelled) return;
        const cached = getStoredUser();
        if (!cached) {
          setReady(false);
          router.replace("/signin");
          return;
        }
        setUser(cached);
        if (!cached.is_enabled && !isAllowedWhenDisabled(pathname)) {
          setReady(false);
          router.replace("/plans");
          return;
        }
        setReady(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500 dark:bg-gray-900">
        Redirecting to sign in…
      </div>
    );
  }

  return <>{children}</>;
}
