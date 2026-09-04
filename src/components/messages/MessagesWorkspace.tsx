"use client";

/**
 * Messages — every WhatsApp conversation the AI is having, in one screen.
 *
 * The screen exists to answer one question quickly: who is worth a message right
 * now. So the list is sortable by the things that actually decide that (how
 * interested the customer is, who replied most recently, who is waiting on us,
 * whose visit is soonest) and every filter narrows the same set the group builder
 * then acts on.
 *
 * That last part is the important bit of plumbing. "Select these customers and use
 * them in WhatsApp Outreach" is implemented by materialising the selection as an
 * ordinary named contact list — the same object a spreadsheet upload creates. So a
 * group inherits every campaign rule that already exists (dedupe, skip reasons,
 * not-messaged-only, auto-nurture) without a single new line of campaign code, and
 * it shows up in the Outreach list picker straight away.
 *
 * Ticking rows only ever selects what is on screen. "Select all N matching" is a
 * separate, explicit choice, and the backend re-reads the filters from the query
 * string in that case — the client cannot widen the set by editing a request.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import ChatPanel from "@/components/messages/ChatPanel";
import MessageFilters from "@/components/messages/MessageFilters";
import ThreadList from "@/components/messages/ThreadList";
import { FIELD, LABEL } from "@/components/messages/tokens";
import { ApiError } from "@/lib/api";
import {
  activeFilterCount,
  createGroup,
  DEFAULT_INBOX_SORT,
  getInboxVocabulary,
  getThread,
  INBOX_COUNT_LABELS,
  listMessages,
  listThreads,
  sendManualMessage,
  type FilterVocabulary,
  type InboxFilters,
  type InboxMessage,
  type InboxThread,
  type InboxThreadDetail,
  type InboxThreadPage,
} from "@/lib/inbox";

const PAGE_SIZE = 25;
const MESSAGE_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

/** The counts strip doubles as one-click filters, in the order a broker triages. */
const COUNT_FILTERS: { key: string; patch: Partial<InboxFilters> | null }[] = [
  { key: "total", patch: null },
  { key: "awaiting_reply", patch: { awaiting: true } },
  { key: "hot", patch: { band: "hot" } },
  { key: "inside_window", patch: { window: "open" } },
  { key: "scheduled", patch: { scheduled: true } },
  { key: "replied", patch: { replied: true } },
];

