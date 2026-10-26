"use client";

/**
 * The Messages page's customer panel, opened from a person on the Leads page.
 *
 * Same component, same data (`GET /conversations/for-contact/{id}` returns the
 * detail `GET /conversations/{id}` does), so Lead overview, Requirements,
 * Activity & history and Quick actions read and behave exactly as they do
 * beside the chat. A customer who has never messaged has no chat to act on;
 * they get what the Leads list knows and a plain sentence instead of buttons
 * that would fail.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import CustomerDetailsPanel from "@/components/messages/CustomerDetailsPanel";
import { ApiError } from "@/lib/api";
import { getThreadForContact, type InboxThreadDetail } from "@/lib/inbox";
import type { Lead } from "@/lib/outreach";

export default function CustomerProfileDrawer({
  lead,
  onClose,
  onChanged,
}: {
  lead: Lead;
  onClose: () => void;
  /** The customer changed (stage, owner, opt-out, visit): refresh the list. */
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<InboxThreadDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "no_chat" | "error">("loading");
  const [error, setError] = useState("");

  // Bumped after a quick action changed the customer, to read them again.
  const [version, setVersion] = useState(0);

  // Mounted once per customer (the caller keys it by id), so the first render is
  // already "loading"; state is only set from the request's own callbacks.
  useEffect(() => {
    let cancelled = false;
    getThreadForContact(lead.id)
      .then((found) => {
        if (cancelled) return;
        setDetail(found);
        setState("ready");
      })
      .catch((problem: unknown) => {
        if (cancelled) return;
        if (problem instanceof ApiError && problem.status === 404) {
          setState("no_chat");
          return;
        }
        setError(problem instanceof ApiError ? problem.message : "Could not load this customer.");
        setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [lead.id, version]);

  const wants = [lead.bhk, lead.preferred_location, lead.budget_label].filter(Boolean);

  return (
    <div className="fixed inset-0 z-[99999] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close customer profile"
        onClick={onClose}
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-[1px]"
      />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-hidden bg-white shadow-theme-xl dark:bg-gray-900">
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-3 dark:border-gray-800">
          <div className="min-w-0">
            <p className="truncate font-semibold text-gray-900 dark:text-white">
              {lead.name || "Unnamed"}
            </p>
            <p className="truncate text-xs text-gray-500">{lead.phone || lead.email || ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {detail ? (
              <Link
                href={`/messages?conversation=${encodeURIComponent(detail.thread.conversation_id)}`}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Open chat
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {state === "loading" ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500">Loading profile…</p>
          ) : state === "error" ? (
            <p className="px-5 py-10 text-center text-sm text-error-500">{error}</p>
          ) : state === "no_chat" || !detail ? (
            <div className="space-y-4 px-5 py-6 text-sm">
              <p className="text-gray-600 dark:text-gray-300">
                This customer has no WhatsApp chat yet, so there is no conversation to act on.
                Quick actions appear here once they have messaged.
              </p>
              <dl className="space-y-1.5 text-xs">
                {[
                  ["Stage", lead.customer_stage],
                  ["Engagement", lead.engagement_tier],
                  ["Interest score", lead.intent_score === null ? null : String(lead.intent_score)],
                  ["Looking for", wants.join(" · ") || null],
                  ["Last reply", lead.last_reply_text],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="flex gap-3">
                      <dt className="w-28 shrink-0 text-gray-400">{label}</dt>
                      <dd className="min-w-0 flex-1 break-words text-gray-700 dark:text-gray-300">
                        {value}
                      </dd>
                    </div>
                  ))}
              </dl>
            </div>
          ) : (
            <CustomerDetailsPanel
              conversationId={detail.thread.conversation_id}
              onChanged={() => {
                setVersion((value) => value + 1);
                onChanged();
              }}
              profile={detail.profile}
              interest={detail.interest}
              qualification={detail.qualification}
              appointments={detail.appointments}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
