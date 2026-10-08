"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Badge from "@/components/ui/badge/Badge";
import Pagination from "@/components/tables/Pagination";
import { ApiError } from "@/lib/api";
import {
  areaLabel,
  formatPropertyPrice,
  getTrustSettings,
  isPropertyView,
  listPropertiesByView,
  loadingPercent,
  propertyStatusLabel,
  PROPERTY_VIEW_LABELS,
  verificationLabel,
  verificationState,
  verifyProperty,
  VERIFICATION_CHIP,
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

/**
 * "4 photos · 1 video", or what is missing.
 *
 * Worth a column of its own: a listing with no photos is the one a customer stops
 * replying to, and until now there was no way to see which those were without
 * opening each one.
 */
function mediaLabel(property: PropertyRecord): { text: string; thin: boolean } {
  const photos = (property.image_urls || []).filter(Boolean).length;
  const videos = (property.video_urls || []).filter(Boolean).length;
  if (!photos && !videos) return { text: "None", thin: true };
  const parts: string[] = [];
  if (photos) parts.push(`${photos} photo${photos === 1 ? "" : "s"}`);
  if (videos) parts.push(`${videos} video${videos === 1 ? "" : "s"}`);
  return { text: parts.join(" · "), thin: !photos };
}


/**
 * The trust column: when a person last confirmed this listing, its RERA number and
 * its carpet area.
 *
 * Shown on the list rather than only on a detail page because the question a broker
 * actually has is "which of my listings would a customer not believe?", and that is
 * a question about the whole page at once.
 */
function TrustCell({
  property,
  validDays,
  onVerify,
  busy,
}: {
  property: PropertyRecord;
  validDays: number;
  onVerify: (property: PropertyRecord) => void;
  busy: boolean;
}) {
  const state = verificationState(property.verified_at, validDays);
  const loading = loadingPercent(property);
  const area = areaLabel(property);
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${VERIFICATION_CHIP[state]}`}
        >
          {verificationLabel(property.verified_at)}
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => onVerify(property)}
          className="text-xs text-brand-500 underline underline-offset-2 disabled:opacity-50"
        >
          {busy ? "Saving…" : state === "never" ? "Verify" : "Re-verify"}
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {property.rera_number ? (
          <span title="As given by the seller; not checked with the RERA authority.">
            RERA {property.rera_number}
          </span>
        ) : (
          <span className="text-warning-600">No RERA number</span>
        )}
      </p>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        {area || <span className="text-warning-600">No area</span>}
        {loading !== null ? (
          <span className="text-warning-600"> · {loading}% loading</span>
        ) : null}
      </p>
    </div>
  );
}

export default function PropertyListView() {
  const router = useRouter();
  // The agency's own window for how long a confirmation stays believable. Read once
  // for the page so every row's badge is judged by the same rule.
  const [validDays, setValidDays] = useState(30);
  const [verifying, setVerifying] = useState("");
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

  useEffect(() => {
    // Best effort: a failure here just leaves the default 30-day window, which is
    // better than refusing to render the list.
    void (async () => {
      try {
        const settings = await getTrustSettings();
        setValidDays(settings.verification_valid_days || 30);
      } catch {
        setValidDays(30);
      }
    })();
  }, []);

  /** Confirm a listing is still real. Updates the one row rather than reloading. */
  const onVerify = async (property: PropertyRecord) => {
    setVerifying(property.id);
    setError("");
    try {
      const updated = await verifyProperty(property.id, true);
      setItems((rows) => rows.map((row) => (row.id === updated.id ? updated : row)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not verify that listing.");
    } finally {
      setVerifying("");
    }
  };

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
                <th className="px-5 py-3 font-medium">Media</th>
                <th className="px-5 py-3 font-medium">Trust</th>
                <th className="px-5 py-3 font-medium">Source</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
                    Loading properties…
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-8 text-center text-gray-500 dark:text-gray-400">
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
                    <td
                      className={`whitespace-nowrap px-5 py-4 ${
                        mediaLabel(property).thin
                          ? "text-warning-600"
                          : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {mediaLabel(property).text}
                    </td>
                    <td className="px-5 py-4">
                      <TrustCell
                        property={property}
                        validDays={validDays}
                        onVerify={onVerify}
                        busy={verifying === property.id}
                      />
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
