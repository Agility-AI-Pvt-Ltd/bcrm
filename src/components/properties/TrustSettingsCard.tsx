"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  getTrustSettings,
  getTrustSummary,
  saveTrustSettings,
  type TrustSettings,
  type TrustSummary,
} from "@/lib/properties";
import StateRatesCard from "./StateRatesCard";

const field =
  "h-10 w-28 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

/**
 * What a listing really costs, and how long a verification stays believable.
 *
 * Brokerage, GST and the verification window are the agency's own terms and live
 * here. Stamp duty and registration are set by each state, so they live in
 * `StateRatesCard`, one row per state. Nothing is assumed on an agency's behalf:
 * until a listing's state has a rate, its all-in reads "from ₹65 L" and says in
 * words what it left out.
 *
 * The stamp duty and registration boxes kept here are the fallback for the
 * default state — what an agency entered before per-state rates existed.
 */
export default function TrustSettingsCard() {
  const [settings, setSettings] = useState<TrustSettings | null>(null);
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [form, setForm] = useState({
    stamp_duty_pct: "",
    registration_pct: "",
    registration_cap: "",
    gst_pct: "",
    brokerage_pct: "",
    rent_brokerage_months: "",
    verification_valid_days: "30",
    default_state_code: "",
  });
  const [states, setStates] = useState<Array<{ code: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const apply = useCallback((next: TrustSettings) => {
    setSettings(next);
    setForm({
      stamp_duty_pct: next.stamp_duty_pct ?? "",
      registration_pct: next.registration_pct ?? "",
      registration_cap: next.registration_cap ?? "",
      gst_pct: next.gst_pct ?? "",
      brokerage_pct: next.brokerage_pct ?? "",
      rent_brokerage_months: next.rent_brokerage_months ?? "",
      verification_valid_days: String(next.verification_valid_days ?? 30),
      default_state_code: next.default_state_code ?? "",
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const [loaded, counts] = await Promise.all([getTrustSettings(), getTrustSummary()]);
      apply(loaded);
      setSummary(counts);
    } catch (err) {
      setError(failureText(err, "Could not load your cost settings."));
    }
  }, [apply]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      // An empty box means "we have not set this", which is a real answer — it is
      // what makes the all-in say what it is missing instead of inventing a rate.
      apply(
        await saveTrustSettings({
          stamp_duty_pct: form.stamp_duty_pct.trim() || null,
          registration_pct: form.registration_pct.trim() || null,
          registration_cap: form.registration_cap.trim() || null,
          gst_pct: form.gst_pct.trim() || null,
          brokerage_pct: form.brokerage_pct.trim() || null,
          rent_brokerage_months: form.rent_brokerage_months.trim() || null,
          verification_valid_days: Number(form.verification_valid_days) || 30,
          default_state_code: form.default_state_code || null,
        }),
      );
      setNotice("Saved.");
      void load();
    } catch (err) {
      setError(failureText(err, "Could not save those rates."));
    } finally {
      setSaving(false);
    }
  };

  const unverified = summary
    ? summary.never_verified + summary.verified_stale
    : 0;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Trust signals
      </h3>
      <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
        Every listing card shows when it was last verified, its RERA number, its
        carpet area and what it actually costs. Set the rates for the states you sell
        in and the all-in figure becomes exact; leave one blank and it says what it
        left out rather than guessing.
      </p>

      {summary ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-4">
          {[
            { label: "Verified", value: summary.verified_fresh, tone: "text-success-600" },
            { label: "Going stale", value: summary.verified_ageing, tone: "text-warning-600" },
            { label: "Needs verifying", value: unverified, tone: "text-error-500" },
            {
              label: "With RERA",
              value: summary.with_rera,
              tone: "text-gray-700 dark:text-gray-200",
            },
          ].map((tile) => (
            <div
              key={tile.label}
              className="rounded-xl border border-gray-200 px-3 py-2.5 dark:border-gray-800"
            >
              <dt className="text-xs text-gray-500 dark:text-gray-400">{tile.label}</dt>
              <dd className={`mt-0.5 text-xl font-semibold ${tile.tone}`}>{tile.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {settings?.missing.length ? (
        <p className="mt-4 rounded-xl bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
          All-in costs currently read “from …” because {settings.missing.join(", ")}{" "}
          {settings.missing.length === 1 ? "is" : "are"} not set.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-gray-500">Home state</span>
          <select
            value={form.default_state_code}
            onChange={(event) =>
              setForm((current) => ({ ...current, default_state_code: event.target.value }))
            }
            className={`${field} w-44`}
          >
            <option value="">Not set</option>
            {states.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-400">
            when a location names no state
          </span>
        </label>
        {[
          { key: "gst_pct" as const, label: "GST %", hint: "under construction" },
          { key: "brokerage_pct" as const, label: "Brokerage % (sale)", hint: "" },
          {
            key: "rent_brokerage_months" as const,
            label: "Brokerage (rent)",
            hint: "months of rent",
          },
          {
            key: "verification_valid_days" as const,
            label: "Verification lasts",
            hint: "days",
          },
        ].map((item) => (
          <label key={item.key} className="block text-sm">
            <span className="mb-1.5 block text-gray-500">{item.label}</span>
            <input
              value={form[item.key]}
              onChange={(event) =>
                setForm((current) => ({ ...current, [item.key]: event.target.value }))
              }
              inputMode="decimal"
              placeholder="—"
              className={field}
            />
            {item.hint ? (
              <span className="mt-1 block text-xs text-gray-400">{item.hint}</span>
            ) : null}
          </label>
        ))}
        <details className="w-full text-sm">
          <summary className="cursor-pointer text-gray-500">
            Fallback stamp duty &amp; registration
          </summary>
          <p className="mt-2 max-w-3xl text-xs text-gray-400">
            Used only for your home state when it has no row below, or when a
            location names no state. Never used for another state.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            {[
              { key: "stamp_duty_pct" as const, label: "Stamp duty %" },
              { key: "registration_pct" as const, label: "Registration %" },
              { key: "registration_cap" as const, label: "Registration cap ₹" },
            ].map((item) => (
              <label key={item.key} className="block">
                <span className="mb-1.5 block text-gray-500">{item.label}</span>
                <input
                  value={form[item.key]}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [item.key]: event.target.value }))
                  }
                  inputMode="decimal"
                  placeholder="—"
                  className={field}
                />
              </label>
            ))}
          </div>
        </details>
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>

      <StateRatesCard
        missingStates={settings?.states_missing_rates ?? []}
        stateNames={setStates}
        onChanged={() => void load()}
      />
    </section>
  );
}
