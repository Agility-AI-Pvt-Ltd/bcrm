"use client";

/**
 * One customer's chat: the status header, the transcript, and the composer.
 *
 * Two things make this different from an ordinary chat view.
 *
 * The transcript separates the AI's messages from the agent's own. Both are
 * outbound and both are stored with role "assistant", because to the language
 * model they are equally "our side" — the difference is `author`, derived on the
 * backend from a `manual` marker. Without that distinction the agent cannot tell
 * what has already been said on their behalf.
 *
 * The composer is honest about WhatsApp's 24-hour rule. Outside the window a
 * typed message would be rejected by Meta, so the box is disabled and says why
 * rather than accepting text and losing it.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import Badge from "@/components/ui/badge/Badge";
import CustomerDetailsPanel from "@/components/messages/CustomerDetailsPanel";
import {
  authorLabel,
  conversationStatusLabel,
  interestLabel,
  MESSAGE_KIND_LABELS,
  waitingLabel,
  windowLabel,
  type InboxMessage,
  type InboxThreadDetail,
  type ServiceWindow,
} from "@/lib/inbox";
import { formatSince, formatWhen, stageBadgeColor } from "@/lib/outreach";
import { CalendarIcon, Dot, dotFor, MetaRule, SpanningLabel } from "@/components/messages/tokens";

const MAX_LENGTH = 4096;

type Props = {
  detail: InboxThreadDetail | null;
  messages: InboxMessage[];
  hasMore: boolean;
  loading: boolean;
  loadingOlder: boolean;
  sending: boolean;
  onLoadOlder: () => void;
  onSend: (text: string) => Promise<boolean>;
  onRefresh: () => void;
};

export default function ChatPanel({
  detail,
  messages,
  hasMore,
  loading,
  loadingOlder,
  sending,
  onLoadOlder,
  onSend,
  onRefresh,
}: Props) {
  const [showDetails, setShowDetails] = useState(true);
  const scroller = useRef<HTMLDivElement | null>(null);
  const conversationId = detail?.thread.conversation_id ?? null;

  // Land on the newest message when the chat opens or a send lands. Older pages
  // are prepended above, so the scroll position is deliberately left alone then.
  useEffect(() => {
    const node = scroller.current;
    if (!node || loadingOlder) return;
    node.scrollTop = node.scrollHeight;
  }, [conversationId, messages.length, loadingOlder]);

  const groups = useMemo(() => groupByDay(messages), [messages]);

  if (!detail) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center">
        <div>
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Pick a chat to read it
          </p>
          <p className="mt-1 max-w-xs text-xs text-gray-500">
            Every AI message and every customer reply is here, with the stage, the
            interest score and the full profile at the top.
          </p>
        </div>
      </div>
    );
  }

  const { thread, profile, interest, window: serviceWindow } = detail;
  const blocked = thread.outreach_paused
    ? "This customer opted out, so no message can be sent."
    : !serviceWindow.can_send_freeform
      ? serviceWindow.reason
      : "";

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* --- status header ------------------------------------------------- */}
        <header className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-gray-900 dark:text-white/90">
                {thread.name}
              </h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {[thread.phone, thread.email].filter(Boolean).join(" · ") || "No contact details"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03] xl:hidden"
              >
                {showDetails ? "Hide details" : "Details"}
              </button>
            </div>
          </div>

          {/* The status line, grouped: where they stand, how interested they are,
              what the conversation is doing, and what we have committed to. A rule
              between the groups so six facts do not read as one run-on sentence. */}
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color={stageBadgeColor(thread.customer_stage)} size="sm">
                {thread.customer_stage}
              </Badge>
              <span className="text-[11px] text-gray-500">
                {thread.engagement_tier} engagement
              </span>
            </div>

            <MetaRule />
            <span
              className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300"
              title="How interested the AI reads this customer as, from 0 to 100"
            >
              <Dot className={dotFor(thread.interest_band)} />
              {interestLabel(thread.interest_score)}
            </span>

            <MetaRule />
            <span className="text-[11px] text-gray-500">
              {conversationStatusLabel(thread.status)}
            </span>

            {thread.awaiting_reply && (
              <>
                <MetaRule />
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-warning-600 dark:text-warning-400">
                  <Dot className="bg-warning-500" />
                  {waitingLabel(thread.waiting_since) || "waiting on you"}
                </span>
              </>
            )}

            {thread.scheduled_at && (
              <>
                <MetaRule />
                <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-500">
                  <CalendarIcon />
                  {formatWhen(thread.scheduled_at)}
                </span>
              </>
            )}
          </div>

          {interest.reason && (
            <p className="mt-2.5 max-w-3xl text-[11px] leading-snug text-gray-500">
              <span className="font-medium text-gray-600 dark:text-gray-400">Why: </span>
              {interest.reason}
            </p>
          )}
        </header>

        {/* --- transcript --------------------------------------------------- */}
        <div ref={scroller} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={onLoadOlder}
                disabled={loadingOlder}
                className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-medium text-gray-600 disabled:opacity-50 dark:border-gray-700 dark:text-gray-400"
              >
                {loadingOlder ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          )}

          {loading && messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">Loading conversation…</p>
          ) : messages.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              Nothing has been said in this chat yet.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.day} className="space-y-3">
                {/* A day is a category too, so it gets the same treatment: a label
                    with the rule running through it. */}
                <SpanningLabel>{group.day}</SpanningLabel>
                {group.items.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))}
              </div>
            ))
          )}
        </div>

        {/* --- composer ----------------------------------------------------- */}
        {/* Keyed by conversation so switching chats clears the box by remounting,
            which is cheaper and less error-prone than resetting it in an effect. */}
        <Composer
          key={conversationId ?? "none"}
          blocked={blocked}
          sending={sending}
          windowState={serviceWindow}
          onSend={onSend}
        />
      </div>

      {/* --- profile rail --------------------------------------------------- */}
      <aside
        className={`w-80 shrink-0 overflow-y-auto border-l border-gray-100 dark:border-gray-800 ${
          showDetails ? "block" : "hidden"
        } xl:block`}
      >
        <CustomerDetailsPanel
          profile={profile}
          interest={interest}
          qualification={detail.qualification}
          appointments={detail.appointments}
        />
      </aside>
    </div>
  );
}

