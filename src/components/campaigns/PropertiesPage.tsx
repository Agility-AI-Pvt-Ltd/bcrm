"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import Pagination from "@/components/tables/Pagination";
import { ApiError } from "@/lib/api";
import {
  formatPropertyPrice,
  getPropertyStats,
  listProperties,
  propertyStatusLabel,
  PROPERTY_VIEW_LABELS,
  type PropertyView,
  type PropertyRecord,
  type PropertyStats,
} from "@/lib/properties";
import PropertyImportPanel from "@/components/campaigns/PropertyImportPanel";
import PropertySheetsPanel from "@/components/campaigns/PropertySheetsPanel";
import TrustSettingsCard from "@/components/properties/TrustSettingsCard";
import PropertyIntakePanel from "@/components/properties/PropertyIntakePanel";

const PAGE_SIZE = 10;

type Tab = "inventory" | "add" | "settings";
type Source = "whatsapp" | "sheets" | "upload";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "inventory", label: "Inventory" },
  { id: "add", label: "Add listings" },
  { id: "settings", label: "Pricing & trust" },
];

const SOURCES: Array<{ id: Source; label: string; hint: string }> = [
  { id: "whatsapp", label: "Staff WhatsApp", hint: "Listings your team sends in chat" },
  { id: "sheets", label: "Google Sheets", hint: "Keep a sheet in sync automatically" },
  { id: "upload", label: "File upload", hint: "Import a CSV or Excel file once" },
];

const EMPTY_STATS: PropertyStats = {
  active_listings: 0,
  new_this_month: 0,
  reserved: 0,
  sold_this_quarter: 0,
};

function statusColor(status: string): "success" | "warning" | "dark" {
  const label = propertyStatusLabel(status);
  if (label === "Available") return "success";
  if (label === "Reserved") return "warning";
  return "dark";
}

export default function PropertiesPage() {
  const [items, setItems] = useState<PropertyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<PropertyStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<Tab>("inventory");
  const [source, setSource] = useState<Source>("whatsapp");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [result, propertyStats] = await Promise.all([
        listProperties(page, PAGE_SIZE),
        getPropertyStats(),
      ]);
      // A sync or delete can shrink the list under the current page; step
      // back to the last page that still has rows rather than show an empty one.
      const lastPage = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
      if (page > lastPage) {
        setPage(lastPage);
        return;
      }
      setItems(result.items);
      setTotal(result.total);
      setStats(propertyStats);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setStats(EMPTY_STATS);
      setError(err instanceof ApiError ? err.message : "Could not load properties from the API.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageBreadcrumb pageTitle="Properties" />

      {/* Each tile links to the rows it counted. The server derives both from
          one predicate, so the number here and the total on the next page
          cannot drift apart. */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {(
          [
            [String(stats.active_listings), "active"],
            [String(stats.new_this_month), "new-this-month"],
            [String(stats.reserved), "reserved"],
            [String(stats.sold_this_quarter), "sold"],
          ] as Array<[string, PropertyView]>
        ).map(([value, view]) => {
          const label = PROPERTY_VIEW_LABELS[view];
          return (
          <Link
            key={label}
            href={`/properties/list?view=${view}&page=1`}
            aria-label={`${label}: ${value}. View all`}
            className="group block rounded-2xl border border-gray-200 bg-white p-5 transition hover:border-brand-400 hover:shadow-theme-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-brand-500"
          >
            <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {loading ? "—" : value}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-2 text-xs font-medium text-brand-500 opacity-0 transition group-hover:opacity-100">
              View all →
            </p>
          </Link>
          );
        })}
      </div>

      <div
        role="tablist"
        aria-label="Properties sections"
        className="mb-6 flex gap-6 overflow-x-auto border-b border-gray-200 dark:border-gray-800"
      >
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`properties-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`properties-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
                active
                  ? "border-brand-500 text-brand-600 dark:text-brand-400"
                  : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
              }`}
            >
              {item.label}
              {item.id === "inventory" && !loading ? (
                <span className="ml-2 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
                  {total}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Panels stay mounted while hidden so a half-filled form or a running
          sync survives a tab switch. */}
      <div
        role="tabpanel"
        id="properties-panel-inventory"
        aria-labelledby="properties-tab-inventory"
        hidden={tab !== "inventory"}
      >
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white/90">
                Property inventory
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {loading
                  ? "Loading listings from the database…"
                  : `${total} listing${total === 1 ? "" : "s"} in this organization.`}
              </p>
            </div>
          </div>

          {error ? (
            <p className="px-5 py-4 text-sm text-error-500">{error}</p>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
                <tr>
                  <th className="px-5 py-3 font-medium">Property</th>
                  <th className="px-5 py-3 font-medium">Location</th>
                  <th className="px-5 py-3 font-medium">BHK</th>
                  <th className="px-5 py-3 font-medium">Listing</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Source</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      Loading properties…
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                      No properties in the database for this organization.
                    </td>
                  </tr>
                ) : (
                  items.map((property) => (
                    <tr key={property.id}>
                      <td className="whitespace-nowrap px-5 py-4 font-medium text-gray-800 dark:text-white/90">
                        {property.title}
                      </td>
                      <td className="px-5 py-4 text-gray-500 dark:text-gray-400">
                        {property.location}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                        {property.bhk || property.property_type || "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                        {property.listing_type || "—"}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-gray-500 dark:text-gray-400">
                        {formatPropertyPrice(property)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <Badge
                          color={property.source === "sheet" ? "info" : "light"}
                          size="sm"
                        >
                          {property.source === "sheet" ? "Sheet" : "Manual"}
                        </Badge>
                      </td>
                      <td className="px-5 py-4">
                        <Badge color={statusColor(String(property.status))} size="sm">
                          {propertyStatusLabel(String(property.status))}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* One page of results needs no pager; showing a dead one is noise. */}
          {totalPages > 1 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Showing {firstRow}–{lastRow} of {total}
              </p>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(next) => setPage(Math.min(Math.max(1, next), totalPages))}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div
        role="tabpanel"
        id="properties-panel-add"
        aria-labelledby="properties-tab-add"
        hidden={tab !== "add"}
      >
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {SOURCES.map((item) => {
            const active = source === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSource(item.id)}
                className={`rounded-xl border px-4 py-3 text-left transition ${
                  active
                    ? "border-brand-500 bg-brand-50 ring-1 ring-brand-500 dark:bg-brand-500/10"
                    : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-white/[0.03] dark:hover:border-gray-700"
                }`}
              >
                <span
                  className={`block text-sm font-semibold ${
                    active ? "text-brand-700 dark:text-brand-400" : "text-gray-800 dark:text-white/90"
                  }`}
                >
                  {item.label}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                  {item.hint}
                </span>
              </button>
            );
          })}
        </div>

        <div hidden={source !== "whatsapp"}>
          <PropertyIntakePanel />
        </div>
        <div hidden={source !== "sheets"}>
          <PropertySheetsPanel onSynced={load} />
        </div>
        <div hidden={source !== "upload"}>
          <PropertyImportPanel onImported={load} />
        </div>
      </div>

      <div
        role="tabpanel"
        id="properties-panel-settings"
        aria-labelledby="properties-tab-settings"
        hidden={tab !== "settings"}
      >
        <TrustSettingsCard />
      </div>
    </div>
  );
}
