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

const field =
  "h-10 w-28 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

/** Rates an agency can start from. Entered, never applied automatically. */
const PRESETS: Array<{ label: string; rates: Record<string, string> }> = [
  { label: "Uttar Pradesh", rates: { stamp_duty_pct: "7", registration_pct: "1", registration_cap: "30000" } },
  { label: "Haryana", rates: { stamp_duty_pct: "7", registration_pct: "1", registration_cap: "50000" } },
  { label: "Delhi", rates: { stamp_duty_pct: "6", registration_pct: "1", registration_cap: "" } },
  { label: "Maharashtra", rates: { stamp_duty_pct: "6", registration_pct: "1", registration_cap: "30000" } },
  { label: "Karnataka", rates: { stamp_duty_pct: "5", registration_pct: "1", registration_cap: "" } },
];

/**
 * What a listing really costs, and how long a verification stays believable.
 *
 * Stamp duty and registration vary by state, by city, and in several states by the
 * buyer's gender. Nothing is assumed on an agency's behalf: until these are set,
 * every all-in cost on a card reads "from ₹65 L" and says in words what it left
 * out. The state buttons fill the form — they do not save, because the agency is
 * the one who knows which rate applies to its buyers.
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
  });
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
        }),
      );
      setNotice("Saved. Listing cards will show the full cost.");
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
        carpet area and what it actually costs. Enter your state&apos;s rates and the
        all-in figure becomes exact; leave them blank and it says what it left out
        rather than guessing.
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

      <div className="mt-5">
        <span className="mb-2 block text-sm text-gray-500">Start from a state</span>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setForm((current) => ({ ...current, ...preset.rates }))}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-brand-500 dark:border-gray-700 dark:text-gray-200"
            >
              {preset.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          These fill the form only. Check them against your own registrar before
          saving — several states charge women buyers 1% less, and city rates differ.
        </p>
      </div>

      <form onSubmit={onSubmit} className="mt-5 flex flex-wrap items-end gap-4">
        {[
          { key: "stamp_duty_pct" as const, label: "Stamp duty %", hint: "of agreement value" },
          { key: "registration_pct" as const, label: "Registration %", hint: "" },
          { key: "registration_cap" as const, label: "Registration cap ₹", hint: "if capped" },
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
        <button
          type="submit"
          disabled={saving}
          className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save rates"}
        </button>
      </form>
    </section>
  );
}