export default function MessagesWorkspace() {
  const [vocabulary, setVocabulary] = useState<FilterVocabulary | null>(null);

  const [filters, setFilters] = useState<InboxFilters>({});
  const [sort, setSort] = useState<string>(DEFAULT_INBOX_SORT);
  const [offset, setOffset] = useState(0);
  const [searchInput, setSearchInput] = useState("");

  const [page, setPage] = useState<InboxThreadPage | null>(null);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<InboxThreadDetail | null>(null);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [groupName, setGroupName] = useState("");
  const [selectAllMatching, setSelectAllMatching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [madeGroup, setMadeGroup] = useState<{ id: string; name: string; rows: number } | null>(
    null,
  );

  const [notice, setNotice] = useState("");
  const say = useCallback((message: string) => setNotice(message), []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  // Typing narrows the list, but not once per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((current) => {
        const term = searchInput.trim();
        if ((current.search || "") === term) return current;
        return { ...current, search: term || undefined };
      });
      setOffset(0);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void (async () => {
      try {
        setVocabulary(await getInboxVocabulary());
      } catch {
        // The controls fall back to the bundled vocabulary, so this is not fatal.
      }
    })();
  }, []);

  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      setPage(await listThreads({ filters, sort, limit: PAGE_SIZE, offset }));
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not load the chats.");
    } finally {
      setLoadingThreads(false);
    }
  }, [filters, sort, offset, say]);

  useEffect(() => {
    void loadThreads();
  }, [loadThreads]);

  const openThread = useCallback(
    async (conversationId: string) => {
      setActiveId(conversationId);
      setLoadingThread(true);
      try {
        const [threadDetail, messagePage] = await Promise.all([
          getThread(conversationId),
          listMessages(conversationId, { limit: MESSAGE_PAGE_SIZE }),
        ]);
        setDetail(threadDetail);
        setMessages(messagePage.items);
        setHasMore(messagePage.has_more);
      } catch (error) {
        say(error instanceof ApiError ? error.message : "Could not open that chat.");
      } finally {
        setLoadingThread(false);
      }
    },
    [say],
  );

  /** Offset walks backwards from the latest message, so older pages prepend. */
  const loadOlder = useCallback(async () => {
    if (!activeId) return;
    setLoadingOlder(true);
    try {
      const older = await listMessages(activeId, {
        limit: MESSAGE_PAGE_SIZE,
        offset: messages.length,
      });
      setMessages((current) => [...older.items, ...current]);
      setHasMore(older.has_more);
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not load older messages.");
    } finally {
      setLoadingOlder(false);
    }
  }, [activeId, messages.length, say]);

  const send = useCallback(
    async (text: string) => {
      if (!activeId) return false;
      setSending(true);
      try {
        const result = await sendManualMessage(activeId, text);
        if (!result.sent) {
          say(result.error || "WhatsApp would not accept that message.");
          return false;
        }
        if (result.message) {
          const appended = result.message;
          setMessages((current) => [...current, appended]);
        }
        say("Sent to their WhatsApp.");
        // The reply counters and the window clock both moved, so refresh the
        // header and the row rather than leaving stale numbers on screen.
        void openThread(activeId);
        void loadThreads();
        return true;
      } catch (error) {
        say(error instanceof ApiError ? error.message : "Could not send that message.");
        return false;
      } finally {
        setSending(false);
      }
    },
    [activeId, say, openThread, loadThreads],
  );

  // --- filters ---------------------------------------------------------------

  const patchFilters = useCallback((patch: Partial<InboxFilters>) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      for (const key of Object.keys(next) as (keyof InboxFilters)[]) {
        if (next[key] === undefined) delete next[key];
      }
      return next;
    });
    setOffset(0);
    setSelectAllMatching(false);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchInput("");
    setOffset(0);
    setSelectAllMatching(false);
  }, []);

  const activeCount = useMemo(() => activeFilterCount(filters), [filters]);
  const filtered = activeCount > 0;
  // Memoised because `toggleAllOnPage` closes over it: a fresh [] each render
  // would rebuild that callback every time and re-render every row with it.
  const threads: InboxThread[] = useMemo(() => page?.items ?? [], [page]);
  const total = page?.total ?? 0;
  const counts = page?.counts ?? {};

  // --- selection -------------------------------------------------------------

  const toggleSelect = useCallback((conversationId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(conversationId)) next.delete(conversationId);
      else next.add(conversationId);
      return next;
    });
    setSelectAllMatching(false);
  }, []);

  const toggleAllOnPage = useCallback(() => {
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = threads.every((thread) => next.has(thread.conversation_id));
      for (const thread of threads) {
        if (allSelected) next.delete(thread.conversation_id);
        else next.add(thread.conversation_id);
      }
      return next;
    });
    setSelectAllMatching(false);
  }, [threads]);

  const clearSelection = useCallback(() => {
    setSelected(new Set());
    setSelectAllMatching(false);
    setGroupName("");
  }, []);

  const groupSize = selectAllMatching ? total : selected.size;

  const makeGroup = useCallback(async () => {
    if (groupSize === 0) return;
    setCreating(true);
    try {
      const result = await createGroup({
        name: groupName.trim() || undefined,
        conversationIds: selectAllMatching ? [] : Array.from(selected),
        selectAllMatching,
        filters,
      });
      setMadeGroup({ id: result.dataset_id, name: result.name, rows: result.row_count });
      setSelected(new Set());
      setSelectAllMatching(false);
      setGroupName("");
      say(result.message);
    } catch (error) {
      say(error instanceof ApiError ? error.message : "Could not build that group.");
    } finally {
      setCreating(false);
    }
  }, [groupSize, groupName, selectAllMatching, selected, filters, say]);

  return (
    <div>
      <PageBreadcrumb pageTitle="Messages" />

      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white/90">
            Every conversation, in one place
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Read what the AI said and what the customer answered, see how interested
            they are before you spend a message, and step in yourself when something
            important needs saying.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void loadThreads();
            if (activeId) void openThread(activeId);
          }}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
        >
          Refresh
        </button>
      </div>

      {/* One strip rather than six floating cards, split by hairlines. The rules
          are the 1px parent background showing through a `gap-px` grid, which is
          the only way they stay clean at every breakpoint the grid wraps at. */}
      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 bg-gray-200 sm:grid-cols-3 lg:grid-cols-6 dark:border-gray-800 dark:bg-gray-800">
        {COUNT_FILTERS.map(({ key, patch }) => {
          const on = patch
            ? Object.entries(patch).every(
                ([name, value]) => filters[name as keyof InboxFilters] === value,
              )
            : activeCount === 0;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => (patch ? patchFilters(patch) : clearFilters())}
              className={`px-4 py-3.5 text-left transition ${
                on
                  ? "bg-brand-50 dark:bg-brand-500/10"
                  : "bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-white/[0.03]"
              }`}
            >
              <p
                className={`text-xl font-semibold tabular-nums ${
                  on
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-gray-800 dark:text-white/90"
                }`}
              >
                {counts[key as keyof typeof counts] ?? 0}
              </p>
              <p className="mt-0.5 text-[11px] leading-snug text-gray-500">
                {INBOX_COUNT_LABELS[key]}
              </p>
            </button>
          );
        })}
      </div>

      {madeGroup && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-4 dark:border-brand-500/40 dark:bg-brand-500/10">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            <span className="font-medium">“{madeGroup.name}”</span> is ready with{" "}
            {madeGroup.rows} customer{madeGroup.rows === 1 ? "" : "s"}. Message them on
            WhatsApp, or have the AI call them.
          </p>
          <div className="flex items-center gap-2">
            <a
              href={`/outreach?dataset=${encodeURIComponent(madeGroup.id)}`}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600"
            >
              Message on WhatsApp
            </a>
            <a
              href={`/calls?dataset=${encodeURIComponent(madeGroup.id)}`}
              className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              Call this group
            </a>
            <button
              type="button"
              onClick={() => setMadeGroup(null)}
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        {/* --- list column ---------------------------------------------------- */}
        <div className="flex max-h-[calc(100vh-13rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          {/* Two scroll regions, and their height budgets only make sense read
              together. The filter rail is around twice this column's height, so
              it has to scroll — and a flex child cannot scroll unless it is also
              allowed to shrink, which is what `min-h-0` permits. Without it the
              rail keeps its full content height and the column's
              `overflow-hidden` silently clips the last filters off the bottom
              with no way to reach them. The cap stops the rail from eating a tall
              screen; the list's floor stops it being squeezed to nothing on a
              short one; the pager never shrinks at all. */}
          <div className="max-h-[26rem] min-h-0 overflow-y-auto border-b border-gray-200 dark:border-gray-800">
            <MessageFilters
              filters={filters}
              sort={sort}
              vocabulary={vocabulary}
              activeCount={activeCount}
              searchInput={searchInput}
              onSearchInput={setSearchInput}
              onPatch={patchFilters}
              onSort={(next) => {
                setSort(next);
                setOffset(0);
              }}
              onClear={clearFilters}
            />
          </div>

          <div className="min-h-[12rem] flex-1 overflow-y-auto">
            <ThreadList
              threads={threads}
              loading={loadingThreads}
              filtered={filtered}
              activeId={activeId}
              selected={selected}
              onOpen={(thread) => void openThread(thread.conversation_id)}
              onToggleSelect={toggleSelect}
              onToggleAllOnPage={toggleAllOnPage}
            />
          </div>

          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 px-4 py-2.5 dark:border-gray-800">
            <span className="text-[11px] text-gray-500">
              {threads.length ? offset + 1 : 0}–{offset + threads.length} of {total}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loadingThreads || offset === 0}
                onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={loadingThreads || offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
                className="rounded-lg border border-gray-300 px-2.5 py-1 text-[11px] font-medium text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {/* --- chat column ---------------------------------------------------- */}
        <div className="flex max-h-[calc(100vh-13rem)] min-h-[32rem] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <ChatPanel
            detail={detail}
            messages={messages}
            hasMore={hasMore}
            loading={loadingThread}
            loadingOlder={loadingOlder}
            sending={sending}
            onLoadOlder={() => void loadOlder()}
            onSend={send}
            onRefresh={() => {
              if (activeId) void openThread(activeId);
            }}
          />
        </div>
      </div>

      {/* --- group builder --------------------------------------------------- */}
      {(selected.size > 0 || selectAllMatching) && (
        <div className="sticky bottom-4 z-40 mt-5 rounded-2xl border border-brand-200 bg-white px-5 py-4 shadow-theme-lg dark:border-brand-500/40 dark:bg-gray-900">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {groupSize} customer{groupSize === 1 ? "" : "s"} selected
              </p>
              <p className="mt-0.5 text-[11px] text-gray-500">
                Name them and they become a list you can pick in WhatsApp Outreach.
                Duplicate phone numbers are merged, so nobody gets messaged twice.
              </p>
              {filtered && total > threads.length && (
                <label className="mt-2 flex items-center gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                  <input
                    type="checkbox"
                    checked={selectAllMatching}
                    onChange={(event) => setSelectAllMatching(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-500 focus:ring-brand-500"
                  />
                  Use all {total} customers matching these filters, not just this page
                </label>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className={`${LABEL} mb-1`}>Group name</span>
                <input
                  type="text"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Hot leads · Whitefield 3BHK"
                  className={`${FIELD} w-64`}
                />
              </label>
              <button
                type="button"
                onClick={() => void makeGroup()}
                disabled={creating || groupSize === 0}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {creating ? "Building…" : "Create group"}
              </button>
              <button
                type="button"
                onClick={clearSelection}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
          {notice}
        </div>
      )}
    </div>
  );
}
