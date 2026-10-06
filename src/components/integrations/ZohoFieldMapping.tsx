"use client";

import { useEffect, useMemo, useState } from "react";
import { failureText } from "@/lib/api";
import {
  getZohoMappings,
  saveZohoMappings,
  type ZohoMapping,
  type ZohoMappingChange,
  type ZohoMappingTarget,
} from "@/lib/zoho";

const TARGET_LABELS: Record<string, string> = {
  name: "Name",
  phone: "Phone",
  alternate_phone: "Alternate phone",
  email: "Email",
  status: "Lead status",
  source: "Lead source",
  notes: "Notes",
  budget: "Budget",
  property_interest: "Property interest",
  location: "Preferred location",
  owner_name: "Lead owner",
  first_name: "First name",
  last_name: "Last name",
  external_created_at: "Created in Zoho",
  external_updated_at: "Modified in Zoho",
};

const label = (target: string | null) => (target ? TARGET_LABELS[target] ?? target : "—");

/**
 * Standard Zoho fields are mapped automatically. Custom fields get one AI
 * suggestion each (from field names only, never lead data); sure matches are
 * applied, likely ones wait here for [Accept], and anything left unmapped is
 * still kept on the lead as a custom field. Nothing here has to be finished.
 */
export default function ZohoFieldMapping({
  refreshKey,
  onSaved,
}: {
  refreshKey: string;
  onSaved: () => void;
}) {
  const [rows, setRows] = useState<ZohoMapping[]>([]);
  const [targets, setTargets] = useState<ZohoMappingTarget[]>([]);
  const [pending, setPending] = useState<Record<string, ZohoMappingChange>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const data = await getZohoMappings();
        if (!alive) return;
        setRows(data.mappings);
        setTargets(data.targets);
      } catch (err) {
        if (alive) setError(failureText(err, "Could not load field mapping."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshKey]);

  const groups = useMemo(() => {
    const standard = rows.filter((r) => r.mapping_source === "standard");
    const suggested = rows.filter((r) => r.status === "suggested");
    const custom = rows.filter((r) => r.mapping_source !== "standard" && r.status !== "suggested");
    return { standard, suggested, custom };
  }, [rows]);

  const stage = (change: ZohoMappingChange) =>
    setPending((current) => ({ ...current, [change.source_field_name]: change }));

  const save = async () => {
    const changes = Object.values(pending);
    if (!changes.length) return;
    setSaving(true);
    setError("");
    try {
      const result = await saveZohoMappings(changes);
      setRows(result.mappings);
      setPending({});
      setNotice(
        result.resync?.started
          ? "Mapping saved. Re-applying it to your synced leads in the background."
          : "Mapping saved. It applies from the next sync.",
      );
      onSaved();
    } catch (err) {
      setError(failureText(err, "Could not save the mapping."));
    } finally {
      setSaving(false);
    }
  };

  if (!rows.length && !error) return null;

  const pendingCount = Object.keys(pending).length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Field mapping</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            How Zoho lead fields land in EstateFlow. Unmapped fields are still saved with each lead.
          </p>
        </div>
        <button
          type="button"
          disabled={!pendingCount || saving}
          onClick={() => void save()}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : pendingCount ? `Save mapping (${pendingCount})` : "Save mapping"}
        </button>
      </div>
      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      {groups.suggested.length ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Suggested by AI</h4>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {groups.suggested.map((row) => {
              const staged = pending[row.source_field_name];
              return (
                <li key={row.source_field_name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {row.source_field_label || row.source_field_name}
                    </span>
                    <span className="text-gray-500"> → {label(row.target_field_name)}</span>
                    <span className="ml-2 rounded-full bg-warning-50 px-2 py-0.5 text-xs text-warning-700 dark:bg-warning-500/15 dark:text-warning-500">
                      {Math.round((row.confidence ?? 0) * 100)}%
                    </span>
                    {row.reason ? <p className="mt-0.5 text-xs text-gray-500">{row.reason}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => stage({ source_field_name: row.source_field_name, action: "accept" })}
                      className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                        staged?.action === "accept"
                          ? "bg-success-500 text-white"
                          : "border border-gray-300 text-gray-700 dark:border-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {staged?.action === "accept" ? "Accepted" : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => stage({ source_field_name: row.source_field_name, action: "ignore" })}
                      className="rounded-lg px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700"
                    >
                      {staged?.action === "ignore" ? "Ignored" : "Ignore"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {groups.custom.length ? (
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-gray-800 dark:text-white/90">Custom fields</h4>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
            {groups.custom.map((row) => {
              const staged = pending[row.source_field_name];
              const current = staged ? staged.target_field_name ?? "" : row.target_field_name ?? "";
              return (
                <li key={row.source_field_name} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <span className="font-medium text-gray-800 dark:text-white/90">
                      {row.source_field_label || row.source_field_name}
                    </span>
                    {row.status === "active" ? (
                      <span className="ml-2 text-xs text-success-600">
                        ✓ {row.mapping_source === "llm" ? `AI ${Math.round((row.confidence ?? 0) * 100)}%` : "set by you"}
                      </span>
                    ) : (
                      <span className="ml-2 text-xs text-gray-500">kept as custom field</span>
                    )}
                  </div>
                  <select
                    aria-label={`EstateFlow field for ${row.source_field_name}`}
                    value={current}
                    onChange={(event) =>
                      stage({
                        source_field_name: row.source_field_name,
                        action: "set",
                        target_field_name: event.target.value || null,
                      })
                    }
                    className="h-9 rounded-lg border border-gray-300 bg-transparent px-3 text-sm dark:border-gray-700 dark:text-white/90"
                  >
                    <option value="">Choose field…</option>
                    {targets.map((target) => (
                      <option key={target.name} value={target.name}>
                        {label(target.name)}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="text-sm font-medium text-brand-500 hover:text-brand-600"
        >
          {showAll ? "Hide" : "Show"} standard fields ({groups.standard.length})
        </button>
        {showAll ? (
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {groups.standard.map((row) => (
              <li key={row.source_field_name} className="text-sm text-gray-600 dark:text-gray-300">
                <span className="text-success-600">✓</span> {row.source_field_label || row.source_field_name} →{" "}
                {label(row.target_field_name)}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
