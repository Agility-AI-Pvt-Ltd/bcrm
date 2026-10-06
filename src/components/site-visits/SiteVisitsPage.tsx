"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError, failureText } from "@/lib/api";
import {
  createVisit,
  getVisitSlots,
  getVisits,
  type Visit,
  type VisitList,
  type VisitScope,
  type VisitSlot,
} from "@/lib/siteVisits";
import VisitCard from "./VisitCard";
import VisitSettingsPanel from "./VisitSettingsPanel";

const TABS: { scope: VisitScope; label: string }[] = [
  { scope: "today", label: "Today" },
  { scope: "upcoming", label: "Upcoming" },
  { scope: "needs_attention", label: "Needs attention" },
  { scope: "past", label: "Past" },
];

const EMPTY: Record<VisitScope, string> = {
  today: "No visits today.",
  upcoming: "No visits booked yet. The AI books them from WhatsApp, or add one below.",
  needs_attention: "Nothing waiting — every visit has a slot, a pin and an outcome.",
  past: "No past visits yet.",
  all: "No visits yet.",
};

const input =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

export default function SiteVisitsPage() {
  const [scope, setScope] = useState<VisitScope>("today");
  const [list, setList] = useState<VisitList | null>(null);
  const [slots, setSlots] = useState<VisitSlot[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ phone: "", name: "", slot: "", notes: "" });
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const [visits, free] = await Promise.all([getVisits(scope), getVisitSlots(24)]);
      if (!mounted.current) return;
      setList(visits);
      setSlots(free);
      setError("");
    } catch (err) {
      if (mounted.current) setError(failureText(err, "Could not load site visits."));
    }
  }, [scope]);

  // Refresh steadily: a check-in can arrive from WhatsApp while this is open, and
  // a broker watching this screen is usually waiting for exactly that.
  useEffect(() => {
    mounted.current = true;
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Swap one card in place, so an action does not reshuffle the list underfoot. */
  const onChanged = (next?: Visit) => {
    if (next && list) {
      setList({
        ...list,
        items: list.items.map((item) => (item.id === next.id ? next : item)),
      });
    }
    void load();
  };

  const add = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.phone.trim()) {
      setError("A phone number is needed to book a visit.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      await createVisit({
        customer_phone: form.phone.trim(),
        customer_name: form.name.trim() || null,
        slot_id: form.slot || null,
        notes: form.notes.trim() || null,
      });
      setForm({ phone: "", name: "", slot: "", notes: "" });
      setShowAdd(false);
      setNotice("Visit booked.");
      await load();
    } catch (err) {
      // A full slot comes back with free ones to use instead.
      const alternatives =
        err instanceof ApiError && err.details && typeof err.details === "object"
          ? ((err.details as { alternatives?: VisitSlot[] }).alternatives ?? [])
          : [];
      if (alternatives.length) setSlots(alternatives);
      setError(failureText(err, "Could not book that visit."));
    } finally {
      setAdding(false);
    }
  };

  const counts = list?.counts ?? {};

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Site visits</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              Every visit from slot to feedback: booked on WhatsApp or from a call, reminded the
              day before and two hours before with the location pin, checked in when they arrive,
              and reviewed afterwards.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowAdd((value) => !value)}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600"
            >
              {showAdd ? "Close" : "Book a visit"}
            </button>
            <button
              type="button"
              onClick={() => setShowSettings((value) => !value)}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            >
              {showSettings ? "Hide settings" : "Slots & reminders"}
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="tablist">
          {TABS.map((tab) => {
            const active = scope === tab.scope;
            const count = counts[tab.scope] ?? 0;
            return (
              <button
                key={tab.scope}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setScope(tab.scope)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? "bg-brand-500 text-white"
                    : "border border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                }`}
              >
                {tab.label}
                {count ? (
                  <span
                    className={`ml-2 rounded-full px-1.5 py-0.5 text-xs ${
                      active
                        ? "bg-white/20"
                        : tab.scope === "needs_attention"
                          ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-500"
                          : "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {error ? <p className="mt-4 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mt-4 text-sm text-success-600">{notice}</p> : null}

        {showAdd ? (
          <form
            onSubmit={add}
            className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-gray-100 p-4 dark:border-gray-800"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Phone
              </span>
              <input
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="+91 98xxxxxxxx"
                className={`${input} w-44`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Name
              </span>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                className={`${input} w-40`}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Slot
              </span>
              <select
                value={form.slot}
                onChange={(event) => setForm({ ...form, slot: event.target.value })}
                className={`${input} w-56`}
              >
                <option value="">No time yet</option>
                {slots.map((slot) => (
                  <option key={slot.slot_id} value={slot.slot_id}>
                    {slot.label} ({slot.free} free)
                  </option>
                ))}
              </select>
            </label>
            <label className="block grow">
              <span className="mb-1.5 block text-xs font-medium text-gray-500 dark:text-gray-400">
                Notes
              </span>
              <input
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                placeholder="Wants a corner flat"
                className={`${input} w-full`}
              />
            </label>
            <button
              type="submit"
              disabled={adding}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {adding ? "Booking…" : "Book"}
            </button>
          </form>
        ) : null}
      </section>

      {showSettings ? <VisitSettingsPanel onSaved={() => void load()} /> : null}

      {!list ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">{error ? "" : "Loading…"}</p>
      ) : list.items.length === 0 ? (
        <section className="rounded-2xl border border-dashed border-gray-300 p-8 text-center dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">{EMPTY[scope]}</p>
        </section>
      ) : (
        <ul className="space-y-4">
          {list.items.map((visit) => (
            <VisitCard key={visit.id} visit={visit} onChanged={onChanged} />
          ))}
        </ul>
      )}
    </div>
  );
}
