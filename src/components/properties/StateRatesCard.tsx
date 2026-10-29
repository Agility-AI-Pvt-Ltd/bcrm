"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { failureText } from "@/lib/api";
import {
  applyStatePresets,
  createStateRate,
  deleteStateRate,
  listStatePresets,
  listStateRates,
  updateStateRate,
  type StatePreset,
  type StateRate,
} from "@/lib/properties";

const input =
  "h-9 w-full rounded-lg border border-gray-300 bg-transparent px-2.5 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

const CONFIDENCE_TONE: Record<StatePreset["confidence"], string> = {
  high: "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500",
  medium: "bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300",
  low: "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500",
};

type Row = {
  key: string;
  stateCode: string;
  stateName: string;
  city: string | null;
  preset: StatePreset | null;
  current: StateRate | null;
  scheduled: StateRate | null;
};

type Draft = {
  stamp_duty_pct: string;
  stamp_duty_female_pct: string;
  registration_pct: string;
  registration_cap: string;
  effective_from: string;
  source_url: string;
  notes: string;
};

const rowKey = (code: string, city: string | null) => `${code}|${city ?? ""}`;
const today = () => new Date().toISOString().slice(0, 10);
const titleCase = (text: string) => text.replace(/\b\w/g, (c) => c.toUpperCase());
const pct = (value: string | null) => (value == null ? "—" : `${Number(value)}%`);
const rupees = (value: string | null) =>
  value == null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;
const hasFigures = (preset: StatePreset | null) =>
  !!preset &&
  [preset.stamp_duty_pct, preset.registration_pct].some((value) => value != null);

function draftFrom(source: StateRate | StatePreset | null): Draft {
  return {
    stamp_duty_pct: source?.stamp_duty_pct ?? "",
    stamp_duty_female_pct: source?.stamp_duty_female_pct ?? "",
    registration_pct: source?.registration_pct ?? "",
    registration_cap: source?.registration_cap ?? "",
    effective_from:
      source && "effective_from" in source ? source.effective_from : today(),
    source_url: source?.source_url ?? "",
    notes: source?.notes ?? "",
  };
}

/**
 * Stamp duty and registration, state by state.
 *
 * Every state and union territory is listed. Where a published rate could be
 * found it is offered as a suggestion, with its source and how sure we are of it;
 * nothing is used on a card until somebody applies it. Where no reliable single
 * figure exists — a slab system, or sources that disagree — the row says so and
 * the agency enters its own. Until a listing's state has a rate, its all-in cost
 * names stamp duty as excluded rather than borrowing another state's figure.
 */
