"use client";

import { useSyncExternalStore } from "react";
import { getStoredUser, subscribeStoredUser, type AuthUser } from "@/lib/auth";

/**
 * There is no user during server rendering, and returning localStorage data here
 * would be a hydration mismatch. React calls this for the server pass and the
 * hydration pass, then re-renders with the real snapshot — which is the whole
 * reason to use useSyncExternalStore instead of reading storage in an effect.
 */
function serverSnapshot(): AuthUser | null {
  return null;
}

/**
 * The signed-in user, live. Any component using this repaints as soon as
 * something calls `cacheStoredUser` — a profile save, an AI apply, `fetchMe`,
 * a plan activation, or a sign-out in another tab.
 */
export function useStoredUser(): AuthUser | null {
  return useSyncExternalStore(subscribeStoredUser, getStoredUser, serverSnapshot);
}
