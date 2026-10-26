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

/**
 * The parts of the workspace a real-estate agent can open. Everything else stays
 * in the sidebar, faded, and does not open — not from the menu and not from a
 * typed URL or an in-page link (`AuthGate` shows a "not available" panel).
 *
 * A prefix list: `/properties/list`, `/profile/availability` and the like are
 * part of the page they sit under. `/plans` is always reachable, because a
 * lapsed account must be able to pick a plan.
 *
 * A developer session (a developer the platform admin let into this account) is
 * not limited by this list: they are there to debug the whole workspace.
 *
 * This is what stops a page being drawn. The data behind the pages agents keep
 * is shared with the ones they don't, so the API is not filtered by it.
 */
export const AGENT_PATHS = [
  "/leads",
  "/messages",
  "/properties",
  "/site-visits",
  "/daily-digest",
  "/calendar",
  "/notifications",
  "/profile",
] as const;

const ALWAYS_OPEN = ["/plans"];

function underAny(pathname: string, roots: readonly string[]): boolean {
  return roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
}

/** May this user open this page? */
export function canOpen(
  pathname: string,
  user: { acting_developer?: unknown } | null,
): boolean {
  if (user?.acting_developer) return true;
  return underAny(pathname, AGENT_PATHS) || underAny(pathname, ALWAYS_OPEN);
}

export const NOT_AVAILABLE_HINT = "Not available on your account";
