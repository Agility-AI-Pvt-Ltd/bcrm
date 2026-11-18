"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ApiError,
  clearSession,
  fetchMe,
  getAccessToken,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth";
import { isAllowedWhenDisabled } from "@/lib/access";
import { useStoredUser } from "@/hooks/useStoredUser";

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
  // The user remembered from the last visit. Until /auth/me answers, the gate
  // decides from it instead of covering the screen: every reload, new tab or
  // link from outside used to blank the whole app, sidebar included, for a
  // round trip. Null during server render and hydration (see useStoredUser), so
  // that first pass still shows the placeholder and nothing mismatches.
  const remembered = useStoredUser();
  const decided: Gate =
    gate.state === "checking" && remembered && getAccessToken()
      ? { state: "known", user: remembered }
      : gate;

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
      } catch (err) {
        if (cancelled) return;
        const cached = getStoredUser();
        // A developer session the admin has ended answers 401. Unlike a flaky
        // network, that is a definite "no": leave rather than keep showing the
        // agency's data from the cache.
        if (cached?.acting_developer && err instanceof ApiError && err.status === 401) {
          clearSession();
          setGate({ state: "guest" });
          return;
        }
        // The API is unreachable or the token is stale. Fall back to the cached
        // user so a flaky network does not sign everyone out — but a cached user
        // is still put through the same check below.
        setGate(cached ? { state: "known", user: cached } : { state: "guest" });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // The same check whether the user came from the server or from memory, so an
  // unverified account is still sent to /plans before any page is drawn. A
  // remembered "verified" that the server has since revoked shows for one round
  // trip at most; the API refuses that account's data regardless.
  const blocked =
    decided.state === "known" &&
    !decided.user.is_enabled &&
    !isAllowedWhenDisabled(pathname);

  useEffect(() => {
    if (gate.state === "guest") router.replace("/signin");
  }, [gate.state, router]);

  useEffect(() => {
    if (blocked) router.replace("/plans");
  }, [blocked, router]);

  if (decided.state !== "known" || blocked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-sm text-gray-500 dark:bg-gray-900">
        {blocked
          ? "Your account is awaiting verification…"
          : decided.state === "guest"
            ? "Redirecting to sign in…"
            : "Checking your account…"}
      </div>
    );
  }

  return <>{children}</>;
}
