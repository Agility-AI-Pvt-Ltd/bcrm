"use client";

import { useCallback, useEffect, useState } from "react";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import { ApiError } from "@/lib/api";
import {
  formatPropertyPrice,
  getPropertyStats,
  listProperties,
  propertyStatusLabel,
  type PropertyRecord,
  type PropertyStats,
} from "@/lib/properties";
import PropertyImportPanel from "@/components/campaigns/PropertyImportPanel";

const PAGE_SIZE = 50;

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

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [page, propertyStats] = await Promise.all([
        listProperties(1, PAGE_SIZE),
        getPropertyStats(),
      ]);
      setItems(page.items);
      setTotal(page.total);
      setStats(propertyStats);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setStats(EMPTY_STATS);
      setError(err instanceof ApiError ? err.message : "Could not load properties from the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <PageBreadcrumb pageTitle="Properties" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {[
          [String(stats.active_listings), "Active listings"],
          [String(stats.new_this_month), "New this month"],
          [String(stats.reserved), "Reserved"],
          [String(stats.sold_this_quarter), "Sold this quarter"],
        ].map(([value, label]) => (
          <div
            key={label}
            className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
          >
            <p className="text-2xl font-semibold text-gray-800 dark:text-white/90">
              {loading ? "—" : value}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{label}</p>
          </div>
        ))}
      </div>

      <PropertyImportPanel onImported={load} />

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
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading properties…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
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
      </div>
    </div>
  );
}
