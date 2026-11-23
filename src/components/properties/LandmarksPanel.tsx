"use client";

/**
 * Landmarks: the markets, metro stations, hospitals and schools the assistant
 * measures distances to. Each needs its exact pin. Nothing is pre-filled, because
 * a coordinate we made up would be a distance we made up.
 */

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api";
import {
  createLandmark,
  deleteLandmark,
  importLandmarks,
  listLandmarkCategories,
  listLandmarks,
  parseLandmarkLines,
  type Landmark,
  type LandmarkCategory,
} from "@/lib/landmarks";

const field =
  "rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900 dark:text-white/90";

export default function LandmarksPanel() {
  const [items, setItems] = useState<Landmark[]>([]);
  const [categories, setCategories] = useState<LandmarkCategory[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", category: "market", link: "", lat: "", lng: "", aliases: "", locality: "", source: "" });
  const [paste, setPaste] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await listLandmarks({ search: search || undefined, category: filter || undefined });
      setItems(data.items);
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not load landmarks.");
    }
  }, [search, filter]);

  useEffect(() => {
    listLandmarkCategories()
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void load(), 250);
    return () => clearTimeout(timer);
  }, [load]);

  const add = async () => {
    setNotice("");
    const usingLink = form.link.trim() !== "";
    if (!form.name.trim() || (!usingLink && (!form.lat.trim() || !form.lng.trim()))) {
      setNotice("Give the landmark a name and its exact pin: a Google Maps link, or latitude and longitude.");
      return;
    }
    setBusy(true);
    try {
      const row = await createLandmark({
        name: form.name.trim(),
        category: form.category,
        map_url: usingLink ? form.link.trim() : null,
        latitude: usingLink ? null : Number(form.lat),
        longitude: usingLink ? null : Number(form.lng),
        aliases: form.aliases.split(",").map((item) => item.trim()).filter(Boolean),
        locality: form.locality.trim() || null,
        source: form.source.trim() || (usingLink ? "Google Maps link" : "Entered by hand"),
      });
      setNotice(`${row.name} added.`);
      setForm({ name: "", category: form.category, link: "", lat: "", lng: "", aliases: "", locality: "", source: "" });
      void load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not add that landmark.");
    } finally {
      setBusy(false);
    }
  };

  const runImport = async () => {
    const { items: rows, bad } = parseLandmarkLines(paste);
    if (rows.length === 0) {
      setNotice("Nothing to import. Each line needs: name, category, latitude, longitude.");
      return;
    }
    setBusy(true);
    try {
      const result = await importLandmarks(rows);
      const skipped = bad.length + result.errors.length;
      setNotice(
        `${result.created} added, ${result.updated} updated${skipped ? `, ${skipped} skipped (no valid pin or category)` : ""}.`,
      );
      setPaste("");
      void load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not import.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: Landmark) => {
    setBusy(true);
    try {
      await deleteLandmark(row.id);
      setItems((current) => current.filter((item) => item.id !== row.id));
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : "Could not remove it.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]">
        <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">Landmarks</h3>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          When a customer asks &quot;Is Atta Market near this flat?&quot;, the assistant measures the
          straight-line distance from the listing&apos;s map pin to the landmark&apos;s pin here. A place
          that isn&apos;t on this list, or a listing with no pin, gets an honest &quot;I don&apos;t have
          that&quot;, never a guess.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <input className={field} placeholder="Name, e.g. Atta Market" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} aria-label="Category">
            {(categories.length ? categories : [{ value: "market", label: "market", plural: "markets" }]).map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <input className={field} placeholder="Locality (optional), e.g. Sector 27" value={form.locality} onChange={(e) => setForm({ ...form, locality: e.target.value })} />
          <input className={`${field} md:col-span-3`} type="url" placeholder="Google Maps link with the pin (or type latitude and longitude below)" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} />
          <input className={field} inputMode="decimal" placeholder="Latitude" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
          <input className={field} inputMode="decimal" placeholder="Longitude" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
          <input className={field} placeholder="Other names, comma separated" value={form.aliases} onChange={(e) => setForm({ ...form, aliases: e.target.value })} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button type="button" disabled={busy} onClick={add} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50">
            Add landmark
          </button>
          {notice ? <p className="text-sm text-gray-600 dark:text-gray-300">{notice}</p> : null}
        </div>

        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-brand-600">Import many from a sheet</summary>
          <p className="mt-2 text-xs text-gray-500">
            Paste rows as: name, category, latitude, longitude, locality (optional). One per line.
          </p>
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder={"Atta Market, market, <latitude>, <longitude>, Sector 27"}
            className={`${field} mt-2 w-full font-mono text-xs`}
          />
          <button type="button" disabled={busy || !paste.trim()} onClick={runImport} className="mt-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300">
            Import
          </button>
        </details>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="flex flex-wrap gap-3 p-4">
          <input className={field} placeholder="Search landmarks" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className={field} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filter by category">
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.plural}
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-white/[0.02] dark:text-gray-400">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Category</th>
                <th className="px-4 py-2 font-medium">Pin</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                    No landmarks yet. Until you add some, the assistant will say it can&apos;t measure distances.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 text-gray-800 dark:text-white/90">
                      {row.name}
                      {row.aliases.length ? <span className="ml-1 text-xs text-gray-400">({row.aliases.join(", ")})</span> : null}
                      {row.locality ? <span className="block text-xs text-gray-500">{row.locality}</span> : null}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-300">{row.category_label}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-xs">
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${row.latitude},${row.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-600 hover:underline"
                      >
                        {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
                      </a>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500">{row.source || "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button type="button" disabled={busy} onClick={() => void remove(row)} className="text-xs text-error-600 hover:text-error-700 disabled:opacity-50">
                        Remove
                      </button>
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
