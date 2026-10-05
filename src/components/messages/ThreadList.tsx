"use client";

/**
 * The chat list — one row per customer, sorted however the agent asked.
 *
 * Each row has to answer three questions at a glance: how interested are they,
 * are they waiting on me, and what did they last say. Selection lives here too,
 * because the whole point of filtering is to then act on the result: tick the
 * rows, name them, and they become a list for WhatsApp Outreach.
 *
 * The score is a number with a coloured dot rather than a second badge. Twenty-five
 * rows of two coloured badges each is a colour chart; a column of numbers can
 * actually be scanned, which is what a sorted list is for. The footer facts are
 * separated by hairlines because they are different kinds of thing — a debt (they
 * are waiting), a commitment (a visit is booked), a history (reply count).
 */

import Badge from "@/components/ui/badge/Badge";
import {
  bandBadgeColor,
  interestBand,
  waitingLabel,
  type InboxThread,
} from "@/lib/inbox";
import { formatSince, formatWhen, stageBadgeColor } from "@/lib/outreach";
import { CalendarIcon } from "@/components/messages/tokens";
import { AiCallbackBadge } from "@/components/messages/AiCallbackStatus";

type Props = {
  threads: InboxThread[];
  loading: boolean;
  filtered: boolean;
  activeId: string | null;
  selected: Set<string>;
  onOpen: (thread: InboxThread) => void;
  onToggleSelect: (conversationId: string) => void;
  onToggleAllOnPage: () => void;
};

export default function ThreadList({
  threads,
  loading,
  filtered,
  activeId,
  selected,
  onOpen,
  onToggleSelect,
  onToggleAllOnPage,
}: Props) {
  const allOnPageSelected =
    threads.length > 0 && threads.every((thread) => selected.has(thread.conversation_id));

  if (loading && threads.length === 0) {
    return <p className="px-4 py-10 text-center text-sm text-gray-500">Loading chats…</p>;
  }

  if (threads.length === 0) {
    return (
      <p className="px-6 py-10 text-center text-sm text-gray-500">
        {filtered
          ? "No chat matches these filters. Loosen one and try again."
          : "No conversations yet. They appear here the moment a customer replies on WhatsApp."}
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2 dark:border-gray-800">
        <label className="flex items-center gap-2 text-[11px] text-gray-500">
          <input
            type="checkbox"
            checked={allOnPageSelected}
            onChange={onToggleAllOnPage}
            className="h-3.5 w-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
          />
          Select these {threads.length}
        </label>
        {loading && <span className="text-[11px] text-gray-400">Refreshing…</span>}
      </div>

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {threads.map((thread) => (
          <ThreadRow
            key={thread.conversation_id}
            thread={thread}
            active={thread.conversation_id === activeId}
            checked={selected.has(thread.conversation_id)}
            onOpen={() => onOpen(thread)}
            onToggleSelect={() => onToggleSelect(thread.conversation_id)}
          />
        ))}
      </ul>
    </div>
  );
}

function ThreadRow({
  thread,
  active,
  checked,
  onOpen,
  onToggleSelect,
}: {
  thread: InboxThread;
  active: boolean;
  checked: boolean;
  onOpen: () => void;
  onToggleSelect: () => void;
}) {
  const band = thread.interest_band || interestBand(thread.interest_score);
  const waiting = thread.awaiting_reply ? waitingLabel(thread.waiting_since) : "";

  return (
    <li
      className={`relative flex gap-3 px-5 py-4 transition ${
        active
          ? "bg-brand-50/50 dark:bg-brand-500/10"
          : "hover:bg-gray-50/80 dark:hover:bg-white/[0.03]"
      }`}
    >
      {active && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-500 rounded-r-md" aria-hidden="true" />
      )}

      {/* Checkbox wrapper with avatar placeholder */}
      <div className="flex flex-col items-center gap-2 pt-0.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggleSelect}
          aria-label={`Select ${thread.name}`}
          className="h-4 w-4 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
        />
        <div
          className={`hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium uppercase text-white ${
            thread.awaiting_reply ? "bg-warning-500" : "bg-brand-400"
          }`}
          aria-hidden="true"
        >
          {thread.name.charAt(0)}
        </div>
      </div>

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 rounded">
        <div className="flex items-baseline justify-between gap-2">
          <span className={`truncate text-[15px] ${thread.awaiting_reply ? "font-bold text-gray-900 dark:text-white" : "font-semibold text-gray-800 dark:text-white/90"}`}>
            {thread.name}
          </span>
          <span
            className={`shrink-0 text-xs ${thread.awaiting_reply ? "font-semibold text-brand-600 dark:text-brand-400" : "text-gray-400"}`}
            title={formatWhen(thread.last_message_at)}
          >
            {formatSince(thread.last_message_at)}
          </span>
        </div>

        <p className={`mt-0.5 truncate text-sm leading-relaxed ${thread.awaiting_reply ? "font-medium text-gray-800 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"}`}>
          {thread.last_reply_text ? (
            <span>{thread.last_reply_text}</span>
          ) : (
            <span className="italic opacity-80">No reply yet</span>
          )}
        </p>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <Badge color={stageBadgeColor(thread.customer_stage)} size="sm">
            {thread.customer_stage}
          </Badge>

          {thread.interest_score !== null && (
            <Badge color={bandBadgeColor(band)} size="sm">
              Score: {thread.interest_score}
            </Badge>
          )}

          {waiting && (
            <Badge color="warning" size="sm">
              Waiting: {waiting}
            </Badge>
          )}

          {thread.scheduled_at && (
            <div
              className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              title={formatWhen(thread.scheduled_at)}
            >
              <CalendarIcon />
              {formatWhen(thread.scheduled_at)}
            </div>
          )}

          {thread.ai_callback && <AiCallbackBadge view={thread.ai_callback} />}

          {thread.outreach_paused && (
            <Badge color="error" size="sm">
              Opted out
            </Badge>
          )}
        </div>
      </button>
    </li>
  );
}
