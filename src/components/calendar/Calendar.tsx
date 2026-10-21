"use client";

/**
 * The visit calendar.
 *
 * This page used to be the TailAdmin starter: FullCalendar with three events
 * hard-coded in a `useEffect` — "Event Conf.", "Meeting", "Workshop" — held in
 * React state, no API, no persistence. A broker could open its modal and "book"
 * something that vanished on refresh, directly under a Site Visits page that
 * was entirely real.
 *
 * It is now the same visits as that page, drawn on a grid. Three decisions:
 *
 * **It cannot invent an appointment.** The create-event modal is gone. A visit
 * belongs to a customer, a property and a slot, and a calendar that can conjure
 * one with none of those attached is how orphaned rows appear. Visits are booked
 * from a conversation, a lead, or the Site Visits page.
 *
 * **Background shading is free capacity**, read from the same slot generator the
 * booking engine uses. This is the thing a list cannot show and the reason to
 * have a calendar at all: a half-empty Tuesday beside a full Saturday is a
 * decision, and seeing it is what makes the decision happen.
 *
 * **Dragging reschedules, after a confirmation.** Not because dragging is risky
 * in itself but because the existing reschedule endpoint messages the customer,
 * and a side effect that reaches a person should never be a side effect of a
 * mouse slip.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  DatesSetArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import { failureText } from "@/lib/api";
import {
  getVisitSlots,
  getVisitsInRange,
  rescheduleVisit,
  type Visit,
  type VisitSlot,
  type VisitStatus,
} from "@/lib/siteVisits";
import VisitCard from "@/components/site-visits/VisitCard";
import CalendarConnectPanel from "./CalendarConnectPanel";

/** One colour per status, reusing the vocabulary the visit cards already use. */
const TONE: Record<VisitStatus, { bg: string; border: string }> = {
  Requested: { bg: "#f59e0b", border: "#d97706" },
  Confirmed: { bg: "#3641f5", border: "#2a35c7" },
  "Checked in": { bg: "#12b76a", border: "#039855" },
  Completed: { bg: "#667085", border: "#475467" },
  "No show": { bg: "#f04438", border: "#d92d20" },
  Cancelled: { bg: "#98a2b3", border: "#667085" },
};

const LEGEND: VisitStatus[] = [
  "Requested",
  "Confirmed",
  "Checked in",
  "Completed",
  "No show",
  "Cancelled",
];

/** Slots whose start is inside the grid get a shaded block behind the events. */
function capacityEvents(slots: VisitSlot[]): EventInput[] {
  return slots
    .filter((slot) => slot.free > 0)
    .map((slot) => ({
      id: `free-${slot.slot_id}`,
      start: slot.start,
      end: slot.end,
      display: "background",
      title: `${slot.free} free`,
      // Deliberately pale: this is the floor of the grid, not something to read
      // before the visits on top of it.
      backgroundColor: "rgba(18, 183, 106, 0.10)",
    }));
}

