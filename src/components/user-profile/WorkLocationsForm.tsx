"use client";

import { FormEvent, useEffect, useState } from "react";
import ProfileExtractAssistant from "@/components/user-profile/ProfileExtractAssistant";
import {
  ApiError,
  fetchMe,
  getStoredUser,
  updateProfile,
} from "@/lib/auth";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";

export default function WorkLocationsForm() {
  const [locations, setLocations] = useState<string[]>(
    getStoredUser()?.work_locations || [],
  );
  const [newLocation, setNewLocation] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const me = await fetchMe();
        setLocations(me.work_locations || []);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load locations.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const addLocation = () => {
    const value = newLocation.trim();
    if (!value) return;
    if (locations.some((item) => item.toLowerCase() === value.toLowerCase())) {
      setError("That location is already listed.");
      return;
    }
    setLocations((current) => [...current, value]);
    setNewLocation("");
    setError("");
  };

  const removeLocation = (index: number) => {
    setLocations((current) => current.filter((_, i) => i !== index));
  };

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const updated = await updateProfile({ work_locations: locations });
      setLocations(updated.work_locations || []);
      setNotice("Work locations saved.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save locations.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ProfileExtractAssistant
        focus="locations"
        title="AI Work Locations"
        description="Paste coverage notes or drop a PDF/Excel territory list. AI finds cities and areas, then asks you to confirm before saving."
        onApplied={(next) => {
          setLocations(next.work_locations || []);
          setNotice("AI work locations applied.");
        }}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Work locations
        </h3>
        <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
          Cities or areas where you or your business operate.
        </p>

        {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mb-3 text-sm text-success-600">{notice}</p> : null}

        <form onSubmit={(event) => void onSave(event)} className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={newLocation}
              onChange={(event) => setNewLocation(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLocation();
                }
              }}
              placeholder="e.g. Indiranagar, Bengaluru"
              className={fieldClass}
            />
            <button
              type="button"
              onClick={addLocation}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            >
              Add location
            </button>
          </div>
          {locations.length === 0 ? (
            <p className="text-xs text-gray-500">No locations added yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {locations.map((location, index) => (
                <li
                  key={`${location}-${index}`}
                  className="inline-flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 dark:bg-white/10 dark:text-gray-200"
                >
                  {location}
                  <button
                    type="button"
                    onClick={() => removeLocation(index)}
                    className="text-gray-500 hover:text-error-500"
                    aria-label={`Remove ${location}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save locations"}
          </button>
        </form>
      </section>
    </div>
  );
}
