"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, failureText } from "@/lib/api";
import {
  clearAdminSession,
  decideAccount,
  fetchQueueCounts,
  getAdminToken,
  getStoredAdmin,
  listAccounts,
  type AccountFilter,
  type AccountReview,
  type QueueCounts,
} from "@/lib/adminApi";

const PAGE_SIZE = 25;

const TABS: { key: AccountFilter; label: string }[] = [
  { key: "pending", label: "Awaiting verification" },
  { key: "active", label: "Verified" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All accounts" },
];

const METHOD_LABELS: Record<string, string> = {
  upi: "UPI",
  bank_transfer: "Bank transfer",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function StatusChip({ status }: { status: string }) {
  const tone =
    status === "active"
      ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
      : status === "pending_verification"
        ? "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
        : status === "no_plan"
          ? "bg-gray-100 text-gray-600 dark:bg-white/[0.06] dark:text-gray-300"
          : "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400";
  const label =
    status === "pending_verification"
      ? "Awaiting verification"
      : status === "no_plan"
        ? "No plan chosen"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}>{label}</span>
  );
}

export default function AdminReviewClient() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<AccountFilter>("pending");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<AccountReview[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [counts, setCounts] = useState<QueueCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const admin = getStoredAdmin();

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    setReady(true);
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, queue] = await Promise.all([
        listAccounts({ status: tab, search, page, pageSize: PAGE_SIZE }),
        fetchQueueCounts(),
      ]);
      setRows(result.items);
      setTotal(result.total);
      setPages(result.pages);
      setCounts(queue);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/admin/login");
        return;
      }
      setError(failureText(err, "Could not load the review queue."));
    } finally {
      setLoading(false);
    }
  }, [tab, search, page, router]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const decide = async (
    userId: string,
    decision: "approve" | "reject" | "revoke",
  ) => {
    setBusy(`${userId}:${decision}`);
    setError("");
    try {
      await decideAccount(userId, decision, notes[userId]);
      setNotes((current) => ({ ...current, [userId]: "" }));
      await load();
    } catch (err) {
      setError(failureText(err, "Could not record that decision."));
    } finally {
      setBusy(null);
    }
  };

  const signOut = () => {
    clearAdminSession();
    router.replace("/admin/login");
  };

  if (!ready) return null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
            EstateFlow operator
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">
            Account verification
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Confirm the payment against your bank statement, then open the account.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            {admin?.name || admin?.email}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="mt-1 text-xs text-gray-500 underline hover:text-gray-700 dark:text-gray-400"
          >
            Sign out
          </button>
        </div>
      </header>

      {counts ? (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl border border-warning-200 bg-warning-50/50 p-4 dark:border-warning-500/30 dark:bg-warning-500/10">
            <p className="text-xs font-medium text-warning-700 dark:text-warning-400">
              Awaiting verification
            </p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {counts.pending}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs font-medium text-gray-500">Verified</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {counts.active}
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
            <p className="text-xs font-medium text-gray-500">Rejected</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
              {counts.rejected}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setTab(item.key);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                tab === item.key
                  ? "bg-brand-500 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 dark:bg-white/[0.03] dark:text-gray-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          placeholder="Name, email or payment reference"
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white sm:w-80"
        />
      </div>

      {error ? (
        <p className="mb-4 rounded-lg bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/10">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">
          {tab === "pending"
            ? "Nothing waiting. Every request has been decided."
            : "No accounts here yet."}
        </p>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <article
              key={row.user_id}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">
                      {row.full_name}
                    </h2>
                    <StatusChip status={row.status} />
                  </div>
                  <p className="mt-1 text-sm text-gray-500">{row.email}</p>
                  <p className="text-sm text-gray-500">
                    {row.organization_name || "—"}
                    {row.phone ? ` · ${row.phone}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    Signed up {formatDate(row.signed_up_at)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                    {row.plan_name || "No plan chosen"}
                  </p>
                  {row.plan_price_inr ? (
                    <p className="text-xl font-semibold text-gray-900 dark:text-white">
                      ₹{row.plan_price_inr.toLocaleString("en-IN")}
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-gray-400">
                    Requested {formatDate(row.requested_at)}
                  </p>
                </div>
              </div>

              {row.payment ? (
                <dl className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-4 text-sm dark:bg-white/[0.04] sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-gray-500">Reference</dt>
                    <dd className="mt-0.5 font-mono text-gray-900 dark:text-white/90">
                      {row.payment.reference}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Method</dt>
                    <dd className="mt-0.5 text-gray-900 dark:text-white/90">
                      {METHOD_LABELS[row.payment.method] || row.payment.method}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-500">Note</dt>
                    <dd className="mt-0.5 text-gray-700 dark:text-gray-300">
                      {row.payment.note || "—"}
                    </dd>
                  </div>
                </dl>
              ) : null}

              {row.reviewed_at ? (
                <p className="mt-3 text-xs text-gray-500">
                  {row.status === "active" ? "Approved" : "Decided"} {formatDate(row.reviewed_at)}
                  {row.reviewed_by ? ` by ${row.reviewed_by}` : ""}
                  {row.review_note ? ` — “${row.review_note}”` : ""}
                </p>
              ) : null}

              {row.status === "pending_verification" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <input
                    type="text"
                    value={notes[row.user_id] || ""}
                    placeholder="Note for the record (optional)"
                    onChange={(event) =>
                      setNotes((current) => ({
                        ...current,
                        [row.user_id]: event.target.value,
                      }))
                    }
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
                  />
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decide(row.user_id, "reject")}
                    className="rounded-lg border border-error-300 px-4 py-2 text-sm font-medium text-error-600 hover:bg-error-50 disabled:opacity-50 dark:border-error-500/40"
                  >
                    {busy === `${row.user_id}:reject` ? "Rejecting…" : "Reject"}
                  </button>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decide(row.user_id, "approve")}
                    className="rounded-lg bg-success-500 px-4 py-2 text-sm font-medium text-white hover:bg-success-600 disabled:opacity-50"
                  >
                    {busy === `${row.user_id}:approve`
                      ? "Approving…"
                      : "Payment received — open account"}
                  </button>
                </div>
              ) : row.status === "active" ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <p className="min-w-0 flex-1 text-xs text-gray-500">
                    Access until {formatDate(row.ends_at)}
                  </p>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void decide(row.user_id, "revoke")}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    {busy === `${row.user_id}:revoke` ? "Revoking…" : "Revoke access"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {pages > 1 ? (
        <nav className="mt-6 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
          >
            Previous
          </button>
          <p className="text-sm text-gray-500">
            Page {page} of {pages} · {total} account{total === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((current) => Math.min(pages, current + 1))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
