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
  interestBand,
  waitingLabel,
  type InboxThread,
} from "@/lib/inbox";
import { formatSince, formatWhen, stageBadgeColor } from "@/lib/outreach";
import { CalendarIcon, Dot, dotFor, MetaRule } from "@/components/messages/tokens";

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
      className={`flex gap-3 px-4 py-3 transition ${
        active ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
      }`}
    >
      {/* Outside the row button so ticking a row never also opens it. */}
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggleSelect}
        aria-label={`Select ${thread.name}`}
        className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
      />

      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium text-gray-800 dark:text-white/90">
            {thread.name}
          </span>
          <span
            className="shrink-0 text-[11px] text-gray-400"
            title={formatWhen(thread.last_message_at)}
          >
            {formatSince(thread.last_message_at)}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-2">
          {thread.interest_score === null ? (
            <span
              className="text-[11px] text-gray-400"
              title="The AI has not read a reply from this customer yet"
            >
              Not scored
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-700 dark:text-gray-300"
              title="How interested the AI reads this customer as, from 0 to 100"
            >
              <Dot className={dotFor(band)} />
              <span className="tabular-nums">{thread.interest_score}</span>
              <span className="font-normal text-gray-400">interested</span>
            </span>
          )}
          <MetaRule />
          <Badge color={stageBadgeColor(thread.customer_stage)} size="sm">
            {thread.customer_stage}
          </Badge>
          {thread.outreach_paused && (
            <>
              <MetaRule />
              <span className="text-[11px] text-gray-400" title="Asked us to stop messaging">
                Opted out
              </span>
            </>
          )}
        </div>

        <p className="mt-1.5 truncate text-xs text-gray-500 dark:text-gray-400">
          {thread.last_reply_text ? (
            <span className="italic">&ldquo;{thread.last_reply_text}&rdquo;</span>
          ) : (
            <span className="text-gray-400">No reply yet</span>
          )}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
          {waiting && (
            <>
              <span className="inline-flex items-center gap-1.5 font-medium text-warning-600 dark:text-warning-400">
                <Dot className="bg-warning-500" />
                {waiting}
              </span>
              <MetaRule />
            </>
          )}
          {thread.scheduled_at && (
            <>
              <span
                className="inline-flex items-center gap-1"
                title={formatWhen(thread.scheduled_at)}
              >
                <CalendarIcon />
                {formatWhen(thread.scheduled_at)}
              </span>
              <MetaRule />
            </>
          )}
          <span className="tabular-nums">
            {thread.reply_count} repl{thread.reply_count === 1 ? "y" : "ies"}
          </span>
        </div>
      </button>
    </li>
  );
}
