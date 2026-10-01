import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin | EstateFlow",
  description: "Verify account payments and open customer accounts",
};

/**
 * The operator console. Deliberately outside the `(admin)` route group.
 *
 * That group's name is historical — it is the signed-in *agent* dashboard, and
 * its layout wraps everything in `AuthGate` plus the agent sidebar. An operator
 * holds a different credential and belongs to no organisation, so rendering the
 * panel inside it would put an agent's auth gate in front of a page an agent must
 * never reach. Only the root layout applies here.
 */
export default function PlatformAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-gray-50 dark:bg-gray-900">{children}</div>;
}
