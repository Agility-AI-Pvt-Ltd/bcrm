"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import Pagination from "@/components/tables/Pagination";
import { ApiError } from "@/lib/api";
import {
  formatPropertyPrice,
  isPropertyView,
  listPropertiesByView,
  propertyStatusLabel,
  PROPERTY_VIEW_LABELS,
  type PropertyRecord,
  type PropertyView,
} from "@/lib/properties";

const PAGE_SIZE = 25;

function statusColor(status: string): "success" | "warning" | "dark" {
  const label = propertyStatusLabel(status);
  if (label === "Available") return "success";
  if (label === "Reserved") return "warning";
  return "dark";
}

export default function PropertyListView() {
  const router = useRouter();
  const params = useSearchParams();

  const rawView = params.get("view");
  const view: PropertyView = isPropertyView(rawView) ? rawView : "all";
  const pageParam = Number(params.get("page") || 1);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1;

  const [items, setItems] = useState<PropertyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await listPropertiesByView(view, page, PAGE_SIZE);
      setItems(result.items);
      setTotal(result.total);
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err instanceof ApiError ? err.message : "Could not load properties.");
    } finally {
      setLoading(false);
    }
  }, [view, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // The page number lives in the URL, so a particular page is shareable and
  // the browser Back button steps through pages rather than leaving the list.
  const goToPage = (next: number) => {
    const clamped = Math.min(Math.max(1, next), totalPages);
    const query = new URLSearchParams({ view, page: String(clamped) });
    router.push(`/properties/list?${query}`);
  };

  // A page beyond the end (bookmark from when the list was longer, or rows
  // since removed) would otherwise render as a silent blank table.
  useEffect(() => {
    if (!loading && total > 0 && page > totalPages) {
      goToPage(totalPages);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, total, page, totalPages]);

  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <PageBreadcrumb pageTitle={PROPERTY_VIEW_LABELS[view]} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/properties"
          className="text-sm font-medium text-brand-500 hover:underline"
        >
          ← Back to Properties
        </Link>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(PROPERTY_VIEW_LABELS) as PropertyView[]).map((item) => (
            <Link
              key={item}
              href={`/properties/list?view=${item}&page=1`}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                item === view
                  ? "border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/15"
                  : "border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-700 dark:text-gray-300"
              }`}
            >
              {PROPERTY_VIEW_LABELS[item]}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <h2 className="font-semibold text-gray-900 dark:text-white/90">
            {PROPERTY_VIEW_LABELS[view]}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {loading
              ? "Loading…"
              : total === 0
                ? "No properties in this view."
                : `Showing ${firstRow}–${lastRow} of ${total} listing${
                    total === 1 ? "" : "s"
                  }`}
          </p>
        </div>

        {error ? <p className="px-5 py-4 text-sm text-error-500">{error}</p> : null}

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
                    Nothing to show here.
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
                      <Badge color={property.source === "sheet" ? "info" : "light"} size="sm">
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
        {!loading && totalPages > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {page} of {totalPages}
            </p>
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={goToPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
