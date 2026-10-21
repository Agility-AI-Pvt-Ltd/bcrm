"use client";

/**
 * Schedule Visit, Update Stage, Reassign, Opt Out — beside the chat.
 *
 * Each opens a small form in place, under the buttons, rather than a modal:
 * the agent is reading the conversation while deciding, and a dialog over it
 * hides the thing they are deciding about.
 *
 * Visits book through the same endpoint as the Site Visits page, against the
 * same free slots, so a time offered here is one the booking accepts. The other
 * three act on the CRM contact behind the chat (created from the chat's number
 * if it has none yet).
 */

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  optOutConversation,
  reassignConversation,
  setConversationStage,
  type CustomerProfile,
} from "@/lib/inbox";
import { CUSTOMER_STAGES } from "@/lib/outreach";
import {
  createVisit,
  getVisitSlots,
  getVisitTeam,
  type TeamMember,
  type VisitSlot,
} from "@/lib/siteVisits";

type Panel = "visit" | "stage" | "assign" | "optout" | null;

type Listing = { id: string; title: string; location?: string | null };

const button =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
const active = "border-brand-500 ring-1 ring-brand-500/30";
const primary =
  "rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50";
const quiet =
  "rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300";
const field =
  "h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

function listingsFrom(qualification: Record<string, unknown>): Listing[] {
  const raw = qualification.last_listings;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .filter((item) => typeof item.id === "string" && item.id)
    .map((item) => ({
      id: String(item.id),
      title: String(item.title || "Listing"),
      location: item.location ? String(item.location) : null,
    }));
}

