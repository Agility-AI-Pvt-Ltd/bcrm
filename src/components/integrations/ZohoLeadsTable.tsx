"use client";

import { useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import { formatWhen, getZohoLeads, type ZohoLeadPage } from "@/lib/zoho";

const PAGE_SIZE = 25;

/** The synced copy, newest change first, with Zoho's own source and status. */
export default function ZohoLeadsTable({ refreshKey }: { refreshKey: string }) {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ZohoLeadPage | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const next = await getZohoLeads(page, PAGE_SIZE);
        if (alive) setData(next);
      } catch (err) {
        if (alive) setError(failureText(err, "Could not load Zoho leads."));
      }
    })();
    return () => {
      alive = false;
    };
  }, [page, refreshKey]);

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">Leads from Zoho</h3>
      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {!data ? (
        <p className="mt-3 text-sm text-gray-500">{error ? "" : "Loading…"}</p>
      ) : data.items.length === 0 ? (
        <p className="mt-3 text-sm text-gray-500">No leads synced yet. They appear here as the sync runs.</p>
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 pr-4 font-medium">Source</th>
                  <th className="py-2 pr-4 font-medium">Zoho status</th>
                  <th className="py-2 pr-4 font-medium">Owner</th>
                  <th className="py-2 pr-4 font-medium">Updated in Zoho</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {data.items.map((lead) => (
                  <tr key={lead.id} className="text-gray-700 dark:text-gray-300">
                    <td className="py-2 pr-4 font-medium text-gray-800 dark:text-white/90">
                      {lead.name}
                      {lead.email ? <span className="block text-xs font-normal text-gray-500">{lead.email}</span> : null}
                    </td>
                    <td className="py-2 pr-4">{lead.phone || "—"}</td>
                    <td className="py-2 pr-4">
                      {lead.source ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-white/[0.06]">
                          {lead.source}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2 pr-4">{lead.external_status || lead.status}</td>
                    <td className="py-2 pr-4">{lead.owner_name || "—"}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">{formatWhen(lead.external_updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
            <span>
              {data.total.toLocaleString()} leads · page {page} of {pages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 disabled:opacity-40 dark:border-gray-700"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