export default function StateRatesCard({
  missingStates,
  stateNames,
  onChanged,
}: {
  /** States that have sale listings but no rate yet. */
  missingStates: string[];
  stateNames: (names: Array<{ code: string; name: string }>) => void;
  onChanged: () => void;
}) {
  const [presets, setPresets] = useState<StatePreset[]>([]);
  const [rates, setRates] = useState<StateRate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(draftFrom(null));
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<"all" | "set" | "unset">("all");
  const [newCity, setNewCity] = useState({ state_code: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [loadedPresets, loadedRates] = await Promise.all([
        listStatePresets(),
        listStateRates(),
      ]);
      setPresets(loadedPresets);
      setRates(loadedRates);
      const seen = new Map<string, string>();
      loadedPresets.forEach((preset) => seen.set(preset.state_code, preset.state_name));
      stateNames(
        [...seen].map(([code, name]) => ({ code, name })).sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
    } catch (err) {
      setError(failureText(err, "Could not load state rates."));
    }
  }, [stateNames]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const refresh = async (message: string) => {
    setNotice(message);
    await load();
    onChanged();
  };

  const rows = useMemo<Row[]>(() => {
    const byKey = new Map<string, Row>();
    const ensure = (code: string, name: string, city: string | null) => {
      const key = rowKey(code, city);
      if (!byKey.has(key)) {
        byKey.set(key, {
          key,
          stateCode: code,
          stateName: name,
          city,
          preset: null,
          current: null,
          scheduled: null,
        });
      }
      return byKey.get(key)!;
    };
    presets.forEach((preset) => {
      ensure(preset.state_code, preset.state_name, preset.city).preset = preset;
    });
    const now = today();
    rates.forEach((rate) => {
      const row = ensure(rate.state_code, rate.state_name ?? rate.state_code, rate.city);
      if (rate.in_effect) row.current = rate;
      else if (rate.effective_from > now) {
        if (!row.scheduled || rate.effective_from < row.scheduled.effective_from) {
          row.scheduled = rate;
        }
      }
    });
    return [...byKey.values()].sort(
      (a, b) =>
        a.stateName.localeCompare(b.stateName) ||
        (a.city ?? "").localeCompare(b.city ?? ""),
    );
  }, [presets, rates]);

  const visible = rows.filter((row) => {
    const text = `${row.stateName} ${row.stateCode} ${row.city ?? ""}`.toLowerCase();
    if (query && !text.includes(query.trim().toLowerCase())) return false;
    if (show === "set") return !!row.current;
    if (show === "unset") return !row.current;
    return true;
  });

  const missing = new Set(missingStates);
  const setCount = rows.filter((row) => row.current && !row.city).length;
  const stateCount = rows.filter((row) => !row.city).length;

  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const applySelected = async () => {
    const choices = rows
      .filter((row) => selected.has(row.key))
      .map((row) => ({ state_code: row.stateCode, city: row.city }));
    if (!choices.length) return;
    setBusy(true);
    setError("");
    try {
      const result = await applyStatePresets(choices);
      setSelected(new Set());
      const skipped = result.skipped.length
        ? ` Skipped ${result.skipped.length}: ${result.skipped.map((s) => s.reason).join(" ")}`
        : "";
      await refresh(`Applied ${result.applied.length} suggested rate(s).${skipped}`);
    } catch (err) {
      setError(failureText(err, "Could not apply those rates."));
    } finally {
      setBusy(false);
    }
  };

  const startEditing = (row: Row) => {
    setEditing(row.key);
    setDraft(draftFrom(row.current ?? row.preset));
    if (!row.current) setDraft((d) => ({ ...d, effective_from: today() }));
  };

  const save = async (event: FormEvent<HTMLFormElement>, row: Row) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const fields = {
      stamp_duty_pct: draft.stamp_duty_pct.trim() || null,
      stamp_duty_female_pct: draft.stamp_duty_female_pct.trim() || null,
      registration_pct: draft.registration_pct.trim() || null,
      registration_cap: draft.registration_cap.trim() || null,
      source_url: draft.source_url.trim() || null,
      notes: draft.notes.trim() || null,
    };
    try {
      if (row.current && draft.effective_from === row.current.effective_from) {
        // Same date: a correction to the rate already in use.
        await updateStateRate(row.current.id, fields);
      } else {
        // A new date: a rate change. The old row stays as a record of what was quoted.
        await createStateRate({
          ...fields,
          state_code: row.stateCode,
          city: row.city,
          effective_from: draft.effective_from || today(),
        });
      }
      setEditing(null);
      await refresh(`Saved ${row.city ? titleCase(row.city) : row.stateName}.`);
    } catch (err) {
      setError(failureText(err, "Could not save that rate."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Row) => {
    if (!row.current) return;
    const place = row.city ? titleCase(row.city) : row.stateName;
    if (!window.confirm(`Remove the rate in use for ${place}?`)) return;
    setBusy(true);
    setError("");
    try {
      await deleteStateRate(row.current.id);
      setEditing(null);
      await refresh(`Removed ${place}. Its listings will show stamp duty as excluded.`);
    } catch (err) {
      setError(failureText(err, "Could not remove that rate."));
    } finally {
      setBusy(false);
    }
  };

  const addCity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = newCity.state_code;
    const city = newCity.city.trim().toLowerCase();
    if (!code || !city) return;
    // A city with no row yet is shown as `pendingCity` below, and only stored once
    // its rate is saved.
    setQuery(city);
    setShow("all");
    setEditing(rowKey(code, city));
    setDraft(draftFrom(null));
    setNewCity({ state_code: "", city: "" });
  };

  const pendingCity =
    editing && !rows.some((row) => row.key === editing)
      ? (() => {
          const [code, city] = editing.split("|");
          return {
            key: editing,
            stateCode: code,
            stateName: rows.find((row) => row.stateCode === code)?.stateName ?? code,
            city: city || null,
            preset: null,
            current: null,
            scheduled: null,
          } satisfies Row;
        })()
      : null;
  const shown = pendingCity ? [pendingCity, ...visible] : visible;

  return (
    <div className="mt-6 border-t border-gray-200 pt-5 dark:border-gray-800">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">
            Stamp duty &amp; registration by state
          </h4>
          <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
            {setCount} of {stateCount} states and union territories set. Each listing
            uses its own state&apos;s rate, and a city rate overrides its state&apos;s. Tick
            suggested rates to apply them, or enter your own where none is suggested.
          </p>
        </div>
        <button
          type="button"
          onClick={applySelected}
          disabled={busy || selected.size === 0}
          className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          Apply {selected.size || ""} selected
        </button>
      </div>

      {missingStates.length ? (
        <p className="mt-3 rounded-xl bg-warning-50 px-3 py-2.5 text-sm text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
          You have sale listings in{" "}
          {missingStates
            .map((code) => rows.find((row) => row.stateCode === code)?.stateName ?? code)
            .join(", ")}{" "}
          with no rate set. Their all-in costs leave stamp duty and registration out.
        </p>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a state or city"
          className={`${input} max-w-xs`}
        />
        <div className="flex rounded-lg border border-gray-300 p-0.5 text-xs dark:border-gray-700">
          {(
            [
              ["all", "All"],
              ["set", "In use"],
              ["unset", "Not set"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setShow(value)}
              className={`rounded-md px-3 py-1.5 font-medium ${
                show === value
                  ? "bg-brand-500 text-white"
                  : "text-gray-600 dark:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <form onSubmit={addCity} className="ml-auto flex items-center gap-2">
          <select
            value={newCity.state_code}
            onChange={(event) =>
              setNewCity((current) => ({ ...current, state_code: event.target.value }))
            }
            className={`${input} w-40`}
          >
            <option value="">State…</option>
            {rows
              .filter((row) => !row.city)
              .map((row) => (
                <option key={row.stateCode} value={row.stateCode}>
                  {row.stateName}
                </option>
              ))}
          </select>
          <input
            value={newCity.city}
            onChange={(event) =>
              setNewCity((current) => ({ ...current, city: event.target.value }))
            }
            placeholder="City"
            className={`${input} w-32`}
          />
          <button
            type="submit"
            disabled={!newCity.state_code || !newCity.city.trim()}
            className="h-9 rounded-lg border border-gray-300 px-3 text-xs font-medium text-gray-700 hover:border-brand-500 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
          >
            Add city rate
          </button>
        </form>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="text-xs text-gray-500 dark:text-gray-400">
            <tr className="border-b border-gray-200 dark:border-gray-800">
              <th className="w-8 py-2" />
              <th className="py-2 pr-3 font-medium">State / city</th>
              <th className="py-2 pr-3 font-medium">Stamp duty</th>
              <th className="py-2 pr-3 font-medium">Women</th>
              <th className="py-2 pr-3 font-medium">Registration</th>
              <th className="py-2 pr-3 font-medium">Reg. cap</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const shownRate = row.current ?? row.preset;
              const canPick = !row.current && hasFigures(row.preset);
              const muted = row.current ? "" : "text-gray-400 dark:text-gray-500";
              return (
                <RowView
                  key={row.key}
                  row={row}
                  muted={muted}
                  shownRate={shownRate}
                  canPick={canPick}
                  picked={selected.has(row.key)}
                  needed={missing.has(row.stateCode) && !row.current && !row.city}
                  editing={editing === row.key}
                  busy={busy}
                  draft={draft}
                  setDraft={setDraft}
                  onToggle={() => toggle(row.key)}
                  onEdit={() => startEditing(row)}
                  onCancel={() => setEditing(null)}
                  onSave={(event) => save(event, row)}
                  onRemove={() => remove(row)}
                />
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Suggested rates were compiled from published sources in October 2026 and are
        not applied until you choose them. Check them with your sub-registrar: many
        states charge less on cheaper homes or more above a value, and a blank means no
        single reliable figure was found.
      </p>
    </div>
  );
}

function RowView({
  row,
  muted,
  shownRate,
  canPick,
  picked,
  needed,
  editing,
  busy,
  draft,
  setDraft,
  onToggle,
  onEdit,
  onCancel,
  onSave,
  onRemove,
}: {
  row: Row;
  muted: string;
  shownRate: StateRate | StatePreset | null;
  canPick: boolean;
  picked: boolean;
  needed: boolean;
  editing: boolean;
  busy: boolean;
  draft: Draft;
  setDraft: React.Dispatch<React.SetStateAction<Draft>>;
  onToggle: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (event: FormEvent<HTMLFormElement>) => void;
  onRemove: () => void;
}) {
  let status: React.ReactNode;
  if (row.current) {
    status = (
      <span className="text-success-600">
        In use since {row.current.effective_from}
      </span>
    );
  } else if (hasFigures(row.preset)) {
    status = (
      <span className="flex items-center gap-1.5">
        <span className="text-gray-500">Suggested</span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] ${CONFIDENCE_TONE[row.preset!.confidence]}`}
        >
          {row.preset!.confidence}
        </span>
      </span>
    );
  } else {
    status = <span className="text-warning-600">Enter your rate</span>;
  }

  return (
    <>
      <tr
        className={`border-b border-gray-100 dark:border-gray-800/60 ${
          needed ? "bg-warning-50/50 dark:bg-warning-500/5" : ""
        }`}
      >
        <td className="py-2">
          <input
            type="checkbox"
            checked={picked}
            disabled={!canPick}
            onChange={onToggle}
            aria-label={`Apply suggested rate for ${row.city ?? row.stateName}`}
          />
        </td>
        <td className="py-2 pr-3 text-gray-800 dark:text-white/90">
          {row.city ? (
            <span className="pl-3 text-gray-600 dark:text-gray-300">
              ↳ {titleCase(row.city)}
            </span>
          ) : (
            row.stateName
          )}
          {needed ? (
            <span className="ml-2 text-xs text-warning-600">listings need this</span>
          ) : null}
          {row.scheduled ? (
            <span className="block text-xs text-gray-400">
              {pct(row.scheduled.stamp_duty_pct)} from {row.scheduled.effective_from}
            </span>
          ) : null}
        </td>
        <td className={`py-2 pr-3 ${muted}`}>{pct(shownRate?.stamp_duty_pct ?? null)}</td>
        <td className={`py-2 pr-3 ${muted}`}>
          {pct(shownRate?.stamp_duty_female_pct ?? null)}
        </td>
        <td className={`py-2 pr-3 ${muted}`}>{pct(shownRate?.registration_pct ?? null)}</td>
        <td className={`py-2 pr-3 ${muted}`}>
          {rupees(shownRate?.registration_cap ?? null)}
        </td>
        <td className="py-2 pr-3 text-xs">{status}</td>
        <td className="py-2 text-right">
          <button
            type="button"
            onClick={editing ? onCancel : onEdit}
            className="text-xs font-medium text-brand-500 hover:text-brand-600"
          >
            {editing ? "Close" : row.current ? "Edit" : "Enter"}
          </button>
        </td>
      </tr>
      {editing ? (
        <tr className="border-b border-gray-100 dark:border-gray-800/60">
          <td />
          <td colSpan={7} className="py-3">
            <form onSubmit={onSave} className="grid gap-3 sm:grid-cols-4">
              {(
                [
                  ["stamp_duty_pct", "Stamp duty %"],
                  ["stamp_duty_female_pct", "Women's stamp duty %"],
                  ["registration_pct", "Registration %"],
                  ["registration_cap", "Registration cap ₹"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block text-xs">
                  <span className="mb-1 block text-gray-500">{label}</span>
                  <input
                    value={draft[key]}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, [key]: event.target.value }))
                    }
                    inputMode="decimal"
                    placeholder="—"
                    className={input}
                  />
                </label>
              ))}
              <label className="block text-xs">
                <span className="mb-1 block text-gray-500">In use from</span>
                <input
                  type="date"
                  value={draft.effective_from}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, effective_from: event.target.value }))
                  }
                  className={input}
                />
              </label>
              <label className="block text-xs sm:col-span-3">
                <span className="mb-1 block text-gray-500">Source link</span>
                <input
                  value={draft.source_url}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, source_url: event.target.value }))
                  }
                  placeholder="https://…"
                  className={input}
                />
              </label>
              <label className="block text-xs sm:col-span-4">
                <span className="mb-1 block text-gray-500">Notes</span>
                <input
                  value={draft.notes}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, notes: event.target.value }))
                  }
                  className={input}
                />
              </label>
              {row.preset && !row.current ? (
                <p className="text-xs text-gray-500 sm:col-span-4 dark:text-gray-400">
                  {row.preset.notes}{" "}
                  <a
                    href={row.preset.source_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-500 hover:underline"
                  >
                    Source
                  </a>
                </p>
              ) : null}
              <p className="text-xs text-gray-400 sm:col-span-4">
                Leave a box empty if you do not know it — the card will say it is
                excluded. A later date keeps today&apos;s rate until then.
              </p>
              <div className="flex gap-2 sm:col-span-4">
                <button
                  type="submit"
                  disabled={busy}
                  className="h-9 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Save rate"}
                </button>
                {row.current ? (
                  <button
                    type="button"
                    onClick={onRemove}
                    disabled={busy}
                    className="h-9 rounded-lg border border-gray-300 px-4 text-sm text-error-500 hover:border-error-500 disabled:opacity-50 dark:border-gray-700"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </form>
          </td>
        </tr>
      ) : null}
    </>
  );
}
