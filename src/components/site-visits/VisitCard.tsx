"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  askVisitFeedback,
  cancelVisit,
  checkInVisit,
  clearVisitReview,
  completeVisit,
  confirmVisit,
  formatWhen,
  getVisit,
  INTEREST_LABELS,
  NEXT_STEP_LABELS,
  noShowVisit,
  rescheduleVisit,
  saveVisitFeedback,
  sendVisitPin,
  sendVisitReminder,
  setVisitPin,
  SOURCE_LABELS,
  TONE_CHIP,
  TONE_TEXT,
  type Visit,
  type VisitDetail,
} from "@/lib/siteVisits";

const btn =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]";
const primary =
  "rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50";
const danger =
  "rounded-lg border border-error-200 px-3 py-1.5 text-sm font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 dark:border-error-500/30 dark:hover:bg-error-500/10";
const input =
  "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";
const labelText = "text-xs font-medium text-gray-500 dark:text-gray-400";

/** A labelled fact. The point of this screen is that nothing is hidden. */
function Fact({
  label,
  value,
  tone,
  children,
}: {
  label: string;
  value?: string | null;
  tone?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className={labelText}>{label}</dt>
      <dd className={`mt-0.5 truncate text-sm ${tone ?? "text-gray-800 dark:text-white/90"}`}>
        {children ?? (value || "—")}
      </dd>
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="tabular-nums" aria-label={`${rating} out of 5`}>
      <span className="text-warning-500">{"★".repeat(rating)}</span>
      <span className="text-gray-300 dark:text-gray-600">{"★".repeat(5 - rating)}</span>
      <span className="ml-1 text-gray-500 dark:text-gray-400">{rating}/5</span>
    </span>
  );
}

