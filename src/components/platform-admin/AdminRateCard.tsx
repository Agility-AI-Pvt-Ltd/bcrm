"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { failureText } from "@/lib/api";
import {
  listUsageRates,
  quantity,
  rupees,
  setUsageRate,
  suggestUsageRates,
  type RateSuggestion,
  type UsageRate,
} from "@/lib/adminApi";

/**
 * The rate card: what one unit of anything costs us.
 *
 * Two ways to fill it in, and the difference between them is the whole design.
 * A human types a figure off an invoice — that is the real one, and nothing on
 * this screen ever overwrites it on its own. Or the AI prices the whole card in
 * one click, which fills every box with an estimate and its reasoning and saves
 * nothing: the operator reads the numbers, then applies them.
 *
 * Suggestions are drafts, drawn in amber and never written until "Apply". These
 * figures become what the business believes it costs to serve a customer, and a
 * model's recollection of a price list is not something to let into that unseen.
 *
 * Lifted out of the spend screen so it can live on a page of its own as well.
 * One copy, two places — two copies of a price list is how a unit ends up priced
 * on one screen and unpriced on the other.
 */

/**
 * In the order an operator reconciles their invoices: the phone bill, the
 * Sarvam bill, the model bill, then WhatsApp. Grouping matters here because the
 * keys alone ("stt_minute") do not say which invoice they came from.
 */
const GROUPS: Array<{ kind: string; title: string; blurb: string }> = [
  {
    kind: "call",
    title: "AI calls — telephony",
    blurb:
      "What the phone provider charges per connected minute. Telephony only; the AI running during the call is priced below.",
  },
  {
    kind: "sarvam",
    title: "Sarvam voice",
    blurb:
      "Speech-to-text and text-to-speech during a call, both per connected minute — the only quantity the voice agent reports back.",
  },
  {
    kind: "llm",
    title: "AI text — per thousand tokens",
    blurb:
      "Input and output are priced separately, per model. Covers text the CRM generates; the model running inside a call is not metered per token.",
  },
  {
    kind: "whatsapp",
    title: "WhatsApp — per message",
    blurb: "Meta's price per conversation category.",
  },
  { kind: "storage", title: "Storage", blurb: "Per GB-month of stored media." },
];

type Props = {
  /** Called after a price changes, for a screen whose numbers depend on it. */
  onSaved?: () => void;
  /** Bumped by a parent that wants the card re-read. */
  refreshKey?: number;
  /** The card draws its own heading unless the page already has one. */
  heading?: boolean;
  /** Usage and cost per row. Off on the spend screen, which has its own. */
  detailed?: boolean;
};

const rateId = (rate: { kind: string; key: string }) => `${rate.kind}:${rate.key}`;

