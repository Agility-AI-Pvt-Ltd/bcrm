"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, changePassword } from "@/lib/auth";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";

export default function ChangePasswordForm() {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
      await changePassword({
        current_password: String(form.get("current_password") || ""),
        new_password: String(form.get("new_password") || ""),
      });
      setNotice("Password changed.");
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Password change failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Change password
      </h3>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
        Update the password used to sign in to EstateFlow.
      </p>

      {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={(event) => void onSave(event)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1.5 block text-gray-500">Current password</span>
            <input
              name="current_password"
              type="password"
              required
              className={fieldClass}
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1.5 block text-gray-500">New password</span>
            <input
              name="new_password"
              type="password"
              minLength={8}
              required
              className={fieldClass}
            />
          </label>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
        >
          {saving ? "Updating…" : "Update password"}
        </button>
      </form>
    </section>
  );
}
