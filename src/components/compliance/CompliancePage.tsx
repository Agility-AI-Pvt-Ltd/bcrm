"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  CATEGORY_LABEL,
  QUALITY_CHIP,
  QUALITY_LABEL,
  TABLE_LABEL,
  createDataRequest,
  dueLabel,
  fulfilRequest,
  getComplianceOverview,
  getHoldings,
  rupees,
  shortDate,
  type ComplianceOverview,
  type DataRequest,
  type Holdings,
} from "@/lib/compliance";

const input =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";
const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";
const heading = "text-base font-semibold text-gray-800 dark:text-white/90";
const muted = "text-sm text-gray-500 dark:text-gray-400";

/**
 * What this agency has to answer for, and what the product is enforcing on its behalf.
 *
 * Three rules hold this page together.
 *
 * Every regulatory figure is shown as a *default you can change*, with a line saying
 * so. These numbers came from a summary of the rules, not from the rules, and a screen
 * that presents a date or a price as settled law invites a broker to rely on it.
 *
 * Deletion is never one click from a WhatsApp keyword. A customer's "delete my data"
 * arrives here as a request with a due date — messaging to them has already stopped —
 * and an admin presses the button after seeing exactly what will go and what will stay.
 *
 * And nothing is ever shown as ₹0 when the answer is "we don't know". A category whose
 * price the agency has not given us is counted and left blank.
 */