export default function AdminRateCard({
  onSaved,
  refreshKey = 0,
  heading = true,
  detailed = false,
}: Props) {
  const [rates, setRates] = useState<UsageRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  /** Keyed by `kind:key`. Present means the AI proposed a figure nobody applied. */
  const [draft, setDraft] = useState<Record<string, RateSuggestion>>({});
  const [notice, setNotice] = useState("");
  const [asking, setAsking] = useState(false);
  const [applying, setApplying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRates(await listUsageRates());
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load the rate card."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const save = useCallback(
    async (rate: UsageRate, amount: string) => {
      const saved = await setUsageRate({
        kind: rate.kind,
        key: rate.key,
        unit: rate.unit,
        // An empty box is not a zero. It records the unit as deliberately
        // unpriced, which the totals then report as unpriced rather than free.
        amount: amount.trim() === "" ? null : amount.trim(),
      });
      setRates((current) =>
        current.map((row) =>
          row.kind === saved.kind && row.key === saved.key ? { ...row, ...saved } : row,
        ),
      );
      setDraft((current) => {
        const next = { ...current };
        delete next[rateId(rate)];
        return next;
      });
      return saved;
    },
    [],
  );

  const price = async (rate: UsageRate, amount: string) => {
    setSaving(rateId(rate));
    setError("");
    try {
      await save(rate, amount);
      onSaved?.();
    } catch (err) {
      setError(failureText(err, "Could not save that rate."));
    } finally {
      setSaving("");
    }
  };

  /** One click: ask the model to price everything. Saves nothing. */
  const askAi = async () => {
    setAsking(true);
    setError("");
    setNotice("");
    try {
      const result = await suggestUsageRates();
      if (!result.available) {
        setNotice(
          "No AI model is configured on this deployment, so prices have to be typed in by hand.",
        );
        return;
      }
      const next: Record<string, RateSuggestion> = {};
      for (const item of result.items) next[rateId(item)] = item;
      setDraft(next);
      setNotice(
        result.items.length
          ? `${result.items.length} of ${result.asked} units priced. ${result.notice}`
          : "The model did not offer a price for any of these units. Nothing has changed.",
      );
    } catch (err) {
      setError(failureText(err, "Could not reach the model for a price estimate."));
    } finally {
      setAsking(false);
    }
  };

  /** The second click: write every proposed figure, through the normal route. */
  const applyAll = async () => {
    setApplying(true);
    setError("");
    let written = 0;
    try {
      for (const rate of rates) {
        const proposed = draft[rateId(rate)];
        if (!proposed) continue;
        await save(rate, proposed.amount);
        written += 1;
      }
      setNotice(
        written === 1 ? "1 price saved." : `${written} prices saved.`,
      );
      onSaved?.();
    } catch (err) {
      // Partial is honest: what was written is written, and the rest stay as
      // drafts to retry. Saying how far it got beats implying none of it landed.
      setError(
        `${failureText(err, "Could not save every rate.")} ${written} saved before stopping.`,
      );
    } finally {
      setApplying(false);
    }
  };

  const drafts = useMemo(() => Object.keys(draft).length, [draft]);
  const unpriced = rates.filter((rate) => rate.amount === null).length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {heading ? (
            <>
              <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
                What a unit costs
              </h2>
              <p className="mt-1 max-w-2xl text-xs text-gray-500 dark:text-gray-400">
                Set these from your own provider invoices. A price applies to usage from
                today onwards — anything already metered keeps the rate it was costed
                at, so last month&apos;s figures never move. Leave a box empty to record
                a unit as deliberately unpriced: its usage is still counted and reported
                as unpriced, never as free.
              </p>
            </>
          ) : null}
          {unpriced ? (
            <p className="mt-2 text-xs font-medium text-warning-600">
              {unpriced} unit{unpriced === 1 ? "" : "s"} unpriced — their usage is
              counted and reported as unpriced, never as free.
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => void askAi()}
            disabled={asking || applying}
            className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
          >
            {asking ? "Asking the model…" : "Price it with AI"}
          </button>
          {drafts ? (
            <button
              type="button"
              onClick={() => void applyAll()}
              disabled={applying}
              className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {applying ? "Saving…" : `Apply all ${drafts}`}
            </button>
          ) : null}
        </div>
      </div>

      {notice ? (
        <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
          <p>{notice}</p>
          {drafts ? (
            <p className="mt-1.5">
              Nothing is saved yet. Each estimate is shown in its box with the
              reasoning underneath — edit any of them, then press Apply.{" "}
              <button
                type="button"
                onClick={() => {
                  setDraft({});
                  setNotice("");
                }}
                className="underline"
              >
                Discard the estimates
              </button>
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {loading && rates.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">Loading the rate card…</p>
      ) : null}

      {GROUPS.map((group) => {
        const rows = rates.filter((rate) => rate.kind === group.kind);
        if (rows.length === 0) return null;
        return (
          <div key={group.kind} className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-500">
              {group.title}
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{group.blurb}</p>
            <ul className="mt-2 divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((rate) => {
                const proposed = draft[rateId(rate)];
                return (
                  <li
                    key={rateId(rate)}
                    className="flex flex-wrap items-start justify-between gap-3 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-800 dark:text-white/90">
                        {rate.key}
                        <span className="ml-2 text-xs font-normal text-gray-500">
                          per {rate.unit_label}
                        </span>
                      </p>
                      {rate.help ? (
                        <p className="mt-0.5 max-w-xl text-xs text-gray-500 dark:text-gray-400">
                          {rate.help}
                        </p>
                      ) : null}
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                        <span>
                          {rate.effective_from
                            ? `In force from ${rate.effective_from}`
                            : "Not priced yet"}
                        </span>
                        {detailed ? (
                          <span>
                            {/* What makes a price worth chasing an invoice for. */}
                            {quantity(rate.usage_quantity)} {rate.unit_label} in{" "}
                            {rate.usage_days} days
                            {rate.usage_amount !== null
                              ? ` · ${rupees(rate.usage_amount)}`
                              : Number(rate.usage_quantity) > 0
                                ? " · cost unknown"
                                : ""}
                          </span>
                        ) : null}
                      </p>
                      {proposed?.basis ? (
                        <p className="mt-1 max-w-xl text-xs text-amber-700 dark:text-amber-300">
                          AI: {proposed.basis}
                        </p>
                      ) : null}
                    </div>
                    <RateInput
                      key={`${rateId(rate)}:${rate.amount ?? ""}:${proposed?.amount ?? ""}`}
                      rate={rate}
                      proposed={proposed?.amount}
                      busy={saving === rateId(rate) || applying}
                      onSave={(amount) => void price(rate, amount)}
                    />
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}

/** How many units this deployment meters and nobody has priced. */
export function unpricedCount(rates: UsageRate[]): number {
  return rates.filter((rate) => rate.amount === null).length;
}

function RateInput({
  rate,
  proposed,
  busy,
  onSave,
}: {
  rate: UsageRate;
  /** An AI estimate filled in but not saved. Drawn in amber until it is. */
  proposed?: string;
  busy: boolean;
  onSave: (amount: string) => void;
}) {
  // Seeded once, from the rate this input was mounted for. The parent remounts it
  // on a new amount by including that amount in the key, which is why there is no
  // effect here syncing props into state — that pattern costs a cascading render
  // and gets the two out of step the moment a save is in flight.
  const [value, setValue] = useState(proposed ?? rate.amount ?? "");
  const stored = rate.amount ?? "";

  return (
    <div className="flex items-center gap-2">
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        inputMode="decimal"
        placeholder="not set"
        aria-label={`Price per ${rate.unit_label} for ${rate.key}`}
        className={`h-9 w-28 rounded-lg border bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:text-white/90 ${
          proposed !== undefined && value !== stored
            ? "border-amber-400 text-amber-800 dark:border-amber-500/60 dark:text-amber-200"
            : "border-gray-300 dark:border-gray-700"
        }`}
      />
      <button
        type="button"
        disabled={busy || value === stored}
        onClick={() => onSave(value)}
        className="h-9 rounded-lg bg-brand-500 px-3 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-40"
      >
        {busy ? "…" : "Save"}
      </button>
    </div>
  );
}
