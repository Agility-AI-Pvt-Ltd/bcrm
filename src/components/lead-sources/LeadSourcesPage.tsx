"use client";

/**
 * Lead Sources — where enquiries come from. Today: 99acres.
 *
 * The agency gets a private webhook URL, gives it to their 99acres account
 * manager, and every new enquiry lands here as a contact + lead. Once the
 * agency's WhatsApp template is approved, each new lead gets it automatically:
 * "Hi {{1}}, we received your enquiry regarding {{2}}…".
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { failureText } from "@/lib/api";
import {
  connectLeadSource,
  getLeadSource,
  listPortalLeads,
  rotateLeadSource,
  sendPortalFollowup,
  sendWaitingFollowups,
  submitFollowupTemplate,
  syncTemplates,
  TEMPLATE_STATUS,
  updateLeadSource,
  WHATSAPP_STATUS,
  type LeadSource,
  type PortalLead,
} from "@/lib/leadSources";
import { formatSince, formatWhen } from "@/lib/outreach";

const SOURCE = "99acres" as const;
const card =
  "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6";
const button =
  "rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";
const primary =
  "rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50";

function Switch({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60 ${
        checked ? "bg-brand-500" : "bg-gray-300 dark:bg-gray-700"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

export default function LeadSourcesPage() {
  const [source, setSource] = useState<LeadSource | null>(null);
  const [leads, setLeads] = useState<PortalLead[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [loaded, recent] = await Promise.all([
        getLeadSource(SOURCE),
        listPortalLeads(SOURCE).catch(() => [] as PortalLead[]),
      ]);
      setSource(loaded);
      setLeads(recent);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load lead sources."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // New leads and "Sending…" rows update themselves while the page is open.
  const sending = leads.some((lead) => lead.whatsapp_status === "pending");
  useEffect(() => {
    const timer = setInterval(() => void load(), sending ? 5_000 : 30_000);
    return () => clearInterval(timer);
  }, [load, sending]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  const run = async (key: string, action: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    setError("");
    try {
      await action();
      if (done) setNotice(done);
      await load();
    } catch (err) {
      setError(failureText(err, "That did not work."));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    if (!source?.webhook_url) return;
    try {
      await navigator.clipboard.writeText(source.webhook_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Copy failed — select the URL and copy it by hand.");
    }
  };

  if (!source) {
    return (
      <section className={card}>
        <p className="text-sm text-gray-500">{error || "Loading lead sources…"}</p>
      </section>
    );
  }

  const template = source.template;
  const templateStatus = template.status ? TEMPLATE_STATUS[template.status] : null;
  const canSubmit = !template.status || ["DRAFT", "REJECTED", "SUBMIT_FAILED"].includes(template.status);
  const waiting = source.counts.waiting_for_template ?? 0;

  return (
    <div className="space-y-6">
      <section className={card}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">99acres</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
              New buyer enquiries from your 99acres listings arrive here automatically, become
              contacts and leads, and get a WhatsApp message from you within seconds.
            </p>
          </div>
          {source.connected ? (
            <span className="text-xs text-gray-500">
              {source.last_received_at
                ? `Last lead ${formatSince(source.last_received_at)}`
                : "No leads received yet"}
            </span>
          ) : null}
        </div>

        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

        {!source.connected ? (
          <div className="mt-5">
            <button
              type="button"
              className={primary}
              disabled={busy !== null}
              onClick={() => void run("connect", () => connectLeadSource(SOURCE), "Your 99acres webhook URL is ready.")}
            >
              {busy === "connect" ? "Creating…" : "Connect 99acres"}
            </button>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <p className="mb-1.5 text-sm font-medium text-gray-800 dark:text-white/90">
                Your webhook URL
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-200">
                  {source.webhook_url}
                </code>
                <button type="button" className={button} onClick={() => void copy()}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <button
                  type="button"
                  className={button}
                  disabled={busy !== null}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Generate a new URL? The current one stops working immediately, so 99acres must be given the new one.",
                      )
                    ) {
                      void run("rotate", () => rotateLeadSource(SOURCE), "New URL generated. Send it to 99acres.");
                    }
                  }}
                >
                  New URL
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-500">
                Keep it private: anyone with this URL can add leads to your account.
              </p>
            </div>

            <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-gray-600 dark:text-gray-300">
              <li>Copy the URL above.</li>
              <li>
                Email it to your 99acres account manager and ask them to push new leads to it
                (JSON or form POST).
              </li>
              <li>Get the WhatsApp template below approved, so each lead is messaged automatically.</li>
            </ol>

            <div className="mt-5 divide-y divide-gray-100 rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
              <label className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                    Receive leads
                  </span>
                  <span className="block text-xs text-gray-500">
                    Off: pushes are acknowledged but nothing is stored.
                  </span>
                </span>
                <Switch
                  checked={source.is_active}
                  label="Receive leads"
                  disabled={busy !== null}
                  onChange={(value) => void run("active", () => updateLeadSource(SOURCE, { is_active: value }))}
                />
              </label>
              <label className="flex items-center justify-between gap-4 px-4 py-3">
                <span>
                  <span className="block text-sm font-medium text-gray-800 dark:text-white/90">
                    Send WhatsApp automatically
                  </span>
                  <span className="block text-xs text-gray-500">
                    Never twice to the same number within 7 days, never to customers who opted out.
                  </span>
                </span>
                <Switch
                  checked={source.auto_send}
                  label="Send WhatsApp automatically"
                  disabled={busy !== null}
                  onChange={(value) => void run("auto", () => updateLeadSource(SOURCE, { auto_send: value }))}
                />
              </label>
            </div>
          </>
        )}
      </section>

      <section className={card}>
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">WhatsApp template</h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          WhatsApp only lets you message a new lead with a template it has approved. Approval
          usually takes minutes, sometimes up to a day.
        </p>
        <blockquote className="mt-4 rounded-lg border-l-4 border-brand-300 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:bg-white/[0.03] dark:text-gray-200">
          {template.body ||
            "Hi {{1}}, we received your enquiry regarding {{2}}. Are you still looking for a property in {{3}}? Reply here and we'll help you with available options."}
          <span className="mt-2 block text-xs text-gray-500">
            {"{{1}}"} customer&rsquo;s first name · {"{{2}}"} property · {"{{3}}"} locality
          </span>
        </blockquote>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <p className={`text-sm font-medium ${templateStatus?.tone ?? "text-gray-600"}`}>
            {templateStatus?.label ?? "Not submitted yet"}
          </p>
          {canSubmit ? (
            <button
              type="button"
              className={primary}
              disabled={busy !== null}
              onClick={() =>
                void run(
                  "submit",
                  () => submitFollowupTemplate(template),
                  "Submitted to WhatsApp for approval.",
                )
              }
            >
              {busy === "submit"
                ? "Submitting…"
                : template.status === "REJECTED"
                  ? "Resubmit for approval"
                  : "Submit for approval"}
            </button>
          ) : null}
          {template.status === "PENDING" ? (
            <button
              type="button"
              className={button}
              disabled={busy !== null}
              onClick={() => void run("sync", () => syncTemplates(), "Checked with WhatsApp.")}
            >
              Check status
            </button>
          ) : null}
          {template.status === "APPROVED" && waiting > 0 ? (
            <button
              type="button"
              className={primary}
              disabled={busy !== null}
              onClick={() =>
                void run("waiting", () => sendWaitingFollowups(SOURCE), `Sending to ${waiting} waiting lead${waiting === 1 ? "" : "s"}.`)
              }
            >
              Send to {waiting} waiting lead{waiting === 1 ? "" : "s"}
            </button>
          ) : null}
        </div>
        {template.status === "REJECTED" && template.rejection_reason ? (
          <p className="mt-2 text-sm text-error-600">Reason: {template.rejection_reason}</p>
        ) : null}
      </section>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Leads from 99acres</h3>
          <div className="flex flex-wrap gap-2 text-xs text-gray-500">
            <span>Total {source.counts.total ?? 0}</span>
            <span>· Sent {source.counts.sent ?? 0}</span>
            <span>· Waiting {waiting}</span>
            <span>· Not sent {(source.counts.skipped ?? 0) + (source.counts.failed ?? 0)}</span>
          </div>
        </div>

        {leads.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">
            No leads yet. They appear here the moment 99acres sends the first one.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 dark:divide-gray-800 dark:border-gray-800">
            {leads.map((lead) => {
              const status = WHATSAPP_STATUS[lead.whatsapp_status] ?? WHATSAPP_STATUS.skipped;
              const subject = [lead.property_name, lead.locality || lead.city].filter(Boolean).join(" · ");
              return (
                <li key={lead.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-800 dark:text-white/90">
                      {lead.name || lead.phone}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {[lead.name ? lead.phone : null, subject || null, lead.budget]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {lead.message ? (
                      <p className="mt-1 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                        &ldquo;{lead.message}&rdquo;
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-gray-400" title={formatWhen(lead.received_at)}>
                      Enquired {formatSince(lead.received_at || lead.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${status.className}`}
                      title={lead.whatsapp_reason ?? undefined}
                    >
                      {status.label}
                    </span>
                    {lead.whatsapp_reason ? (
                      <span className="max-w-56 text-right text-[11px] text-gray-500">
                        {lead.whatsapp_reason}
                      </span>
                    ) : null}
                    <div className="flex items-center gap-3">
                      {lead.whatsapp_status !== "sent" ? (
                        <button
                          type="button"
                          className="text-xs font-medium text-brand-500 hover:underline disabled:opacity-50"
                          disabled={busy !== null}
                          onClick={() =>
                            void run(`send-${lead.id}`, () => sendPortalFollowup(SOURCE, lead.id))
                          }
                        >
                          {busy === `send-${lead.id}` ? "Sending…" : "Send WhatsApp"}
                        </button>
                      ) : null}
                      {lead.conversation_id ? (
                        <Link
                          href={`/messages?conversation=${encodeURIComponent(lead.conversation_id)}`}
                          className="text-xs font-medium text-brand-500 hover:underline"
                        >
                          Open chat
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
