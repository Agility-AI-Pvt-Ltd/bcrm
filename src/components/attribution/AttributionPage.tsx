"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  closeRegistration,
  formatDay,
  formatStamp,
  getAttributionSettings,
  isExpiringSoon,
  listRegistrations,
  registerLead,
  STATUS_CHIP,
  STATUS_LABELS,
  type Registration,
  type RegistrationFilters,
} from "@/lib/attribution";
import DossierPanel from "./DossierPanel";

const PAGE_SIZE = 25;
const input =
  "h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-white/[0.03] dark:text-white/90";
const STATUS_ORDER = ["active", "contested", "converted", "expired", "released"];

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 7) return value;
  return `${value.slice(0, Math.max(0, value.length - 7))}•••${digits.slice(-4)}`;
}

function hasFilters(filters: RegistrationFilters): boolean {
  return Boolean(
    filters.search ||
      filters.status ||
      filters.project ||
      filters.developer ||
      filters.registered_from ||
      filters.registered_to ||
      filters.mine,
  );
}

function MetricCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
        {label}
      </span>
      <span className={`mt-2 block text-2xl font-semibold ${tone}`}>{value}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-sm dark:bg-white/[0.03] ${
        active
          ? "border-brand-500 ring-2 ring-brand-500/10"
          : "border-gray-200 dark:border-gray-800"
      }`}
    >
      {content}
    </button>
  ) : (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      {content}
    </div>
  );
}

export default function AttributionPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [total, setTotal] = useState(0);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof getAttributionSettings>> | null>(null);
  const [filters, setFilters] = useState<RegistrationFilters>({ sort: "registered_at_desc" });
  const [page, setPage] = useState(0);
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [form, setForm] = useState({
    customer_phone: "",
    customer_name: "",
    project_name: "",
    developer_name: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshedAt, setRefreshedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, loaded] = await Promise.all([
        listRegistrations({ ...filters, limit: PAGE_SIZE, offset: page * PAGE_SIZE }),
        getAttributionSettings(),
      ]);
      setRows(list.items);
      setCounts(list.counts);
      setTotal(list.total);
      setSettings(loaded);
      setRefreshedAt(new Date());
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load lead protection data."));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

  const updateFilter = (
    key: keyof RegistrationFilters,
    value: string | boolean | undefined,
  ) => {
    setPage(0);
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  };

  const clearFilters = () => {
    setPage(0);
    setFilters({ sort: "registered_at_desc" });
  };

  const onRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const created = await registerLead({
        customer_phone: form.customer_phone.trim(),
        project_name: form.project_name.trim(),
        customer_name: form.customer_name.trim() || null,
        developer_name: form.developer_name.trim() || null,
        source: "manual",
      });
      setNotice(
        created.status === "contested"
          ? `Recorded as ${created.registration_no}, but contested. ${created.status_note || ""}`
          : `Registered as ${created.registration_no}. Holds until ${formatDay(created.valid_until)}.`,
      );
      setForm({ customer_phone: "", customer_name: "", project_name: "", developer_name: "" });
      setManualOpen(false);
      await load();
    } catch (err) {
      setError(failureText(err, "Could not register that lead."));
    } finally {
      setSaving(false);
    }
  };

  const onClose = async (row: Registration, status: "converted" | "released") => {
    setBusy(row.id);
    setError("");
    try {
      await closeRegistration(row.id, status);
      setNotice(status === "converted" ? "Claim marked as converted." : "Claim released.");
      await load();
    } catch (err) {
      setError(failureText(err, "Could not update that registration."));
    } finally {
      setBusy("");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = hasFilters(filters);
  const activeStatus = filters.status || "";

  return (
    <div className="space-y-5 pb-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-500">
            Commission protection
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-gray-900 dark:text-white/95">
            Lead Protection
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Track buyer ownership, protect commission claims, and resolve disputes with conversation evidence.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {refreshedAt ? <span>Updated {refreshedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span> : null}
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-medium text-gray-700 transition hover:border-brand-400 hover:text-brand-600 disabled:opacity-50 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-200"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-medium underline underline-offset-2">
            Retry
          </button>
        </div>
      ) : null}
      {notice ? <p className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-400">{notice}</p> : null}

      <section className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <MetricCard label="Total claims" value={total} tone="text-gray-900 dark:text-white" onClick={clearFilters} active={!activeStatus && !filtered} />
        <MetricCard label="Active claims" value={counts.active || 0} tone="text-success-600" onClick={() => updateFilter("status", "active")} active={activeStatus === "active"} />
        <MetricCard label="Contested" value={counts.contested || 0} tone="text-error-600" onClick={() => updateFilter("status", "contested")} active={activeStatus === "contested"} />
        <MetricCard label="Converted" value={counts.converted || 0} tone="text-brand-600" onClick={() => updateFilter("status", "converted")} active={activeStatus === "converted"} />
        <MetricCard label="Expiring soon" value={counts.expiring_soon || 0} tone="text-warning-600" onClick={() => updateFilter("status", "active")} active={activeStatus === "active"} />
      </section>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-200 p-4 dark:border-gray-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white/95">Lead registrations</h2>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">Claims are created by qualifying WhatsApp intent or by staff fallback registration.</p>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
              <input type="checkbox" checked={Boolean(filters.mine)} onChange={(event) => updateFilter("mine", event.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-500" />
              Only mine
            </label>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
            <input aria-label="Search registrations" value={filters.search || ""} onChange={(event) => updateFilter("search", event.target.value)} placeholder="Search buyer, phone, project…" className={`${input} lg:col-span-2`} />
            <input aria-label="Filter by project" value={filters.project || ""} onChange={(event) => updateFilter("project", event.target.value)} placeholder="Project" className={input} />
            <input aria-label="Filter by developer" value={filters.developer || ""} onChange={(event) => updateFilter("developer", event.target.value)} placeholder="Developer" className={input} />
            <select aria-label="Filter by status" value={filters.status || ""} onChange={(event) => updateFilter("status", event.target.value)} className={input}>
              <option value="">All statuses</option>
              {STATUS_ORDER.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
            </select>
            <select aria-label="Sort registrations" value={filters.sort || "registered_at_desc"} onChange={(event) => updateFilter("sort", event.target.value as RegistrationFilters["sort"])} className={input}>
              <option value="registered_at_desc">Newest first</option>
              <option value="registered_at_asc">Oldest first</option>
              <option value="valid_until_asc">Expiry soonest</option>
              <option value="valid_until_desc">Expiry latest</option>
              <option value="status_asc">Status A–Z</option>
            </select>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="text-xs text-gray-500">From <input type="date" value={filters.registered_from?.slice(0, 10) || ""} onChange={(event) => updateFilter("registered_from", event.target.value ? `${event.target.value}T00:00:00Z` : "")} className={`${input} ml-1 h-9`} /></label>
            <label className="text-xs text-gray-500">To <input type="date" value={filters.registered_to?.slice(0, 10) || ""} onChange={(event) => updateFilter("registered_to", event.target.value ? `${event.target.value}T23:59:59Z` : "")} className={`${input} ml-1 h-9`} /></label>
            {filtered ? <button type="button" onClick={clearFilters} className="ml-auto text-xs font-medium text-brand-600 underline underline-offset-2">Clear filters</button> : null}
          </div>
        </div>

        {loading ? <div className="p-10 text-center text-sm text-gray-500">Loading registrations…</div> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[60rem] text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Buyer</th>
                  <th className="px-4 py-3 font-medium">Project / developer</th>
                  <th className="px-4 py-3 font-medium">Registered by</th>
                  <th className="px-4 py-3 font-medium">Registered</th>
                  <th className="px-4 py-3 font-medium">Claim</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-gray-100 dark:border-gray-800/70">
                    <td className="px-4 py-3"><button type="button" onClick={() => setSelectedPhone(row.customer_phone)} className="text-left font-medium text-gray-900 hover:text-brand-600 dark:text-white/90">{row.customer_name || "Unnamed buyer"}<span className="mt-0.5 block text-xs text-gray-500">{maskPhone(row.customer_phone)}</span></button></td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{row.project_name}<span className="mt-0.5 block text-xs text-gray-500">{row.developer_name || "Developer not recorded"}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-500">{row.agent_user_id ? `Agent ${row.agent_user_id.slice(0, 8)}` : "System / unassigned"}<span className="mt-0.5 block">{row.source || "source unavailable"}</span></td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{formatStamp(row.registered_at)}<span className={`mt-0.5 block text-xs ${isExpiringSoon(row, settings?.expiry_warning_days ?? 7) ? "text-warning-600" : "text-gray-500"}`}>{row.expiry_label}</span></td>
                    <td className="px-4 py-3"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CHIP[row.status] || STATUS_CHIP.expired}`}>{STATUS_LABELS[row.status] || row.status}</span>{row.status_note ? <span className="mt-1 block max-w-40 text-xs text-gray-500">{row.status_note}</span> : null}</td>
                    <td className="px-4 py-3 text-right"><div className="flex justify-end gap-3"><button type="button" onClick={() => setSelectedPhone(row.customer_phone)} className="text-xs font-medium text-brand-600 hover:underline">View dossier</button>{row.status === "active" ? <button type="button" disabled={busy === row.id} onClick={() => void onClose(row, "converted")} className="text-xs text-gray-500 hover:text-brand-600 disabled:opacity-50">Mark converted</button> : null}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">{filtered ? "No registrations match these filters" : "No lead claims yet"}</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-gray-500 dark:text-gray-400">{filtered ? "Try clearing a filter or searching for a different buyer, project, or developer." : "Eligible WhatsApp conversations create claims when the AI detects genuine buying intent. Staff can use manual registration as a fallback."}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-gray-800">
          <span>{total ? `Showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total}` : "No results"}</span>
          <div className="flex gap-2"><button type="button" disabled={page === 0 || loading} onClick={() => setPage((current) => current - 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Previous</button><button type="button" disabled={page + 1 >= totalPages || loading} onClick={() => setPage((current) => current + 1)} className="rounded-md border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700">Next</button></div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <details open={manualOpen} onToggle={(event) => setManualOpen(event.currentTarget.open)}>
          <summary className="cursor-pointer list-none px-4 py-4 text-sm font-semibold text-gray-900 marker:hidden dark:text-white/95">Register lead manually <span className="ml-2 text-xs font-normal text-gray-500">Fallback for staff when a qualifying WhatsApp claim was not created</span></summary>
          <p className="border-t border-gray-200 px-4 pt-3 text-xs text-gray-500 dark:border-gray-800">New claims use the configured {settings?.valid_days ?? 90}-day validity period. Timestamps and ownership are assigned by the server.</p>
          <form onSubmit={onRegister} className="grid gap-3 border-t border-gray-200 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-gray-800">
            {[{ key: "customer_phone" as const, label: "Buyer phone", type: "tel" }, { key: "customer_name" as const, label: "Buyer name", type: "text" }, { key: "project_name" as const, label: "Project", type: "text" }, { key: "developer_name" as const, label: "Developer", type: "text" }].map((item) => <label key={item.key} className="text-xs font-medium text-gray-500">{item.label}<input required={item.key === "customer_phone" || item.key === "project_name"} type={item.type} value={form[item.key]} onChange={(event) => setForm((current) => ({ ...current, [item.key]: event.target.value }))} className={`${input} mt-1 w-full`} /></label>)}
            <button type="submit" disabled={saving || !form.customer_phone.trim() || !form.project_name.trim()} className="h-10 self-end rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">{saving ? "Registering…" : "Register fallback claim"}</button>
          </form>
        </details>
      </section>

      {selectedPhone ? <DossierPanel phone={selectedPhone} onClose={() => setSelectedPhone(null)} /> : null}
    </div>
  );
}
