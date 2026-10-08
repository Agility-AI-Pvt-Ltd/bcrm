"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import {
  closeRegistration,
  formatDay,
  getAttributionSettings,
  isExpiringSoon,
  listRegistrations,
  registerLead,
  saveAttributionSettings,
  shortHash,
  STATUS_CHIP,
  STATUS_LABELS,
  verifyChain,
  type AttributionSettings,
  type ChainReport,
  type Registration,
} from "@/lib/attribution";
import DossierPanel from "./DossierPanel";

const input =
  "h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

/**
 * Lead registration: who claimed this buyer, and when.
 *
 * The timestamp is the whole feature. Developers pay the broker whose registration is
 * earliest, so every record is stamped by the server and linked into a hash chain —
 * a record cannot be moved earlier in the order afterwards without the verification
 * on this page reporting it.
 */
export default function AttributionPage() {
  const [rows, setRows] = useState<Registration[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [chain, setChain] = useState<ChainReport | null>(null);
  const [settings, setSettings] = useState<AttributionSettings | null>(null);
  const [mine, setMine] = useState(false);
  const [form, setForm] = useState({
    customer_phone: "",
    customer_name: "",
    project_name: "",
    developer_name: "",
  });
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [list, report, loaded] = await Promise.all([
        listRegistrations({ mine }),
        verifyChain(),
        getAttributionSettings(),
      ]);
      setRows(list.items);
      setCounts(list.counts);
      setChain(report);
      setSettings(loaded);
      setError("");
    } catch (err) {
      setError(failureText(err, "Could not load registrations."));
    }
  }, [mine]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timer);
  }, [notice]);

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
          ? `Recorded as ${created.registration_no}, but contested — ${created.status_note}`
          : `Registered as ${created.registration_no}. Holds until ${formatDay(created.valid_until)}.`,
      );
      setForm({ customer_phone: "", customer_name: "", project_name: "", developer_name: "" });
      void load();
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
      void load();
    } catch (err) {
      setError(failureText(err, "Could not update that registration."));
    } finally {
      setBusy("");
    }
  };

  const onWindowChange = async (days: number) => {
    try {
      setSettings(await saveAttributionSettings({ valid_days: days }));
      setNotice(`New registrations will hold for ${days} days.`);
      void load();
    } catch (err) {
      setError(failureText(err, "Could not save that window."));
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Lead registration
            </h3>
            <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
              Register a buyer the moment they show interest. The timestamp is the
              server&apos;s and every record is linked to the one before it, so your
              claim&apos;s place in the order can be shown rather than argued.
            </p>
          </div>
          {settings ? (
            <label className="text-sm">
              <span className="mb-1.5 block text-gray-500">A claim holds for</span>
              <select
                value={String(settings.valid_days)}
                onChange={(event) => void onWindowChange(Number(event.target.value))}
                className={`${input} w-32`}
              >
                {[15, 30, 45, 60, 90, 120, 180].map((days) => (
                  <option key={days} value={String(days)}>
                    {days} days
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {chain ? (
          <p
            className={`mt-4 rounded-xl px-3 py-2.5 text-sm ${
              chain.intact
                ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-500"
                : "bg-error-50 text-error-600 dark:bg-error-500/10 dark:text-error-500"
            }`}
          >
            {chain.intact
              ? `${chain.checked} registrations, history unbroken.`
              : `History broken at ${chain.breaks[0]?.registration_no} — ${chain.breaks[0]?.reason}`}
          </p>
        ) : null}

        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

        <form onSubmit={onRegister} className="mt-5 flex flex-wrap items-end gap-3">
          {[
            { key: "customer_phone" as const, label: "Buyer's phone", width: "w-44" },
            { key: "customer_name" as const, label: "Buyer's name", width: "w-44" },
            { key: "project_name" as const, label: "Project", width: "w-52" },
            { key: "developer_name" as const, label: "Developer", width: "w-44" },
          ].map((item) => (
            <label key={item.key} className="block text-sm">
              <span className="mb-1.5 block text-gray-500">{item.label}</span>
              <input
                value={form[item.key]}
                onChange={(event) =>
                  setForm((current) => ({ ...current, [item.key]: event.target.value }))
                }
                className={`${input} ${item.width}`}
              />
            </label>
          ))}
          <button
            type="submit"
            disabled={saving || !form.customer_phone.trim() || !form.project_name.trim()}
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Registering…" : "Register now"}
          </button>
        </form>
      </section>

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Registrations
          </h3>
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={mine}
              onChange={(event) => setMine(event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-500"
            />
            Only mine
          </label>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {Object.entries(counts).map(([status, count]) => (
            <span
              key={status}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_CHIP[status] || STATUS_CHIP.expired
              }`}
            >
              {STATUS_LABELS[status] || status}: {count}
            </span>
          ))}
        </div>

        {rows.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[52rem] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500 dark:border-gray-800 dark:text-gray-400">
                  <th className="py-2 pr-4 font-medium">Registration</th>
                  <th className="py-2 pr-4 font-medium">Buyer</th>
                  <th className="py-2 pr-4 font-medium">Project</th>
                  <th className="py-2 pr-4 font-medium">Registered</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 last:border-0 dark:border-gray-800/60"
                  >
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs text-gray-800 dark:text-white/90">
                        {row.registration_no}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-gray-400">
                        #{row.chain_index} · {shortHash(row.content_hash)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-800 dark:text-white/90">
                      {row.customer_name || "—"}
                      <span className="mt-0.5 block text-xs text-gray-500">
                        {row.customer_phone}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {row.project_name}
                      {row.developer_name ? (
                        <span className="mt-0.5 block text-xs text-gray-500">
                          {row.developer_name}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-gray-300">
                      {formatDay(row.registered_at)}
                      <span
                        className={`mt-0.5 block text-xs ${
                          isExpiringSoon(row, settings?.expiry_warning_days ?? 7)
                            ? "text-warning-600"
                            : "text-gray-500"
                        }`}
                      >
                        {row.expiry_label}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          STATUS_CHIP[row.status] || STATUS_CHIP.expired
                        }`}
                      >
                        {STATUS_LABELS[row.status] || row.status}
                      </span>
                      {row.status_note ? (
                        <span className="mt-1 block text-xs text-gray-500">
                          {row.status_note}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      {row.status === "active" ? (
                        <span className="flex flex-wrap justify-end gap-2">
                          <button
                            type="button"
                            disabled={busy === row.id}
                            onClick={() => void onClose(row, "converted")}
                            className="text-xs text-brand-500 underline underline-offset-2 disabled:opacity-50"
                          >
                            Converted
                          </button>
                          <button
                            type="button"
                            disabled={busy === row.id}
                            onClick={() => void onClose(row, "released")}
                            className="text-xs text-gray-500 underline underline-offset-2 disabled:opacity-50"
                          >
                            Release
                          </button>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
            Nothing registered yet. Register a buyer above as soon as they name a
            project — the claim that counts is the earliest one.
          </p>
        )}
      </section>

      <DossierPanel />
    </div>
  );
}