export default function VisitCard({
  visit,
  onChanged,
}: {
  visit: Visit;
  onChanged: (next?: Visit) => void;
}) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<VisitDetail | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [slot, setSlot] = useState("");
  const [pin, setPin] = useState("");
  const [feedback, setFeedback] = useState({
    rating: 0,
    interest: "",
    next_step: "",
    liked: "",
    concerns: "",
  });

  const current: Visit = detail ?? visit;

  const load = useCallback(async () => {
    try {
      const next = await getVisit(visit.id);
      setDetail(next);
      setPin(next.pin_map_url ?? "");
      setFeedback((state) => ({
        ...state,
        rating: next.feedback_rating ?? 0,
        interest: next.feedback_interest ?? "",
        next_step: next.feedback_next_step ?? "",
        liked: next.feedback_liked ?? "",
        concerns: next.feedback_concerns ?? "",
      }));
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load this visit."));
    }
  }, [visit.id]);

  useEffect(() => {
    if (open && !detail) void load();
  }, [open, detail, load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  /** Run one action, then refresh this card and the list counts. */
  const run = async (key: string, task: () => Promise<VisitDetail | void>, done?: string) => {
    setBusy(key);
    setError("");
    try {
      const next = (await task()) as VisitDetail | undefined;
      if (next) {
        setDetail(next);
        onChanged(next);
      } else {
        await load();
        onChanged();
      }
      if (done) setNotice(done);
    } catch (err) {
      setError(failureText(err, "That did not work."));
    } finally {
      setBusy("");
    }
  };

  const chip = TONE_CHIP[current.view.tone];
  const pinReady = current.pin_latitude !== null || Boolean(current.pin_map_url);

  return (
    <li className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] lg:p-5">
      {/* --- the line a broker scans ------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-800 dark:text-white/90">
              {current.customer_name || current.customer_phone}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${chip}`}>
              {current.view.label}
            </span>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
              {SOURCE_LABELS[current.source] ?? current.source}
            </span>
            {current.reschedule_count > 0 ? (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                moved {current.reschedule_count}×
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">{current.view.when_label}</span>
            {current.property_title ? ` · ${current.property_title}` : ""}
            {current.property_location ? (
              <span className="text-gray-500 dark:text-gray-400"> · {current.property_location}</span>
            ) : null}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {current.customer_phone}
            {current.conversation_id ? (
              <>
                {" · "}
                <Link
                  href={`/messages?conversation=${current.conversation_id}`}
                  className="text-brand-500 hover:underline"
                >
                  open chat
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((value) => !value)} className={btn}>
          {open ? "Hide" : "Manage"}
        </button>
      </div>

      {/* --- what it is waiting for -------------------------------------- */}
      {current.needs_review ? (
        <div className="mt-3 rounded-xl border border-warning-200 bg-warning-50 p-3 dark:border-warning-500/30 dark:bg-warning-500/10">
          <p className="text-sm font-medium text-warning-700 dark:text-warning-500">
            From an AI call — please check: {current.review_reason}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              className={primary}
              disabled={busy !== ""}
              onClick={() => void run("confirm", () => confirmVisit(current.id), "Visit confirmed.")}
            >
              Confirm this
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy !== ""}
              onClick={() =>
                void run("clear", () => clearVisitReview(current.id), "Marked as checked.")
              }
            >
              Checked, not a visit
            </button>
          </div>
        </div>
      ) : null}

      {current.view.outstanding.length && !current.needs_review ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {current.view.outstanding.map((item) => (
            <li
              key={item}
              className="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      {/* --- the five things, always visible ----------------------------- */}
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Fact label="Slot" value={current.view.when_label}>
          <span>
            {current.view.when_label}
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              {current.duration_minutes} min · {current.timezone}
            </span>
          </span>
        </Fact>
        <Fact label="Reminders">
          <span className="text-xs">
            <span className={current.reminder_24h_sent_at ? "text-success-600" : "text-gray-500"}>
              {current.reminder_24h_sent_at ? "✓" : "○"} day before
            </span>
            <span className="block">
              <span className={current.reminder_2h_sent_at ? "text-success-600" : "text-gray-500"}>
                {current.reminder_2h_sent_at ? "✓" : "○"} 2 hours before
              </span>
            </span>
          </span>
        </Fact>
        <Fact label="Location pin">
          {pinReady ? (
            <span className="text-xs">
              {current.pin_map_url ? (
                <a
                  href={current.pin_map_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-brand-500 hover:underline"
                >
                  {current.pin_label || "Open map"}
                </a>
              ) : (
                current.pin_label || "Set"
              )}
              <span className="block text-gray-500 dark:text-gray-400">
                {current.pin_sent_at ? `sent ${formatWhen(current.pin_sent_at)}` : "not sent yet"}
              </span>
            </span>
          ) : (
            <span className="text-xs text-warning-600">Not set</span>
          )}
        </Fact>
        <Fact label="Check-in">
          {current.checked_in_at ? (
            <span className="text-xs text-success-600">
              {formatWhen(current.checked_in_at, current.timezone)}
              <span className="block text-gray-500 dark:text-gray-400">
                via {SOURCE_LABELS[(current.check_in_source as keyof typeof SOURCE_LABELS) || "manual"]}
                {current.check_in_latitude !== null ? " · location shared" : ""}
              </span>
            </span>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">Not yet</span>
          )}
        </Fact>
        <Fact label="Feedback">
          {current.feedback_at ? (
            <span className="text-xs">
              {current.feedback_rating ? <Stars rating={current.feedback_rating} /> : "Given"}
              <span className="block text-gray-500 dark:text-gray-400">
                {current.feedback_interest ? INTEREST_LABELS[current.feedback_interest] : ""}
                {current.feedback_next_step
                  ? ` · ${NEXT_STEP_LABELS[current.feedback_next_step] ?? current.feedback_next_step}`
                  : ""}
              </span>
            </span>
          ) : (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {current.feedback_requested_at ? "Asked, waiting" : "Not asked yet"}
            </span>
          )}
        </Fact>
      </dl>

      {current.feedback_liked || current.feedback_concerns ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {current.feedback_liked ? (
            <p className="rounded-lg bg-success-50 px-3 py-2 text-xs text-success-700 dark:bg-success-500/10 dark:text-success-500">
              Liked: {current.feedback_liked}
            </p>
          ) : null}
          {current.feedback_concerns ? (
            <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-500">
              Worried about: {current.feedback_concerns}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      {/* --- everything a broker can do about it -------------------------- */}
      {open ? (
        <div className="mt-4 space-y-4 border-t border-gray-100 pt-4 dark:border-gray-800">
          <div className="flex flex-wrap gap-2">
            {current.status === "Requested" ? (
              <button
                type="button"
                className={primary}
                disabled={busy !== ""}
                onClick={() => void run("confirm", () => confirmVisit(current.id), "Confirmed.")}
              >
                Confirm
              </button>
            ) : null}
            {!current.checked_in_at && current.status !== "Cancelled" ? (
              <button
                type="button"
                className={btn}
                disabled={busy !== ""}
                onClick={() => void run("checkin", () => checkInVisit(current.id), "Marked arrived.")}
              >
                Mark arrived
              </button>
            ) : null}
            {current.status !== "Completed" && current.status !== "Cancelled" ? (
              <>
                <button
                  type="button"
                  className={btn}
                  disabled={busy !== ""}
                  onClick={() => void run("complete", () => completeVisit(current.id), "Closed as visited.")}
                >
                  Visited
                </button>
                <button
                  type="button"
                  className={btn}
                  disabled={busy !== ""}
                  onClick={() => void run("noshow", () => noShowVisit(current.id), "Marked as no-show.")}
                >
                  No show
                </button>
              </>
            ) : null}
            <button
              type="button"
              className={btn}
              disabled={busy !== "" || !pinReady}
              title={pinReady ? "" : "Add a pin first"}
              onClick={() =>
                void run("sendpin", async () => {
                  const outcome = await sendVisitPin(current.id);
                  setNotice(outcome.sent ? "Location sent on WhatsApp." : `Not sent — ${outcome.reason}`);
                })
              }
            >
              Send location
            </button>
            <button
              type="button"
              className={btn}
              disabled={busy !== ""}
              onClick={() =>
                void run("remind", async () => {
                  const outcome = await sendVisitReminder(current.id, "2h");
                  setNotice(outcome.sent ? "Reminder sent." : `Not sent — ${outcome.reason}`);
                })
              }
            >
              Send reminder
            </button>
            {!current.feedback_at ? (
              <button
                type="button"
                className={btn}
                disabled={busy !== ""}
                onClick={() =>
                  void run("askfb", async () => {
                    const outcome = await askVisitFeedback(current.id);
                    setNotice(
                      outcome.sent ? "Asked them how it went." : `Not asked — ${outcome.reason}`,
                    );
                  })
                }
              >
                Ask for feedback
              </button>
            ) : null}
            {current.status !== "Cancelled" ? (
              <button
                type="button"
                className={danger}
                disabled={busy !== ""}
                onClick={() => void run("cancel", () => cancelVisit(current.id), "Cancelled.")}
              >
                Cancel visit
              </button>
            ) : null}
          </div>

          {/* --- move it ------------------------------------------------- */}
          <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            <p className={labelText}>Move to another slot</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select
                aria-label="New slot"
                value={slot}
                onChange={(event) => setSlot(event.target.value)}
                className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90"
              >
                <option value="">Choose a free slot…</option>
                {(detail?.slots ?? []).map((item) => (
                  <option key={item.slot_id} value={item.slot_id}>
                    {item.label} ({item.free} free)
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={primary}
                disabled={busy !== "" || !slot}
                onClick={() =>
                  void run("move", () => rescheduleVisit(current.id, slot), "Moved — reminders reset.")
                }
              >
                Move
              </button>
            </div>
          </div>

          {/* --- the pin ------------------------------------------------- */}
          <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            <p className={labelText}>Location pin</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Paste a Google Maps link, or 28.6139, 77.2090"
                className={`${input} sm:w-96`}
              />
              <button
                type="button"
                className={primary}
                disabled={busy !== "" || !pin.trim()}
                onClick={() =>
                  void run(
                    "pin",
                    () =>
                      setVisitPin(current.id, {
                        link: pin.trim(),
                        label: current.property_title ?? undefined,
                        address: current.property_location ?? undefined,
                      }),
                    "Pin saved, and remembered for this property.",
                  )
                }
              >
                Save pin
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
              A shortened maps.app.goo.gl link has no coordinates in it — open it in Maps and copy
              the full link.
            </p>
          </div>

          {/* --- feedback ------------------------------------------------ */}
          <div className="rounded-xl border border-gray-100 p-3 dark:border-gray-800">
            <p className={labelText}>Feedback after the visit</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`${value} out of 5`}
                  onClick={() => setFeedback({ ...feedback, rating: value })}
                  className={`h-9 w-9 rounded-lg border text-sm font-medium ${
                    feedback.rating >= value
                      ? "border-warning-400 bg-warning-50 text-warning-700 dark:bg-warning-500/15"
                      : "border-gray-300 text-gray-500 dark:border-gray-700"
                  }`}
                >
                  {value}
                </button>
              ))}
              <select
                aria-label="Interest"
                value={feedback.interest}
                onChange={(event) => setFeedback({ ...feedback, interest: event.target.value })}
                className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90"
              >
                <option value="">Interest…</option>
                {Object.entries(INTEREST_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
              <select
                aria-label="Next step"
                value={feedback.next_step}
                onChange={(event) => setFeedback({ ...feedback, next_step: event.target.value })}
                className="h-9 rounded-lg border border-gray-300 bg-transparent px-2 text-sm dark:border-gray-700 dark:text-white/90"
              >
                <option value="">Next step…</option>
                {Object.entries(NEXT_STEP_LABELS).map(([value, text]) => (
                  <option key={value} value={value}>
                    {text}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <input
                value={feedback.liked}
                onChange={(event) => setFeedback({ ...feedback, liked: event.target.value })}
                placeholder="What they liked"
                className={input}
              />
              <input
                value={feedback.concerns}
                onChange={(event) => setFeedback({ ...feedback, concerns: event.target.value })}
                placeholder="What worried them"
                className={input}
              />
            </div>
            <button
              type="button"
              className={`${primary} mt-2`}
              disabled={
                busy !== "" ||
                (!feedback.rating && !feedback.interest && !feedback.liked && !feedback.concerns)
              }
              onClick={() =>
                void run(
                  "fb",
                  () =>
                    saveVisitFeedback(current.id, {
                      rating: feedback.rating || null,
                      interest: feedback.interest || null,
                      next_step: feedback.next_step || null,
                      liked: feedback.liked || null,
                      concerns: feedback.concerns || null,
                    }),
                  "Feedback saved.",
                )
              }
            >
              Save feedback
            </button>
          </div>

          {/* --- the history, with the words it came from ----------------- */}
          <div>
            <p className={labelText}>History</p>
            <ol className="mt-2 space-y-2">
              {(detail?.timeline ?? []).map((event) => (
                <li key={event.id} className="text-xs text-gray-600 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">
                    {formatWhen(event.created_at, current.timezone)}
                  </span>{" "}
                  <span className={TONE_TEXT.info}>
                    {SOURCE_LABELS[event.source] ?? event.source}
                  </span>{" "}
                  — {event.detail || event.kind.replace(/_/g, " ")}
                  {event.evidence ? (
                    <span className="mt-0.5 block border-l-2 border-gray-200 pl-2 italic text-gray-500 dark:border-gray-700 dark:text-gray-400">
                      “{event.evidence}”
                    </span>
                  ) : null}
                </li>
              ))}
              {!detail?.timeline.length ? (
                <li className="text-xs text-gray-500">Nothing recorded yet.</li>
              ) : null}
            </ol>
          </div>
        </div>
      ) : null}
    </li>
  );
}
