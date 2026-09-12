"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  activatePlan,
  ApiError,
  fetchMe,
  getAccessToken,
  listPlans,
  type AuthUser,
  type Plan,
} from "@/lib/auth";
import { apiFetch } from "@/lib/api";

type Subscription = {
  plan_code: string;
  status: string;
  starts_at: string;
  ends_at: string;
} | null;

function FeatureList({ features }: { features: string[] }) {
  if (!features.length) return null;
  return (
    <ul className="mt-5 space-y-2.5 text-left">
      {features.map((feature) => (
        <li key={feature} className="flex gap-2.5 text-sm text-gray-700 dark:text-gray-300">
          <span
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
            aria-hidden
          >
            ✓
          </span>
          <span>{feature}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PlansPageClient() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/signin");
      return;
    }
    void (async () => {
      try {
        const [me, catalog] = await Promise.all([fetchMe(), listPlans()]);
        setUser(me);
        setPlans(catalog);
        if (me.is_enabled) {
          try {
            const sub = await apiFetch<Subscription>("/api/v1/profile/subscription");
            setSubscription(sub);
          } catch {
            setSubscription(null);
          }
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load plans.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const onActivate = async (code: Plan["code"]) => {
    setActivating(code);
    setError("");
    try {
      const result = await activatePlan(code);
      setUser(result.user);
      setSubscription(result.subscription);
      setPlans(await listPlans());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not activate plan.");
    } finally {
      setActivating(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-center text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (user?.is_enabled) {
    const activePlan =
      plans.find((plan) => plan.code === subscription?.plan_code) || null;
    const starts = subscription?.starts_at
      ? new Date(subscription.starts_at).toLocaleDateString()
      : null;
    const ends = subscription?.ends_at
      ? new Date(subscription.ends_at).toLocaleDateString()
      : null;

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm font-medium text-success-600 dark:text-success-400">
            Account enabled
          </p>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white/90">
            Your active plan
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Features included with the plan you opted for.
          </p>
        </div>

        <div className="rounded-2xl border border-success-200 bg-white p-6 dark:border-success-500/30 dark:bg-white/[0.03] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                Current plan
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">
                {activePlan?.name || subscription?.plan_code?.replaceAll("_", " ") || "Active"}
              </h2>
              {activePlan ? (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {activePlan.description}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400">
                {subscription?.status === "active" ? "Active" : "Enabled"}
              </p>
              {activePlan ? (
                <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                  ₹{activePlan.price_inr.toLocaleString("en-IN")}
                </p>
              ) : null}
              {starts && ends ? (
                <p className="mt-1 text-xs text-gray-500">
                  {starts} – {ends}
                </p>
              ) : null}
            </div>
          </div>

          <div className="pt-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
              Included features
            </h3>
            <FeatureList features={activePlan?.features || []} />
            {!activePlan?.features?.length ? (
              <p className="mt-3 text-sm text-gray-500">
                Your account is enabled. Plan feature details are unavailable right now.
              </p>
            ) : null}
          </div>

          <div className="mt-8">
            <Link
              href="/leads"
              className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Go to home
            </Link>
          </div>
        </div>
        {error ? <p className="mt-6 text-center text-sm text-error-500">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 text-center">
        <p className="mb-2 text-sm font-medium text-brand-500">Account disabled</p>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white/90">
          Choose a plan to enable your account
        </h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Until a plan is active, CRM features stay locked. Pick 1 month, 3 months, or 1
          year.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.code}
            className={`rounded-2xl border p-6 dark:bg-white/[0.03] ${
              plan.popular
                ? "border-brand-500 bg-brand-50/40 dark:border-brand-500"
                : "border-gray-200 bg-white dark:border-gray-800"
            }`}
          >
            {plan.popular ? (
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-500">
                Popular
              </p>
            ) : null}
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white/90">
              {plan.name}
            </h2>
            <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
              ₹{plan.price_inr.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-xs text-gray-500">{plan.duration_days} days</p>
            <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {plan.description}
            </p>
            <FeatureList features={plan.features || []} />
            <button
              type="button"
              disabled={activating !== null}
              onClick={() => void onActivate(plan.code)}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {activating === plan.code ? "Activating…" : "Enable with this plan"}
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="mt-6 text-center text-sm text-error-500">{error}</p> : null}
    </div>
  );
}
