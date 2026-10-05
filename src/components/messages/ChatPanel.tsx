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
import { AiCallbackStrip } from "@/components/messages/AiCallbackStatus";

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
  showDetails?: boolean;
  onToggleDetails?: () => void;
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
  showDetails,
  onToggleDetails,
}: Props) {
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
        <header className="border-b border-gray-100 px-5 py-4 dark:border-gray-800 bg-white/50 dark:bg-white/[0.01]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-gray-900 dark:text-white">
                {thread.name}
              </h2>
              <p className="mt-0.5 text-[13px] font-medium text-gray-500">
                {[thread.phone, thread.email].filter(Boolean).join(" · ") || "No contact details"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onRefresh}
                className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Refresh
              </button>
              {onToggleDetails && (
                <button
                  type="button"
                  onClick={onToggleDetails}
                  className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 xl:hidden"
                >
                  {showDetails ? "Hide details" : "Details"}
                </button>
              )}
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <Badge color={stageBadgeColor(thread.customer_stage)} size="sm">
              {thread.customer_stage}
            </Badge>
            <Badge color="light" size="sm">
              {thread.engagement_tier}
            </Badge>

            <MetaRule />
            <Badge color="light" size="sm">
              <span className="flex items-center gap-1.5 font-medium">
                <Dot className={dotFor(thread.interest_band)} />
                {interestLabel(thread.interest_score)}
              </span>
            </Badge>

            <MetaRule />
            <Badge color="light" size="sm">
              {conversationStatusLabel(thread.status)}
            </Badge>

            {thread.awaiting_reply && (
              <Badge color="warning" size="sm">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Dot className="bg-warning-500" />
                  {waitingLabel(thread.waiting_since) || "waiting on you"}
                </span>
              </Badge>
            )}

            {thread.scheduled_at && (
              <Badge color="light" size="sm">
                <span className="flex items-center gap-1.5">
                  <CalendarIcon />
                  {formatWhen(thread.scheduled_at)}
                </span>
              </Badge>
            )}
          </div>

          {thread.ai_callback && <AiCallbackStrip view={thread.ai_callback} />}
        </header>

        {/* --- transcript --------------------------------------------------- */}
        <div ref={scroller} className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6 bg-gray-50/50 dark:bg-transparent">
          {hasMore && (
            <div className="text-center pb-4">
              <button
                type="button"
                onClick={onLoadOlder}
                disabled={loadingOlder}
                className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-[11px] font-semibold text-gray-600 shadow-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
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
              <div key={group.day} className="space-y-4">
                <SpanningLabel>{group.day}</SpanningLabel>
                {group.items.map((message) => (
                  <Bubble key={message.id} message={message} />
                ))}
              </div>
            ))
          )}
        </div>

        {/* --- composer ----------------------------------------------------- */}
        <Composer
          key={conversationId ?? "none"}
          blocked={blocked}
          sending={sending}
          windowState={serviceWindow}
          onSend={onSend}
        />
      </div>
    </div>
  );
}

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
    <div className="border-t border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
      {blocked && (
        <div className="mb-2 rounded-md bg-error-50 px-3 py-2 text-[11px] text-error-700 dark:bg-error-500/10 dark:text-error-400">
          {blocked}
        </div>
      )}
      {!blocked && windowState.reason && (
        <div className="mb-2 text-[11px] text-gray-500">{windowLabel(windowState)}</div>
      )}
      
      <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-white focus-within:border-brand-500 focus-within:ring-3 focus-within:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:focus-within:border-brand-600 transition-shadow">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void submit();
            }
          }}
          rows={1}
          disabled={Boolean(blocked)}
          placeholder={
            blocked
              ? "Cannot send messages"
              : "Reply to customer..."
          }
          className="min-h-[44px] flex-1 resize-y bg-transparent px-4 py-3 text-[14px] text-gray-800 placeholder:text-gray-400 focus:outline-none disabled:cursor-not-allowed dark:text-gray-200"
        />
        <div className="flex shrink-0 items-center gap-1 p-1.5">
          <button
            type="button"
            disabled={!canSend}
            onClick={() => void submit()}
            className="flex h-8 items-center justify-center rounded-lg bg-brand-500 px-4 text-xs font-semibold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 dark:disabled:bg-gray-800"
          >
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-1">
        <p className="text-[10px] text-gray-400">
          Enter to send, Shift+Enter for new line
        </p>
        <p className="text-[10px] text-gray-400">
          {draft.length}/{MAX_LENGTH}
        </p>
      </div>
    </div>
  );
}

function Bubble({ message }: { message: InboxMessage }) {
  const inbound = message.author === "customer";
  const agent = message.author === "agent";
  
  // Refined bubble styling
  const tone = inbound
    ? "bg-white border border-gray-200 text-gray-800 shadow-xs dark:bg-gray-800 dark:border-gray-700 dark:text-gray-200 rounded-bl-sm"
    : agent
      ? "bg-brand-600 text-white shadow-xs rounded-br-sm"
      : "bg-gray-100 text-gray-700 border border-transparent dark:bg-gray-800 dark:text-gray-300 rounded-br-sm"; // AI styling

  const kind = message.kind ? MESSAGE_KIND_LABELS[message.kind] || message.kind : "";

  return (
    <div className={`flex w-full ${inbound ? "justify-start" : "justify-end"}`}>
      <div className="max-w-[75%] flex flex-col">
        <div className={`rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed ${tone}`}>
          {message.text ? (
            <p className="whitespace-pre-wrap break-words">{message.text}</p>
          ) : (
            <p className="italic opacity-80">
              {message.media_url ? "📎 Attachment sent" : `(${message.message_type})`}
            </p>
          )}
        </div>
        <div
          className={`mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-gray-400 ${
            inbound ? "justify-start ml-1" : "justify-end mr-1"
          }`}
        >
          <span className={`font-semibold ${agent ? "text-brand-600 dark:text-brand-400" : ""}`}>
            {authorLabel(message)}
          </span>
          {kind && <span className="opacity-75">· {kind}</span>}
          <span className="opacity-75" title={formatWhen(message.created_at)}>· {formatSince(message.created_at)}</span>
          {message.delivery_status && !inbound && (
            <span className="opacity-75" title={message.delivery_error || undefined}>· {message.delivery_status}</span>
          )}
          {message.delivery_error && (
            <span className="font-semibold text-error-500" title={message.delivery_error}>
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
