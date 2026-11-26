"use client";

/**
 * Recently deleted contacts and leads (last 90 days), each restorable in one tap.
 * Deleting never removed their details, chats or history, so a restore brings the
 * record back whole. Collapsed by default: it is a safety net, not daily work.
 */

import { useCallback, useState } from "react";
import { ApiError } from "@/lib/api";
import { getDeletedContacts, getDeletedLeads, restoreRecord, type DeletedRecord } from "@/lib/leadSources";

type Row = DeletedRecord & { kind: "contacts" | "leads" };

export default function RecentlyDeletedPanel({ onRestored }: { onRestored?: () => void }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [contacts, leads] = await Promise.all([getDeletedContacts(), getDeletedLeads()]);
      setRows([
        ...contacts.map((row) => ({ ...row, kind: "contacts" as const })),
        ...leads.map((row) => ({ ...row, kind: "leads" as const })),
      ]);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not load deleted records.");
      setRows([]);
    }
  }, []);

  const restore = async (row: Row) => {
    setBusy(row.id);
    try {
      await restoreRecord(row.kind, row.id);
      setRows((list) => (list ?? []).filter((item) => item.id !== row.id));
      setNotice(`${row.name || row.phone || "Record"} is restored.`);
      onRestored?.();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not restore it.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next && rows === null) void load();
        }}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-800 dark:text-white/90">Recently deleted</span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Contacts and leads deleted in the last 90 days. Restoring brings back their details, chats and history.
          </span>
        </span>
        <span className="text-sm text-gray-500">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="mt-3">
          {notice ? <p className="mb-2 text-sm text-gray-600 dark:text-gray-300">{notice}</p> : null}
          {rows === null ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing has been deleted recently.</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((row) => (
                <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-gray-800 dark:text-white/90">{row.name || "Unnamed"}</span>
                    <span className="block text-xs text-gray-500">
                      {row.kind === "contacts" ? "Contact" : "Lead"}
                      {row.phone ? ` · ${row.phone}` : ""}
                    </span>
                  </span>
                  <button
                    type="button"
                    disabled={busy !== ""}
                    onClick={() => void restore(row)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    {busy === row.id ? "Restoring…" : "Restore"}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}