export default function Calendar() {
  const calendarRef = useRef<FullCalendar>(null);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [slots, setSlots] = useState<VisitSlot[]>([]);
  // Named `range`, not `window`: a state variable called window shadows the
  // global inside this component, and the next person to need it would not
  // find out until runtime.
  const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);
  const [selected, setSelected] = useState<Visit | null>(null);
  const [pending, setPending] = useState<{ visit: Visit; slot: VisitSlot; revert: () => void } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showCapacity, setShowCapacity] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!range) return;
    try {
      const [inWindow, free] = await Promise.all([
        getVisitsInRange(range.start, range.end),
        // Slots are generated forward from now, so a past month simply has
        // none — which is correct: there is no capacity to offer in the past.
        getVisitSlots(500, 60).catch(() => [] as VisitSlot[]),
      ]);
      setVisits(inWindow.items);
      setSlots(free);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load the visits for these dates."));
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const events = useMemo<EventInput[]>(() => {
    const booked: EventInput[] = visits
      .filter((visit) => visit.scheduled_at)
      .map((visit) => {
        const tone = TONE[visit.status] || TONE.Confirmed;
        const who = visit.customer_name || visit.customer_phone;
        return {
          id: visit.id,
          title: visit.property_title ? `${who} · ${visit.property_title}` : who,
          start: visit.scheduled_at as string,
          end: visit.slot_end || undefined,
          backgroundColor: tone.bg,
          borderColor: tone.border,
          // A cancelled visit is drawn, because a broker looking at the week
          // needs to know the slot is free again — but faded, so it does not
          // read as something to turn up to.
          classNames: visit.status === "Cancelled" ? ["opacity-50", "line-through"] : [],
          // Only a visit that has not happened yet can be dragged somewhere else.
          editable: visit.status === "Requested" || visit.status === "Confirmed",
          extendedProps: { visit },
        };
      });
    return showCapacity ? [...capacityEvents(slots), ...booked] : booked;
  }, [visits, slots, showCapacity]);

  const onEventClick = (info: EventClickArg) => {
    const visit = info.event.extendedProps?.visit as Visit | undefined;
    if (visit) setSelected(visit);
  };

  /**
   * A drop asks rather than acts.
   *
   * The visit is matched to a generated slot id, because the booking engine only
   * accepts slots from its own grid — dropping something at 3:17pm is not a
   * reschedule, it is a miss, and saying so beats inventing a slot that the
   * rules do not allow.
   */
  const onEventDrop = (info: EventDropArg) => {
    const visit = info.event.extendedProps?.visit as Visit | undefined;
    const start = info.event.start;
    if (!visit || !start) {
      info.revert();
      return;
    }
    const target = slots.find(
      (slot) => Math.abs(new Date(slot.start).getTime() - start.getTime()) < 60_000,
    );
    if (!target) {
      info.revert();
      setError(
        "That is not one of your bookable slots. Drop it on a shaded slot, or widen your visiting hours in Site Visits settings.",
      );
      return;
    }
    setError("");
    setPending({ visit, slot: target, revert: info.revert });
  };

  const confirmMove = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      const moved = await rescheduleVisit(pending.visit.id, pending.slot.slot_id);
      // Say what actually happened to the customer — told on WhatsApp, or
      // outside the 24-hour window and needing a call — not what we hoped.
      setNotice(
        `Moved to ${pending.slot.label}. ${
          moved.customer_notice?.message ?? "Let the customer know the new time."
        }`,
      );
      setPending(null);
      await load();
    } catch (err) {
      pending.revert();
      setError(failureText(err, "Could not move that visit."));
      setPending(null);
    } finally {
      setBusy(false);
    }
  };

  const cancelMove = () => {
    pending?.revert();
    setPending(null);
  };

  return (
    <div className="space-y-5">
      <CalendarConnectPanel onNotice={setNotice} />

      {notice ? (
        <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-500">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-500">
          {error}
        </div>
      ) : null}

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-3">
            {LEGEND.map((status) => (
              <span key={status} className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: TONE[status].bg }}
                />
                {status}
              </span>
            ))}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={showCapacity}
              onChange={(event) => setShowCapacity(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 dark:border-gray-700"
            />
            Shade free slots
          </label>
        </div>

        <div className="visit-calendar p-2 sm:p-4">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "dayGridMonth,timeGridWeek,timeGridDay",
            }}
            buttonText={{ today: "Today", month: "Month", week: "Week", day: "Day" }}
            events={events}
            eventClick={onEventClick}
            eventDrop={onEventDrop}
            editable
            // Resizing would change a visit's duration, which the slot grid owns
            // — a visit is one slot long by the agency's own rules.
            eventResizableFromStart={false}
            eventDurationEditable={false}
            selectable={false}
            nowIndicator
            height="auto"
            slotMinTime="07:00:00"
            slotMaxTime="22:00:00"
            firstDay={1}
            datesSet={(arg: DatesSetArg) => setRange({ start: arg.start, end: arg.end })}
            eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          />
        </div>
      </div>

      {visits.length === 0 && !error ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No visits in this window. They are booked from a WhatsApp conversation, from an
          AI call, or by hand on the Site Visits page.
        </p>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
          <div className="mt-10 w-full max-w-2xl">
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                Close
              </button>
            </div>
            {/* The same card the Site Visits page uses, so there is one place a
                visit is read and acted on. */}
            <VisitCard
              visit={selected}
              onChanged={(next) => {
                setSelected(next ?? null);
                void load();
              }}
            />
          </div>
        </div>
      ) : null}

      {pending ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Move this visit?
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {pending.visit.customer_name || pending.visit.customer_phone} moves to{" "}
              <span className="font-medium text-gray-800 dark:text-white/90">
                {pending.slot.label}
              </span>
              . They will be told on WhatsApp straight away, so this is not a silent
              change.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={cancelMove}
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium dark:border-gray-700 dark:text-white/90"
              >
                Keep it where it was
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmMove()}
                className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                {busy ? "Moving…" : "Move and tell them"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
