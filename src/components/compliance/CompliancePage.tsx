"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { failureText } from "@/lib/api";
import {
  CATEGORY_LABEL,
  DUE_CLASS,
  QUALITY_CHIP,
  QUALITY_LABEL,
  TABLE_LABEL,
  answerAccessRequest,
  createDataRequest,
  downloadJson,
  dueLabel,
  dueTone,
  exportPerson,
  fulfilRequest,
  getComplianceOverview,
  getHoldings,
  refreshMessagingHealth,
  rupees,
  safeFilePart,
  sendLimitLabel,
  shortDate,
  whenLabel,
  type ComplianceOverview,
  type DataRequest,
  type Holdings,
  type MessagingHealth,
} from "@/lib/compliance";
import ConsentPeoplePanel from "./ConsentPeoplePanel";
import ConfirmDeleteDialog from "./ConfirmDeleteDialog";
import RetentionPanel from "./RetentionPanel";
import Toast from "./Toast";

const input =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";
const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";
const heading = "text-base font-semibold text-gray-800 dark:text-white/90";
const muted = "text-sm text-gray-500 dark:text-gray-400";

type Tab = "requests" | "people" | "whatsapp" | "rules";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "requests", label: "Requests" },
  { key: "people", label: "People" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "rules", label: "Rules" },
];

