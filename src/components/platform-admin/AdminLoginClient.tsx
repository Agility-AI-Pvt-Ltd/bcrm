"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { adminLogin, getAdminToken } from "@/lib/adminApi";

export default function AdminLoginClient() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (getAdminToken()) router.replace("/admin");
  }, [router]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await adminLogin(email, password);
      router.replace("/admin");
    } catch (err) {
      // The API answers "no such admin" and "wrong password" identically on
      // purpose; don't add a client-side hint that tells them apart.
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
            EstateFlow
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white/90">
            Operator sign in
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            For platform staff who verify payments and open customer accounts.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-white/[0.03]"
        >
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Email
            <input
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1.5 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
          </label>

          {error ? (
            <p className="mt-4 text-sm text-error-500" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Agents sign in at <span className="font-medium">/signin</span>.
        </p>
      </div>
    </div>
  );
}
