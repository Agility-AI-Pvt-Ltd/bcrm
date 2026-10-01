"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ApiError,
  fetchMe,
  fetchSubscription,
  getAccessToken,
  listPlans,
  requestPlan,
  type AuthUser,
  type PaymentMethod,
  type Plan,
  type Subscription,
} from "@/lib/auth";

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "upi", label: "UPI" },
  { value: "bank_transfer", label: "Bank transfer / NEFT / IMPS" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "other", label: "Other" },
];

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
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [chosen, setChosen] = useState<Plan | null>(null);
  const [reference, setReference] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("upi");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
        try {
          // Asked for unconditionally now: a disabled user may have a request
          // already waiting, and without this the page would invite them to pay
          // a second time.
          setSubscription(await fetchSubscription());
        } catch {
          setSubscription(null);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Could not load plans.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // While the request is outstanding, ask again every 15 seconds. The operator
  // approving it happens on their screen, not this one, and a customer watching
  // this page should not have to guess that a reload is what unlocks their
  // account. `fetchMe` refreshes the cached user too, so the sidebar and the
  // user menu unlock in the same tick.
  useEffect(() => {
    if (subscription?.status !== "pending_verification") return;
    const timer = window.setInterval(() => {
      void (async () => {
        try {
          const [me, current] = await Promise.all([fetchMe(), fetchSubscription()]);
          setUser(me);
          setSubscription(current);
        } catch {
          // A failed poll is not worth an error message — the next one retries.
        }
      })();
    }, 15_000);
    return () => window.clearInterval(timer);
  }, [subscription?.status]);

  const submitRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!chosen) return;
    setSubmitting(true);
    setError("");
    try {
      const result = await requestPlan({
        plan_code: chosen.code,
        payment_reference: reference,
        payment_method: method,
        payment_note: note.trim() || null,
      });
      setUser(result.user);
      setSubscription(result.subscription);
      setChosen(null);
      setReference("");
      setNote("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not submit the request.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <p className="text-center text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  // --- enabled: the plan they are on -------------------------------------
  if (user?.is_enabled && subscription?.status === "active") {
    const activePlan = plans.find((plan) => plan.code === subscription.plan_code) || null;
    const starts = new Date(subscription.starts_at).toLocaleDateString();
    const ends = new Date(subscription.ends_at).toLocaleDateString();

    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 text-center">
          <p className="mb-2 text-sm font-medium text-success-600 dark:text-success-400">
            Account enabled
          </p>
          <h1 className="text-3xl font-semibold text-gray-900 dark:text-white/90">
            Your active plan
          </h1>
        </div>

        <div className="rounded-2xl border border-success-200 bg-white p-6 dark:border-success-500/30 dark:bg-white/[0.03] sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-gray-100 pb-5 dark:border-gray-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
                Current plan
              </p>
              <h2 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">
                {activePlan?.name || subscription.plan_code.replaceAll("_", " ")}
              </h2>
              {activePlan ? (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  {activePlan.description}
                </p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="rounded-full bg-success-50 px-3 py-1 text-xs font-medium text-success-700 dark:bg-success-500/15 dark:text-success-400">
                Verified
              </p>
              {activePlan ? (
                <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
                  ₹{activePlan.price_inr.toLocaleString("en-IN")}
                </p>
              ) : null}
              <p className="mt-1 text-xs text-gray-500">
                {starts} – {ends}
              </p>
            </div>
          </div>

          <div className="pt-5">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white/90">
              Included features
            </h3>
            <FeatureList features={activePlan?.features || []} />
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
      </div>
    );
  }

  // --- waiting on an operator --------------------------------------------
  if (subscription?.status === "pending_verification") {
    const plan = plans.find((item) => item.code === subscription.plan_code);
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="rounded-2xl border border-warning-200 bg-warning-50/40 p-8 text-center dark:border-warning-500/30 dark:bg-warning-500/10">
          <p className="text-sm font-medium text-warning-700 dark:text-warning-400">
            Awaiting verification
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90">
            We&apos;re confirming your payment
          </h1>
          <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
            Your account opens as soon as our team matches this payment. You&apos;ll be able
            to sign straight in — nothing else is needed from you.
          </p>

          <dl className="mt-6 grid grid-cols-1 gap-4 rounded-xl bg-white p-5 text-left text-sm dark:bg-white/[0.05] sm:grid-cols-2">
            <div>
              <dt className="text-xs text-gray-500">Plan</dt>
              <dd className="mt-0.5 font-medium text-gray-900 dark:text-white/90">
                {plan?.name || subscription.plan_code.replaceAll("_", " ")}
                {plan ? ` · ₹${plan.price_inr.toLocaleString("en-IN")}` : ""}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Reference given</dt>
              <dd className="mt-0.5 font-mono text-gray-900 dark:text-white/90">
                {subscription.payment_reference || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Submitted</dt>
              <dd className="mt-0.5 text-gray-900 dark:text-white/90">
                {subscription.requested_at
                  ? new Date(subscription.requested_at).toLocaleString()
                  : "—"}
              </dd>
            </div>
          </dl>

          <button
            type="button"
            onClick={() => {
              setSubscription(null);
              setChosen(plan || null);
              setReference(subscription.payment_reference || "");
            }}
            className="mt-6 text-sm text-brand-500 underline"
          >
            Correct the payment details
          </button>
        </div>
      </div>
    );
  }

  // --- rejected -----------------------------------------------------------
  const wasRejected = subscription?.status === "rejected";

  // --- choose a plan ------------------------------------------------------
  if (chosen) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10">
        <button
          type="button"
          onClick={() => setChosen(null)}
          className="mb-4 text-sm text-gray-500 underline"
        >
          ← Choose a different plan
        </button>

        <form
          onSubmit={submitRequest}
          className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white/90">
            {chosen.name} · ₹{chosen.price_inr.toLocaleString("en-IN")}
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Pay by your usual method, then tell us how to find it. Our team confirms the
            payment and opens your account.
          </p>

          <label className="mt-6 block text-sm font-medium text-gray-700 dark:text-gray-300">
            How did you pay?
            <select
              value={method}
              onChange={(event) => setMethod(event.target.value as PaymentMethod)}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            >
              {PAYMENT_METHODS.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Payment reference
            <input
              type="text"
              required
              minLength={3}
              maxLength={120}
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              placeholder="UTR / transaction ID / cheque number"
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <span className="mt-1 block text-xs text-gray-500">
              This is what we match against our bank statement, so please copy it exactly.
            </span>
          </label>

          <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Anything else we should know? <span className="text-gray-400">(optional)</span>
            <textarea
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Paid from the company account, name may differ…"
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          {error ? (
            <p className="mt-4 text-sm text-error-500" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit for verification"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 text-center">
        {wasRejected ? (
          <>
            <p className="mb-2 text-sm font-medium text-error-500">
              Previous request not verified
            </p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white/90">
              We couldn&apos;t confirm that payment
            </h1>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
              {subscription?.review_note
                ? `Our team noted: “${subscription.review_note}”`
                : "Our team could not match the reference you gave."}{" "}
              Check the details and submit again.
            </p>
          </>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-brand-500">Account disabled</p>
            <h1 className="text-3xl font-semibold text-gray-900 dark:text-white/90">
              Choose a plan to enable your account
            </h1>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Pick a plan and tell us how you paid. Our team confirms the payment and
              opens your account — usually within a working day.
            </p>
          </>
        )}
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
              onClick={() => {
                setChosen(plan);
                setError("");
              }}
              className="mt-6 inline-flex w-full items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              Choose this plan
            </button>
          </div>
        ))}
      </div>
      {error ? <p className="mt-6 text-center text-sm text-error-500">{error}</p> : null}
    </div>
  );
}