export default function CompliancePage() {
  const [overview, setOverview] = useState<ComplianceOverview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lookup, setLookup] = useState("");
  const [holdings, setHoldings] = useState<Holdings | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState<DataRequest | null>(null);

  const load = useCallback(async () => {
    try {
      setOverview(await getComplianceOverview());
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load the compliance summary."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const onLookup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const phone = lookup.trim();
    if (!phone) return;
    setBusy(true);
    setError("");
    try {
      setHoldings(await getHoldings(phone));
    } catch (err) {
      setError(failureText(err, "Could not look that number up."));
    } finally {
      setBusy(false);
    }
  };

  const onRaise = async (kind: string) => {
    const phone = lookup.trim();
    if (!phone) return;
    setBusy(true);
    try {
      await createDataRequest({ phone, kind });
      setNotice(
        kind === "erasure"
          ? "Deletion request logged. Nothing has been deleted yet — approve it below."
          : "Access request logged. Use Download data to answer it.",
      );
      await load();
    } catch (err) {
      setError(failureText(err, "Could not log that request."));
    } finally {
      setBusy(false);
    }
  };

  const onFulfil = async (request: DataRequest) => {
    setBusy(true);
    setError("");
    try {
      const receipt = await fulfilRequest(request.id);
      setNotice(
        `Deleted ${receipt.deleted_total} record${receipt.deleted_total === 1 ? "" : "s"}` +
          (receipt.redacted_total
            ? `, and removed the customer's details from ${receipt.redacted_total} record${
                receipt.redacted_total === 1 ? "" : "s"
              } the agency has to keep.`
            : "."),
      );
      setConfirming(null);
      setHoldings(null);
      await load();
    } catch (err) {
      setError(failureText(err, "Could not complete that deletion."));
    } finally {
      setBusy(false);
    }
  };

  if (error && !overview) {
    return (
      <div className={card}>
        <p className="text-sm text-error-500">{error}</p>
      </div>
    );
  }
  if (!overview) return null;

  const { consent, messaging, rules, open_requests: open } = overview;
  const quality = messaging.quality;

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Compliance
        </h1>
        <p className={muted}>
          What customers were told, what they have asked for, and what your WhatsApp
          number is costing and earning in reputation.
        </p>
      </header>

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

      {overview.warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-500"
        >
          {warning}
        </div>
      ))}

      {/* --- what people were told ------------------------------------- */}
      <section className={card}>
        <h2 className={heading}>Consent</h2>
        <p className={muted}>
          The first message every customer gets says who holds their details, what for,
          and how to stop. It is stored word for word, so what each person was told can
          be shown later.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Figure label="People told" value={consent.notice_given} />
          <Figure label="Asked us to stop" value={consent.withdrawn} />
          <Figure label="Records held" value={consent.records} />
        </div>
      </section>

      {/* --- requests --------------------------------------------------- */}
      <section className={card}>
        <h2 className={heading}>Customer data requests</h2>
        <p className={muted}>
          A customer who replies DELETE stops getting messages immediately. The deletion
          itself is yours to approve — it cannot be undone, so it is never done on one
          unverified message.
        </p>

        {open.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing waiting.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {open.map((request) => (
              <li
                key={request.id}
                className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                      {request.kind === "erasure" ? "Delete my data" : "Send me my data"}
                      {request.phone ? ` — ${request.phone}` : ""}
                    </p>
                    <p className={muted}>
                      Asked {shortDate(request.received_at)} via {request.channel} ·{" "}
                      {dueLabel(request.due_at)}
                    </p>
                    {request.request_text ? (
                      <p className="mt-1 text-sm italic text-gray-500 dark:text-gray-400">
                        “{request.request_text}”
                      </p>
                    ) : null}
                  </div>
                  {request.kind === "erasure" ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setConfirming(request)}
                      className="h-9 rounded-lg bg-error-500 px-3 text-sm font-medium text-white disabled:opacity-50"
                    >
                      Review and delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setLookup(request.phone || "");
                        setHoldings(null);
                      }}
                      className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium dark:border-gray-700 dark:text-white/90"
                    >
                      Look up their data
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {overview.recent_requests.length ? (
          <div className="mt-5">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              Already answered
            </p>
            <ul className="mt-2 space-y-1">
              {overview.recent_requests.map((request) => (
                <li key={request.id} className={muted}>
                  {request.kind === "erasure" ? "Deleted" : "Data sent"} —{" "}
                  {shortDate(request.completed_at)}
                  {typeof request.outcome?.deleted_total === "number"
                    ? `, ${request.outcome.deleted_total} records removed`
                    : ""}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* --- look up one person ---------------------------------------- */}
      <section className={card}>
        <h2 className={heading}>Look up a customer</h2>
        <p className={muted}>
          What you hold on one number, before anything is deleted.
        </p>
        <form onSubmit={onLookup} className="mt-4 flex flex-wrap items-center gap-2">
          <input
            className={input}
            placeholder="+91 98765 43210"
            value={lookup}
            onChange={(event) => setLookup(event.target.value)}
          />
          <button
            type="submit"
            disabled={busy || !lookup.trim()}
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Look up
          </button>
          <button
            type="button"
            disabled={busy || !lookup.trim()}
            onClick={() => void onRaise("access")}
            className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-gray-700 dark:text-white/90"
          >
            Log an access request
          </button>
          <button
            type="button"
            disabled={busy || !lookup.trim()}
            onClick={() => void onRaise("erasure")}
            className="h-10 rounded-lg border border-error-300 px-4 text-sm font-medium text-error-600 disabled:opacity-50 dark:border-error-500/40 dark:text-error-500"
          >
            Log a deletion request
          </button>
        </form>

        {holdings ? (
          holdings.found ? (
            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  Would be deleted ({holdings.total})
                </p>
                <ul className="mt-2 space-y-1">
                  {Object.entries(holdings.rows).map(([table, count]) => (
                    <li key={table} className={muted}>
                      {TABLE_LABEL[table] || table} — {count}
                    </li>
                  ))}
                </ul>
              </div>
              {holdings.kept_total ? (
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    Would be kept, with their name and number removed (
                    {holdings.kept_total})
                  </p>
                  <ul className="mt-2 space-y-1">
                    {Object.entries(holdings.kept).map(([table, count]) => (
                      <li key={table} className={muted}>
                        {TABLE_LABEL[table] || table} — {count}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {holdings.kept_reason}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
              Nothing on file for that number.
            </p>
          )
        ) : null}
      </section>

      {/* --- WhatsApp cost and standing --------------------------------- */}
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={heading}>WhatsApp this month</h2>
            <p className={muted}>
              What the messages cost, and what they are doing to your number.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              QUALITY_CHIP[quality.quality] || QUALITY_CHIP.UNKNOWN
            }`}
          >
            Number quality: {QUALITY_LABEL[quality.quality] || quality.quality}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="Messages sent" value={messaging.spend.messages} />
          <Figure label="Spend" value={rupees(messaging.spend.spend)} />
          <Figure
            label="Free replies left"
            value={messaging.spend.service_allowance_left}
          />
          <Figure label="Blocked or reported" value={quality.blocks} />
        </div>

        {messaging.spend.unpriced_messages ? (
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {messaging.spend.unpriced_messages} of these are in categories whose price
            you have not given us, so they are counted but not costed. The total above
            is only what we can price.
          </p>
        ) : null}

        <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500 dark:bg-white/[0.03] dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Messages</th>
                <th className="px-4 py-2 font-medium">Rate</th>
                <th className="px-4 py-2 font-medium">Spend</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(messaging.spend.categories).map(([name, item]) => (
                <tr key={name} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="px-4 py-2 text-gray-800 dark:text-white/90">
                    {CATEGORY_LABEL[name] || name}
                  </td>
                  <td className="px-4 py-2">{item.messages}</td>
                  <td className="px-4 py-2">{item.priced ? rupees(item.rate) : "—"}</td>
                  <td className="px-4 py-2">{item.priced ? rupees(item.spend) : "—"}</td>
                </tr>
              ))}
              {Object.keys(messaging.spend.categories).length === 0 ? (
                <tr>
                  <td className={`px-4 py-3 ${muted}`} colSpan={4}>
                    No messages sent yet this month.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {Object.keys(quality.blocks_by_user).length ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              Blocks by whoever sent the campaign
            </p>
            <ul className="mt-2 space-y-1">
              {Object.entries(quality.blocks_by_user).map(([who, count]) => (
                <li key={who} className={muted}>
                  {who === "unattributed" ? "Not from a campaign" : who} — {count}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      {/* --- the figures the product enforces --------------------------- */}
      <section className={card}>
        <h2 className={heading}>What the product is enforcing</h2>
        <p className={muted}>
          These are defaults, not legal advice. Each one is a setting — confirm the
          current figure with your own advisor and change it if it is wrong for you.
        </p>
        <ul className="mt-4 space-y-3">
          {rules.map((rule) => (
            <li
              key={rule.key}
              className="rounded-xl border border-gray-200 p-4 dark:border-gray-800"
            >
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {rule.label}: {rule.value}
              </p>
              {rule.note ? <p className={muted}>{rule.note}</p> : null}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          {overview.processor_statement}
        </p>
      </section>

      {/* --- the irreversible step -------------------------------------- */}
      {confirming ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 dark:bg-gray-900">
            <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">
              Delete this customer&apos;s data?
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              This cannot be undone. Their contact, conversation, visits and calls are
              removed. Commission registrations and billing lines are kept with their
              name and number taken out, because deleting those would change what you
              can claim and what you were charged.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(null)}
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium dark:border-gray-700 dark:text-white/90"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void onFulfil(confirming)}
                className="h-10 rounded-lg bg-error-500 px-4 text-sm font-medium text-white disabled:opacity-50"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-lg font-semibold text-gray-800 dark:text-white/90">
        {value}
      </p>
    </div>
  );
}
