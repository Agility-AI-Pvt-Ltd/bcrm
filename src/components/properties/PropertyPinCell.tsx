"use client";

/**
 * A listing's map pin, in the inventory row: shows whether it is set, and lets the
 * broker set it from two numbers or a pasted Google Maps link. Every distance the
 * assistant quotes is measured from this pin; without it, the assistant says it
 * cannot measure rather than guessing.
 */

import { useState } from "react";
import { ApiError } from "@/lib/api";
import { setPropertyPin, type PropertyRecord } from "@/lib/properties";

export default function PropertyPinCell({
  property,
  onSaved,
}: {
  property: PropertyRecord;
  onSaved: (updated: PropertyRecord) => void;
}) {
  const pinned = property.latitude != null && property.longitude != null;
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const body = link.trim()
      ? { map_url: link.trim() }
      : { latitude: Number(lat), longitude: Number(lng) };
    if (!link.trim() && (!lat.trim() || !lng.trim() || !Number.isFinite(body.latitude) || !Number.isFinite(body.longitude))) {
      setError("Enter both latitude and longitude, or paste a Google Maps link.");
      return;
    }
    setBusy(true);
    try {
      // The server refuses a link with no coordinates in it and says why.
      const updated = await setPropertyPin(property.id, body);
      onSaved(updated);
      setOpen(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save the pin.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={
          pinned
            ? `Pinned at ${property.latitude}, ${property.longitude}. Click to change.`
            : "No map pin: the assistant can't measure distances from this listing"
        }
        className={`mt-1 block text-[11px] font-medium ${
          pinned ? "text-success-600 hover:text-success-700" : "text-warning-600 hover:text-warning-700"
        }`}
      >
        {pinned ? "📍 Pinned" : "No map pin · Set pin"}
      </button>
    );
  }

  return (
    <div className="mt-2 flex w-64 flex-col gap-1.5 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
      <input
        type="url"
        value={link}
        onChange={(event) => setLink(event.target.value)}
        placeholder="Paste a Google Maps link"
        className="rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
      />
      <p className="text-[11px] text-gray-400">or type the numbers</p>
      <div className="flex gap-1.5">
        <input
          inputMode="decimal"
          value={lat}
          onChange={(event) => setLat(event.target.value)}
          placeholder="Latitude"
          aria-label="Latitude"
          className="w-1/2 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
        <input
          inputMode="decimal"
          value={lng}
          onChange={(event) => setLng(event.target.value)}
          placeholder="Longitude"
          aria-label="Longitude"
          className="w-1/2 rounded-md border border-gray-300 px-2 py-1 text-xs dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
        />
      </div>
      {error ? <p className="text-[11px] text-error-600">{error}</p> : null}
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-md bg-brand-500 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save pin"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-gray-400 hover:text-gray-600">
          Cancel
        </button>
      </div>
    </div>
  );
}
