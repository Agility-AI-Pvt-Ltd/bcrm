"use client";

import { FormEvent, useEffect, useState } from "react";
import ProfileExtractAssistant from "@/components/user-profile/ProfileExtractAssistant";
import { ApiError, fetchMe, updateProfile } from "@/lib/auth";
import { useStoredUser } from "@/hooks/useStoredUser";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";
const areaClass =
  "min-h-24 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-3 text-sm dark:border-gray-700 dark:text-white/90";

export default function EditProfileForm() {
  const user = useStoredUser();
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        // Writes straight through to the store, so every subscriber updates.
        await fetchMe();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load profile.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const onSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError("");
    try {
      await updateProfile({
        first_name: String(form.get("first_name") || "").trim(),
        last_name: String(form.get("last_name") || "").trim(),
        phone: String(form.get("phone") || "").trim() || null,
        office_phone: String(form.get("office_phone") || "").trim() || null,
        address: String(form.get("address") || "").trim() || null,
        office_address: String(form.get("office_address") || "").trim() || null,
        bio: String(form.get("bio") || "").trim() || null,
      });
      setNotice("Profile updated.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Profile update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <ProfileExtractAssistant
        focus="profile"
        title="AI Profile Fill"
        description="Paste a bio, visiting card notes, or drop a PDF/Excel. LangGraph extracts fields, polishes them with LLM, then waits for your confirmation."
        onApplied={() => {
          // The apply call already cached the new user; this just re-mounts the
          // form so the defaultValue inputs pick the new values up.
          setFormKey((value) => value + 1);
          setNotice("AI updates applied to your profile.");
        }}
      />

      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Edit profile
            </h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Personal and office contact details.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              user?.is_enabled
                ? "bg-success-50 text-success-700 dark:bg-success-500/15 dark:text-success-400"
                : "bg-warning-50 text-warning-700 dark:bg-warning-500/15 dark:text-warning-400"
            }`}
          >
            {user?.is_enabled ? "Enabled" : "Disabled — choose a plan"}
          </span>
        </div>

        {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}
        {notice ? <p className="mb-3 text-sm text-success-600">{notice}</p> : null}

        <form
          key={formKey}
          onSubmit={(event) => void onSave(event)}
          className="space-y-5"
        >
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">First name</span>
              <input
                name="first_name"
                defaultValue={user?.first_name || ""}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Last name</span>
              <input
                name="last_name"
                defaultValue={user?.last_name || ""}
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Email</span>
              <input
                value={user?.email || ""}
                disabled
                className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-gray-500 dark:border-gray-800 dark:bg-white/[0.02]"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Phone number</span>
              <input
                name="phone"
                defaultValue={user?.phone || ""}
                placeholder="+91 …"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Office number</span>
              <input
                name="office_phone"
                defaultValue={user?.office_phone || ""}
                placeholder="Office / landline"
                className={fieldClass}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block text-gray-500">Bio</span>
              <input name="bio" defaultValue={user?.bio || ""} className={fieldClass} />
            </label>
            <label className="block text-sm lg:col-span-2">
              <span className="mb-1.5 block text-gray-500">Address</span>
              <textarea
                name="address"
                defaultValue={user?.address || ""}
                placeholder="Home / personal address"
                className={areaClass}
              />
            </label>
            <label className="block text-sm lg:col-span-2">
              <span className="mb-1.5 block text-gray-500">Office address</span>
              <textarea
                name="office_address"
                defaultValue={user?.office_address || ""}
                placeholder="Business / office address"
                className={areaClass}
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save profile"}
          </button>
        </form>
      </section>
    </div>
  );
}