/**
 * The one place a human types into a customer's WhatsApp.
 *
 * `blocked` carries the reason from the backend rather than a boolean, so the
 * disabled state can always explain itself — an opt-out and a closed 24-hour
 * window look the same to the agent otherwise.
 */
function Composer({
  blocked,
  sending,
  windowState,
  onSend,
}: {
  blocked: string;
  sending: boolean;
  windowState: ServiceWindow;
  onSend: (text: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState("");
  const canSend = !blocked && draft.trim().length > 0 && !sending;

  const submit = async () => {
    if (!canSend) return;
    const sent = await onSend(draft.trim());
    if (sent) setDraft("");
  };

  return (
    <div className="border-t border-gray-100 px-5 py-3 dark:border-gray-800">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span
          className={`text-[11px] ${blocked ? "text-error-500" : "text-gray-500"}`}
          title={windowState.reason}
        >
          {blocked || windowLabel(windowState)}
        </span>
        <span className="text-[11px] text-gray-400">
          The AI keeps replying after you send
        </span>
      </div>
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={2}
          disabled={Boolean(blocked)}
          placeholder={
            blocked
              ? "You cannot type a message to this customer right now"
              : "Write the message you want sent to their WhatsApp…"
          }
          className="min-h-[44px] flex-1 resize-y rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 dark:border-gray-700 dark:bg-transparent dark:text-gray-300 dark:disabled:bg-white/[0.03]"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
      <p className="mt-1 text-[11px] text-gray-400">
        Enter sends · Shift+Enter adds a line · {draft.length}/{MAX_LENGTH}
      </p>
    </div>
  );
}

function Bubble({ message }: { message: InboxMessage }) {
  const inbound = message.author === "customer";
  const agent = message.author === "agent";
  const tone = inbound
    ? "bg-gray-100 text-gray-800 dark:bg-white/[0.06] dark:text-gray-200"
    : agent
      ? "bg-brand-500 text-white"
      : "bg-brand-50 text-gray-800 dark:bg-brand-500/15 dark:text-gray-100";
  const kind = message.kind ? MESSAGE_KIND_LABELS[message.kind] || message.kind : "";

  return (
    <div className={`flex ${inbound ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[78%]">
        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${tone}`}>
          {message.text ? (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          ) : (
            <p className="italic opacity-70">
              {message.media_url ? "Sent an attachment" : `(${message.message_type})`}
            </p>
          )}
        </div>
        <div
          className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-gray-400 ${
            inbound ? "" : "justify-end"
          }`}
        >
          <span className={agent ? "font-medium text-brand-500" : ""}>
            {authorLabel(message)}
          </span>
          {kind && <span>· {kind}</span>}
          <span title={formatWhen(message.created_at)}>· {formatSince(message.created_at)}</span>
          {message.delivery_status && !inbound && (
            <span title={message.delivery_error || undefined}>· {message.delivery_status}</span>
          )}
          {message.delivery_error && (
            <span className="text-error-500" title={message.delivery_error}>
              · failed
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Day separators, so a long thread reads like a conversation and not a log. */
function groupByDay(messages: InboxMessage[]) {
  const groups: { day: string; items: InboxMessage[] }[] = [];
  for (const message of messages) {
    const day = dayLabel(message.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(message);
    else groups.push({ day, items: [message] });
  }
  return groups;
}

function dayLabel(value: string | null) {
  if (!value) return "Earlier";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  if (sameDay) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}
