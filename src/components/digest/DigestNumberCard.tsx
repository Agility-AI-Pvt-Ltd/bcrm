"use client";

import { FormEvent, useEffect, useState } from "react";
import { failureText } from "@/lib/api";
import { ApiError, fetchMe, updateProfile } from "@/lib/auth";
import { useStoredUser } from "@/hooks/useStoredUser";

const field =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

type Props = { onSaved?: () => void };

/**
 * Your own WhatsApp number — where your copy of the digest lands.
 *
 * This is deliberately a personal setting rather than something an admin fills in
 * for the team: saving a number here is the opt-in, and clearing it is how you
 * stop the digest. Nobody else can add you to the list.
 */
export default function DigestNumberCard({ onSaved }: Props) {
  const user = useStoredUser();
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        await fetchMe();
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : "Could not load your profile.");
      } finally {
        if (alive) setLoaded(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    // Only adopt the stored value until the person starts typing, so a background
    // refresh cannot overwrite what they are in the middle of editing.
    if (!loaded) return;
    setValue((current) => (current ? current : user?.digest_whatsapp || ""));
  }, [loaded, user?.digest_whatsapp]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const save = async (next: string) => {
    setSaving(true);
    setError("");
    try {
      // An empty string clears it on the server; `null` would mean "leave alone".
      await updateProfile({ digest_whatsapp: next.trim() });
      await fetchMe();
      setNotice(next.trim() ? "Saved. Your digest will come to this number." : "Digest stopped.");
      onSaved?.();
    } catch (err) {
      setError(failureText(err, "Could not save that number."));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void save(value);
  };

  const saved = (user?.digest_whatsapp || "").trim();

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        Your WhatsApp number
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        Where your copy of the morning digest is sent. Saving a number here is how you opt in —
        clear it and the digest stops.
      </p>

      {saved ? (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-success-50 px-3 py-1.5 text-sm text-success-700 dark:bg-success-500/15 dark:text-success-500">
          Receiving the digest on {saved}
        </p>
      ) : (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-1.5 text-sm text-gray-600 dark:bg-white/[0.06] dark:text-gray-300">
          No number saved — you are not getting the digest
        </p>
      )}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={onSubmit} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="block min-w-[14rem] flex-1 text-sm">
          <span className="mb-1.5 block text-gray-500">WhatsApp number</span>
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="+91 98765 43210"
            inputMode="tel"
            className={field}
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save number"}
        </button>
        {saved ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setValue("");
              void save("");
            }}
            className="h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-white/[0.04]"
          >
            Stop my digest
          </button>
        ) : null}
      </form>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
        Include the country code. This is separate from the phone number on your profile, which
        colleagues see and may be a landline.
      </p>
    </section>
  );
}
