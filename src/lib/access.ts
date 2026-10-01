/**
 * What an account that has not been verified yet may open.
 *
 * One list, used by every place that has to make this decision — the route gate,
 * the sidebar, the user menu. Three copies of it would drift, and the way you
 * find out is a user clicking a link that renders for a moment and then throws
 * them out.
 *
 * Deliberately an allow-list of exact paths rather than a prefix match. It used
 * to allow anything under `/profile/`, which quietly included
 * `/profile/availability` and `/profile/api-management` — pages that read and
 * write organisation settings, for an account nobody has confirmed paid yet.
 *
 * `/profile/change-password` is the one subpage kept open on purpose: someone
 * who thinks their password has leaked must be able to change it while they wait
 * for verification. Everything else waits.
 *
 * The API enforces the same boundary independently (`ENFORCE_ACCOUNT_ENABLED`
 * plus `EnabledUser` on the settings routes), so this list is what stops the
 * page being *drawn*, not what stops the data being read. Both are needed: this
 * one alone would be a client-side check anyone could skip.
 */
const ALLOWED_WHEN_DISABLED = new Set([
  "/plans",
  "/profile",
  "/profile/change-password",
]);

export function isAllowedWhenDisabled(pathname: string): boolean {
  return ALLOWED_WHEN_DISABLED.has(pathname);
}

/** True when this account is still waiting on verification. */
export function isAwaitingVerification(user: { is_enabled: boolean } | null): boolean {
  return user !== null && !user.is_enabled;
}