export default function QuickActions({
  conversationId,
  profile,
  qualification,
  onChanged,
}: {
  conversationId: string;
  profile: CustomerProfile;
  qualification: Record<string, unknown>;
  /** Re-read the chat and the list after a change. */
  onChanged: () => void;
}) {
  const [panel, setPanel] = useState<Panel>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Visit
  const [slots, setSlots] = useState<VisitSlot[]>([]);
  const [slotId, setSlotId] = useState("");
  const listings = listingsFrom(qualification);
  const selected = typeof qualification.selected_property_id === "string"
    ? qualification.selected_property_id
    : "";
  const [propertyId, setPropertyId] = useState(selected);
  const [notes, setNotes] = useState("");

  // Assign
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [assignee, setAssignee] = useState("");

  // Opt out
  const [reason, setReason] = useState("");

  // A different chat is a different customer: close whatever was open.
  useEffect(() => {
    setPanel(null);
    setError("");
    setNotice("");
    setPropertyId(selected);
  }, [conversationId, selected]);

  const fail = (err: unknown, fallback: string) =>
    setError(err instanceof ApiError ? err.message : fallback);

  const open = useCallback(
    async (next: Panel) => {
      setError("");
      setNotice("");
      if (panel === next) {
        setPanel(null);
        return;
      }
      setPanel(next);
      try {
        if (next === "visit") {
          const free = await getVisitSlots(40);
          setSlots(free);
          setSlotId(free[0]?.slot_id ?? "");
        }
        if (next === "assign" && !team.length) {
          setTeam(await getVisitTeam());
        }
      } catch (err) {
        fail(err, "Could not load the options.");
      }
    },
    [panel, team.length],
  );

  const done = (message: string) => {
    setNotice(message);
    setPanel(null);
    onChanged();
  };

  const bookVisit = async () => {
    const phone = profile.phone || profile.whatsapp;
    if (!phone || !slotId) return;
    setBusy(true);
    setError("");
    try {
      await createVisit({
        customer_phone: phone,
        customer_name: profile.name,
        slot_id: slotId,
        property_id: propertyId || null,
        notes: notes.trim() || null,
        contact_id: profile.contact_id,
        conversation_id: conversationId,
      });
      const label = slots.find((slot) => slot.slot_id === slotId)?.label ?? "the chosen time";
      setNotes("");
      done(`Visit booked for ${label}.`);
    } catch (err) {
      // Taken since the list loaded: say so and show what is free now.
      fail(err, "Could not book that time.");
      try {
        const free = await getVisitSlots(40);
        setSlots(free);
        setSlotId(free[0]?.slot_id ?? "");
      } catch {
        /* the error above already explains */
      }
    } finally {
      setBusy(false);
    }
  };

  const changeStage = async (stage: string) => {
    setBusy(true);
    setError("");
    try {
      done((await setConversationStage(conversationId, stage)).message);
    } catch (err) {
      fail(err, "Could not change the stage.");
    } finally {
      setBusy(false);
    }
  };

  const reassign = async () => {
    setBusy(true);
    setError("");
    try {
      done((await reassignConversation(conversationId, assignee || null)).message);
    } catch (err) {
      fail(err, "Could not reassign.");
    } finally {
      setBusy(false);
    }
  };

  const optOut = async () => {
    setBusy(true);
    setError("");
    try {
      done((await optOutConversation(conversationId, reason.trim())).message);
      setReason("");
    } catch (err) {
      fail(err, "Could not opt this customer out.");
    } finally {
      setBusy(false);
    }
  };

  const name = profile.name || profile.phone || "this customer";
  const phone = profile.phone || profile.whatsapp;

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => void open("visit")}
          disabled={!phone}
          title={phone ? "Book a site visit in a free slot" : "This customer has no phone number"}
          className={`${button} ${panel === "visit" ? active : ""}`}
        >
          Schedule Visit
        </button>
        <button
          type="button"
          onClick={() => void open("stage")}
          className={`${button} ${panel === "stage" ? active : ""}`}
        >
          Update Stage
        </button>
        <button
          type="button"
          onClick={() => void open("assign")}
          className={`${button} ${panel === "assign" ? active : ""}`}
        >
          Reassign
        </button>
        <button
          type="button"
          onClick={() => void open("optout")}
          disabled={profile.outreach_paused}
          title={profile.outreach_paused ? "Already opted out — no automatic messages" : undefined}
          className={`rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-error-600 shadow-xs transition hover:bg-error-50 disabled:cursor-not-allowed disabled:text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-error-400 dark:hover:bg-error-900/20 ${
            panel === "optout" ? "border-error-400" : ""
          }`}
        >
          {profile.outreach_paused ? "Opted out" : "Opt Out"}
        </button>
      </div>

      {panel ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900/60">
          {panel === "visit" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-white/90">
                Book a site visit for {name}
              </p>
              {slots.length ? (
                <label className="block text-[11px] text-gray-500">
                  Time
                  <select
                    value={slotId}
                    onChange={(event) => setSlotId(event.target.value)}
                    className={`${field} mt-1`}
                  >
                    {slots.map((slot) => (
                      <option key={slot.slot_id} value={slot.slot_id}>
                        {slot.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="text-xs text-gray-500">
                  No free visit slots in the coming days. Change visiting hours on the Site
                  Visits page.
                </p>
              )}
              <label className="block text-[11px] text-gray-500">
                Property
                <select
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  className={`${field} mt-1`}
                >
                  <option value="">No specific property</option>
                  {listings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {listing.title}
                      {listing.location ? ` · ${listing.location}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-gray-500">
                Note (optional)
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="e.g. coming with family"
                  className={`${field} mt-1`}
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy || !slotId}
                  onClick={() => void bookVisit()}
                  className={primary}
                >
                  {busy ? "Booking…" : "Book visit"}
                </button>
                <button type="button" onClick={() => setPanel(null)} className={quiet}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {panel === "stage" ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-gray-800 dark:text-white/90">
                Move {name} to
              </p>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOMER_STAGES.map((stage) => {
                  const current = stage === profile.customer_stage;
                  return (
                    <button
                      key={stage}
                      type="button"
                      disabled={busy || current}
                      onClick={() => void changeStage(stage)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                        current
                          ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10"
                          : "border-gray-200 text-gray-600 hover:border-brand-300 dark:border-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {stage}
                      {current ? " · now" : ""}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {panel === "assign" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-white/90">
                Assign {name} to
              </p>
              <select
                value={assignee}
                onChange={(event) => setAssignee(event.target.value)}
                className={field}
              >
                <option value="">Nobody (unassigned)</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                    {member.name === profile.assigned_to ? " · current" : ""}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => void reassign()} className={primary}>
                  {busy ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setPanel(null)} className={quiet}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {panel === "optout" ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-800 dark:text-white/90">
                Stop all automatic messages to {name}?
              </p>
              <p className="text-[11px] leading-relaxed text-gray-500">
                Campaigns, follow-ups and nurture messages stop, and their consent is recorded
                as withdrawn — the same as them replying STOP. If they write to you, the AI still
                answers.
              </p>
              <input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Reason (optional), e.g. asked on the phone"
                className={field}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void optOut()}
                  className="rounded-lg bg-error-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-error-600 disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Opt out"}
                </button>
                <button type="button" onClick={() => setPanel(null)} className={quiet}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-2 text-xs text-error-500">{error}</p> : null}
      {notice ? <p className="mt-2 text-xs text-success-600">{notice}</p> : null}
    </div>
  );
}
