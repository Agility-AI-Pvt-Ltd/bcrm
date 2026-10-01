"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  fetchMe,
  getAccessToken,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth";
import { isAllowedWhenDisabled } from "@/lib/access";

/**
 * What we know about the caller. `checking` is the only state that renders a
 * placeholder without having decided anything.
 */
type Gate =
  | { state: "checking" }
  | { state: "guest" }
  | { state: "known"; user: AuthUser };

/**
 * Blocks the dashboard until the user is authenticated *and* verified.
 *
 * The important property is that the decision is computed during render from
 * state we already hold — never awaited inside an effect while `children` are on
 * screen. The previous version kept a `ready` boolean that stayed `true` across a
 * client-side navigation: clicking "Home" from `/plans` re-ran the effect, but
 * `ready` was still true from the last route, so the dashboard painted for the
 * length of one `/auth/me` round trip (about a second) before the redirect
 * landed. An unverified account got a look at the product on every click.
 *
 * Now `gate` carries the user across navigations and the block is derived from
 * `gate` and the *new* pathname in the same render, so there is no frame in
 * which a forbidden page exists. The refetch still happens on navigation, but
 * only to keep the answer fresh — an approval or a revocation is picked up on
 * the next page change — and nothing is shown while waiting for it.
 */
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [gate, setGate] = useState<Gate>({ state: "checking" });

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!getAccessToken()) {
        if (!cancelled) setGate({ state: "guest" });
        return;
      }
      try {
        const me = await fetchMe();
        if (!cancelled) setGate({ state: "known", user: me });
      } catch {
        if (cancelled) return;
        // The API is unreachable or the token is stale. Fall back to the cached
        // user so a flaky network does not sign everyone out — but a cached user
        // is still put through the same check below.
        const cached = getStoredUser();
        setGate(cached ? { state: "known", user: cached } : { state: "guest" });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const blocked =
    gate.state === "known" &&
    !gate.user.is_enabled &&
    !isAllowedWhenDisabled(pathname);

  useEffect(() => {
    if (gate.state === "guest") router.replace("/signin");
  }, [gate.state, router]);

  useEffect(() => {
    if (blocked) router.replace("/plans");
  }, [blocked, router]);

  if (gate.state !== "known" || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500 dark:bg-gray-900">
        {blocked
          ? "Your account is awaiting verification…"
          : gate.state === "guest"
            ? "Redirecting to sign in…"
            : "Checking your account…"}
      </div>
    );
  }

  return <>{children}</>;
}
