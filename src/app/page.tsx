import type { Metadata } from "next";
import LandingPage from "@/components/landing/LandingPage";

/**
 * `/` is the public home page — the only route in the app a stranger can reach.
 * It sits outside the `(admin)` group on purpose, so it never passes through
 * `AuthGate` and never bounces a visitor to sign-in before they know what this is.
 *
 * The dashboard used to live here; it moved to `/dashboard`.
 */
export const metadata: Metadata = {
  // `absolute` opts out of the root layout's "%s | EstateFlow" template — the home
  // page should not read "EstateFlow | EstateFlow".
  title: { absolute: "EstateFlow — Every enquiry answered, on WhatsApp" },
  description:
    "EstateFlow messages your customer list on WhatsApp, replies in context, scores who is actually interested, and hands you the leads worth calling.",
};

export default function HomePage() {
  return <LandingPage />;
}