/**
 * What this agency has to answer for, and what the product is enforcing on its behalf.
 *
 * Four rules hold this page together.
 *
 * **The thing with a deadline comes first.** A data request has a legal answer-by
 * date; everything else here is reference. So requests are their own tab, it is
 * the tab the page opens on while any are outstanding, and each one wears how
 * late it is rather than stating a date and leaving the arithmetic to the reader.
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
  // Null until somebody picks one, so the opening tab can follow the work rather
  // than being decided before the page knows whether there is any.
  const [tab, setTab] = useState<Tab | null>(null);
  // Set only by the refresh button, so the panel repaints from Meta's answer
  // without a second load of the whole page.
  const [refreshed, setRefreshed] = useState<MessagingHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const lookupBox = useRef<HTMLElement>(null);
  const [scrollNonce, setScrollNonce] = useState(0);

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

  /** Put a number in the lookup box, show it, and bring it into view.
   *
   *  The consent list and the lookup used to be two separate cards: picking a
   *  person filled a box that was off-screen, and nothing moved. */
  const openLookup = useCallback((phone: string) => {
    setTab("people");
    setLookup(phone);
    setHoldings(null);
    // A nonce rather than scrolling here: this is often called from the Requests
    // tab, where the lookup card is not mounted yet, so there is nothing to scroll
    // to until React has committed the tab switch.
    setScrollNonce((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!scrollNonce) return;
    lookupBox.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [scrollNonce]);

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
          ? "Deletion request logged. Nothing has been deleted yet — approve it under Requests."
          : "Access request logged. Use Download data to answer it.",
      );
      await load();
    } catch (err) {
      setError(failureText(err, "Could not log that request."));
    } finally {
      setBusy(false);
    }
  };

  const onDownload = async (request: DataRequest) => {
    if (!request.phone) return;
    // Pin the tab: this is only reachable from Requests, and answering the
    // last one would otherwise flip the derived default to People while the
    // person is still reading the result.
    setTab("requests");
    setBusy(true);
    setError("");
    try {
      const data = await exportPerson(request.phone);
      downloadJson(data, `data-export-${safeFilePart(request.phone)}.json`);
      await answerAccessRequest(request.id);
      setNotice("Data file downloaded and the request marked answered.");
      await load();
    } catch (err) {
      setError(failureText(err, "Could not build that export."));
    } finally {
      setBusy(false);
    }
  };

  const onDownloadLookup = async () => {
    const phone = lookup.trim();
    if (!phone) return;
    setBusy(true);
    setError("");
    try {
      const data = await exportPerson(phone);
      downloadJson(data, `data-export-${safeFilePart(phone)}.json`);
      setNotice("Data file downloaded.");
    } catch (err) {
      setError(failureText(err, "Could not build that export."));
    } finally {
      setBusy(false);
    }
  };

  const onCheckNumber = async () => {
    setChecking(true);
    setError("");
    try {
      const result = await refreshMessagingHealth();
      setRefreshed(result.health);
      if (!result.reached) {
        setError(
          result.error === "whatsapp_not_connected"
            ? "WhatsApp is not connected, so Meta has nothing to tell us about the number yet."
            : "Meta would not tell us the number's rating just now. Nothing has changed.",
        );
      } else {
        setNotice(
          result.changed
            ? "Meta reports a different rating — the panel below is updated."
            : "Checked with Meta. The rating has not changed.",
        );
      }
    } catch (err) {
      setError(failureText(err, "Could not reach Meta to check the number."));
    } finally {
      setChecking(false);
    }
  };

  const onFulfil = async (request: DataRequest) => {
    // Pin the tab: this is only reachable from Requests, and answering the
    // last one would otherwise flip the derived default to People while the
    // person is still reading the result.
    setTab("requests");
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
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium dark:border-gray-700 dark:text-white/90"
        >
          Try again
        </button>
      </div>
    );
  }
  if (!overview) return <Skeleton />;

  const { consent, rules, open_requests: open } = overview;
  const messaging = refreshed ?? overview.messaging;
  const quality = messaging.quality;
  const sendLimit = sendLimitLabel(quality.messaging_limit);
  // Derived, not stored: the page opens on the work when there is work, and on
  // the list people spend most of their time in when there is not.
  const active: Tab = tab ?? (open.length ? "requests" : "people");

  return (
    <div className="space-y-5">
      {/* Bleeds to the page gutter (p-4 md:p-6 on the admin layout) so the blur
          covers the full width as content scrolls under it. The negative margins
          must track that padding; they are not arbitrary. */}
      <header className="sticky top-0 z-30 -mx-4 -mt-4 bg-gray-50/90 px-4 pb-3 pt-4 backdrop-blur dark:bg-gray-900/90 md:-mx-6 md:-mt-6 md:px-6 md:pt-6">
        <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          Compliance
        </h1>
        <p className={muted}>
          What customers were told, what they have asked for, and what your WhatsApp
          number is costing and earning in reputation.
        </p>
        <nav
          aria-label="Compliance sections"
          className="mt-3 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 p-1 dark:border-gray-800"
        >
          {TABS.map((item) => {
            const count = item.key === "requests" ? open.length : 0;
            const selected = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => setTab(item.key)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  selected
                    ? "bg-brand-500 text-white"
                    : "text-gray-600 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-white/[0.04]"
                }`}
              >
                {item.label}
                {count ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-xs font-semibold ${
                      selected ? "bg-white/25" : "bg-error-500 text-white"
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      {overview.warnings.map((warning) => (
        <div
          key={warning}
          className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-500"
        >
          {warning}
        </div>
      ))}

      {/* --- requests: the only part of this page with a deadline -------- */}
      {active === "requests" ? (
        <section className={card}>
          <h2 className={heading}>Customer data requests</h2>
          <p className={muted}>
            A customer who replies DELETE stops getting messages immediately. The
            deletion itself is yours to approve — it cannot be undone, so it is never
            done on one unverified message.
          </p>

          {open.length === 0 ? (
            <p className="mt-6 rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-800 dark:text-gray-400">
              Nothing waiting. Requests arrive here when a customer asks for their data
              or asks you to delete it.
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {open.map((request) => {
                const tone = dueTone(request.due_at);
                return (
                  <li
                    key={request.id}
                    className={`rounded-xl border p-4 ${
                      tone === "overdue"
                        ? "border-error-300 dark:border-error-500/40"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
                          {request.kind === "erasure"
                            ? "Delete my data"
                            : "Send me my data"}
                          {request.phone ? ` — ${request.phone}` : ""}
                          {request.due_at ? (
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${DUE_CLASS[tone]}`}
                            >
                              {dueLabel(request.due_at)}
                            </span>
                          ) : null}
                        </p>
                        <p className={muted}>
                          Asked {shortDate(request.received_at)} via {request.channel}
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
                          className="h-9 shrink-0 rounded-lg bg-error-500 px-3 text-sm font-medium text-white hover:bg-error-600 disabled:opacity-50"
                        >
                          Review and delete
                        </button>
                      ) : (
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy || !request.phone}
                            onClick={() => void onDownload(request)}
                            className="h-9 rounded-lg bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                          >
                            Download data
                          </button>
                          <button
                            type="button"
                            onClick={() => openLookup(request.phone || "")}
                            className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium dark:border-gray-700 dark:text-white/90"
                          >
                            Look up their data
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {overview.recent_requests.length ? (
            <details className="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <summary className="cursor-pointer text-sm font-medium text-gray-800 dark:text-white/90">
                Already answered ({overview.recent_requests.length})
              </summary>
              <ul className="mt-3 space-y-1">
                {overview.recent_requests.map((request) => (
                  <li key={request.id} className={muted}>
                    {request.kind === "erasure" ? "Deleted" : "Data sent"} —{" "}
                    {shortDate(request.completed_at)}
                    {typeof request.outcome?.deleted_total === "number"
                      ? `, ${request.outcome.deleted_total} records removed`
                      : ""}
                    {/* Null on requests closed before this was recorded, which is
                        honest — it is not backfilled with a guess. */}
                    {request.completed_by ? ` · by ${request.completed_by}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </section>
      ) : null}

      {/* --- people: the counts, the list, and one lookup ---------------- */}
      {active === "people" ? (
        <>
          <section className={card}>
            <h2 className={heading}>Consent</h2>
            <p className={muted}>
              The first message every customer gets says who holds their details, what
              for, and how to stop. It is stored word for word, so what each person was
              told can be shown later.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Figure label="People told" value={consent.notice_given} />
              <Figure label="Asked us to stop" value={consent.withdrawn} />
              <Figure label="Records held" value={consent.records} />
            </div>
            <ConsentPeoplePanel onLookup={openLookup} />
          </section>

          <section className={card} ref={lookupBox}>
            <h2 className={heading}>Look up a customer</h2>
            <p className={muted}>
              Everything you hold on one number, before anything is deleted.
            </p>
            <form onSubmit={onLookup} className="mt-4 flex flex-wrap items-center gap-2">
              <input
                className={input}
                placeholder="+91 98765 43210"
                aria-label="Customer phone number"
                value={lookup}
                onChange={(event) => setLookup(event.target.value)}
              />
              <button
                type="submit"
                disabled={busy || !lookup.trim()}
                className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                Look up
              </button>
              <button
                type="button"
                disabled={busy || !lookup.trim()}
                onClick={() => void onDownloadLookup()}
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-gray-700 dark:text-white/90"
              >
                Download data
              </button>
              <button
                type="button"
                disabled={busy || !lookup.trim()}
                onClick={() => void onRaise("access")}
                className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium disabled:opacity-50 dark:border-gray-700 dark:text-white/90"
              >
                Log an access request
              </button>
            </form>

            {/* Separated, and quieter than the rest. It is the only control here
                that starts something irreversible, and a row of five identical
                buttons is how the wrong one gets pressed. */}
            <div className="mt-3 border-t border-gray-100 pt-3 dark:border-gray-800">
              <button
                type="button"
                disabled={busy || !lookup.trim()}
                onClick={() => void onRaise("erasure")}
                className="text-sm font-medium text-error-600 underline-offset-2 hover:underline disabled:opacity-40 dark:text-error-500"
              >
                Log a deletion request for this number
              </button>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Logging it does not delete anything. It appears under Requests for an
                admin to approve.
              </p>
            </div>

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

          <RetentionPanel
            onPurged={(message) => {
              setNotice(message);
              void load();
            }}
          />
        </>
      ) : null}

      {/* --- WhatsApp cost and standing --------------------------------- */}
      {active === "whatsapp" ? (
        <section className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className={heading}>WhatsApp this month</h2>
              <p className={muted}>
                What the messages cost, and what they are doing to your number.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  QUALITY_CHIP[quality.quality] || QUALITY_CHIP.UNKNOWN
                }`}
              >
                Number quality: {QUALITY_LABEL[quality.quality] || quality.quality}
              </span>
              <button
                type="button"
                disabled={checking}
                onClick={() => void onCheckNumber()}
                className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium disabled:opacity-50 dark:border-gray-700 dark:text-gray-200"
              >
                {checking ? "Checking…" : "Check with Meta"}
              </button>
            </div>
          </div>

          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {quality.reported_at
              ? `Reported ${whenLabel(quality.reported_at)}`
              : "Meta has never reported a rating for this number"}
            {sendLimit ? ` · you may message ${sendLimit}` : ""}
            {". "}
            The rating normally arrives on its own; Check with Meta asks for it now,
            which is worth doing if this has said “Not reported yet” for a while.
          </p>

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
                  <th className="px-4 py-2 text-right font-medium">Messages</th>
                  <th className="px-4 py-2 text-right font-medium">Rate</th>
                  <th className="px-4 py-2 text-right font-medium">Spend</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(messaging.spend.categories).map(([name, item]) => (
                  <tr
                    key={name}
                    className="border-t border-gray-100 dark:border-gray-800"
                  >
                    <td className="px-4 py-2 text-gray-800 dark:text-white/90">
                      {CATEGORY_LABEL[name] || name}
                    </td>
                    <td className="px-4 py-2 text-right">{item.messages}</td>
                    <td className="px-4 py-2 text-right">
                      {item.priced ? rupees(item.rate) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {item.priced ? rupees(item.spend) : "—"}
                    </td>
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
      ) : null}

      {/* --- the figures the product enforces --------------------------- */}
      {active === "rules" ? (
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
      ) : null}

      {/* --- feedback, wherever you happen to be scrolled --------------- */}
      {error && overview ? (
        <Toast kind="error" message={error} onDismiss={() => setError("")} />
      ) : notice ? (
        <Toast kind="success" message={notice} onDismiss={() => setNotice("")} />
      ) : null}

      {confirming ? (
        <ConfirmDeleteDialog
          phone={confirming.phone}
          busy={busy}
          onCancel={() => setConfirming(null)}
          onConfirm={() => void onFulfil(confirming)}
        />
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

/** The page's shape while it loads, instead of nothing at all.
 *
 *  This screen does three queries before it can paint, and returning null meant a
 *  blank panel for a second or two — long enough to read as broken. */
function Skeleton() {
  return (
    <div className="animate-pulse space-y-5" aria-hidden>
      <div className="space-y-2">
        <div className="h-6 w-40 rounded bg-gray-200 dark:bg-white/[0.06]" />
        <div className="h-4 w-80 max-w-full rounded bg-gray-100 dark:bg-white/[0.04]" />
        <div className="h-9 w-72 max-w-full rounded-xl bg-gray-100 dark:bg-white/[0.04]" />
      </div>
      {[0, 1].map((row) => (
        <div key={row} className={card}>
          <div className="h-5 w-48 rounded bg-gray-200 dark:bg-white/[0.06]" />
          <div className="mt-3 h-4 w-full rounded bg-gray-100 dark:bg-white/[0.04]" />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((cell) => (
              <div key={cell} className="space-y-2">
                <div className="h-3 w-20 rounded bg-gray-100 dark:bg-white/[0.04]" />
                <div className="h-6 w-12 rounded bg-gray-200 dark:bg-white/[0.06]" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
