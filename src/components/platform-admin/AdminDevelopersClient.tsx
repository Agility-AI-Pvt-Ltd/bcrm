"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import {
  createDeveloper,
  type Developer,
  getAdminToken,
  grantDeveloperAccount,
  listDevelopers,
  revokeDeveloperAccount,
  updateDeveloper,
} from "@/lib/adminApi";
import AdminNav from "./AdminNav";

const EVENT_LABELS: Record<string, string> = {
  code_sent: "Code emailed",
  code_refused: "Code refused",
  send_failed: "Email failed",
  signed_in: "Signed in",
  bad_code: "Wrong code",
  granted: "Account granted",
  revoked: "Account removed",
};

const input =
  "h-10 w-full rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90";

function when(value?: string | null): string {
  if (!value) return "never";
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/**
 * Who may open an agent's account as a developer, and which accounts.
 *
 * A developer never gets the agent's password. They turn on "I'm a developer"
 * on the normal sign-in page, name the account, and receive a 6-digit code at
 * the email entered here (sent through Brevo). Removing an account or switching
 * a developer off ends any session they have open, on their next click.
 */
export default function AdminDevelopersClient() {
  const router = useRouter();
  const [developers, setDevelopers] = useState<Developer[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [grantDrafts, setGrantDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try {
      setDevelopers(await listDevelopers());
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/admin/login");
        return;
      }
      setError(errorText(err, "Could not load developers."));
    }
  }, [router]);

  useEffect(() => {
    if (!getAdminToken()) {
      router.replace("/admin/login");
      return;
    }
    void load();
  }, [load, router]);

  const replace = (updated: Developer) =>
    setDevelopers((current) =>
      (current || []).map((item) => (item.id === updated.id ? updated : item)),
    );

  const run = async (action: () => Promise<void>, done: string) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(done);
    } catch (err) {
      setError(errorText(err, "That did not work."));
    } finally {
      setBusy(false);
    }
  };

  const onCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") || "").trim();
    const name = String(data.get("name") || "").trim();
    const accounts = String(data.get("accounts") || "")
      .split(/[\s,;]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    const allAccounts = data.get("all_accounts") === "on";
    if (!email) {
      setError("Enter the developer's email.");
      return;
    }
    void run(async () => {
      const created = await createDeveloper({
        email,
        name,
        all_accounts: allAccounts,
        account_emails: accounts,
      });
      setDevelopers((current) => [created, ...(current || [])]);
      form.reset();
    }, `${email} can now sign in as a developer.`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <AdminNav />
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-500">
          EstateFlow operator
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white/90">
          Developers
        </h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500 dark:text-gray-400">
          People who may open an agent&apos;s account to support or debug it — without the
          agent&apos;s password. On the sign-in page they switch on{" "}
          <strong>I&apos;m a developer</strong>, enter the agent&apos;s sign-in email and their
          own developer email, and get a 6-digit code by email (sent through Brevo, valid
          10 minutes, single use). Only the accounts you list below can be opened. Every
          code, sign-in and refusal is logged here.
        </p>
      </header>

      {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-success-600">{notice}</p> : null}

      <form
        onSubmit={onCreate}
        className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-white p-5 md:grid-cols-2 dark:border-gray-800 dark:bg-white/[0.03]"
      >
        <h2 className="text-base font-semibold text-gray-800 md:col-span-2 dark:text-white/90">
          Add a developer
        </h2>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          Developer email (the code goes here)
          <input name="email" type="email" required className={`${input} mt-1`} />
        </label>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          Name
          <input name="name" className={`${input} mt-1`} />
        </label>
        <label className="text-sm text-gray-700 md:col-span-2 dark:text-gray-300">
          Agent accounts they may open (sign-in emails, comma or space separated)
          <input
            name="accounts"
            placeholder="agent@agency.com, owner@otheragency.in"
            className={`${input} mt-1`}
          />
        </label>
        <label className="flex items-start gap-2 text-sm text-gray-700 md:col-span-2 dark:text-gray-300">
          <input name="all_accounts" type="checkbox" className="mt-0.5 h-4 w-4" />
          <span>
            Every account
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Only for EstateFlow&apos;s own engineers. Leave off to limit them to the accounts
              above.
            </span>
          </span>
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            Add developer
          </button>
        </div>
      </form>

      {developers === null ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : developers.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 p-6 text-sm text-gray-500 dark:border-gray-700">
          No developers yet. Nobody can open an agent&apos;s account without their password
          until you add one.
        </p>
      ) : (
        <ul className="space-y-4">
          {developers.map((developer) => (
            <li
              key={developer.id}
              className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-gray-800 dark:text-white/90">
                    {developer.name || developer.email}
                    {!developer.is_active ? (
                      <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                        Switched off
                      </span>
                    ) : null}
                    {developer.all_accounts ? (
                      <span className="ml-2 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">
                        Every account
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {developer.email} · last sign-in {when(developer.last_login_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        replace(
                          await updateDeveloper(developer.id, {
                            all_accounts: !developer.all_accounts,
                          }),
                        );
                      }, developer.all_accounts ? "Limited to the listed accounts." : "Can now open every account.")
                    }
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/5"
                  >
                    {developer.all_accounts ? "Limit to listed accounts" : "Allow every account"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        replace(
                          await updateDeveloper(developer.id, {
                            is_active: !developer.is_active,
                          }),
                        );
                      }, developer.is_active ? "Switched off — any open session has ended." : "Switched back on.")
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                      developer.is_active
                        ? "border border-error-300 text-error-600 hover:bg-error-50 dark:border-error-500/40"
                        : "bg-brand-500 text-white hover:bg-brand-600"
                    }`}
                  >
                    {developer.is_active ? "Switch off" : "Switch on"}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Accounts they may open
                </p>
                {developer.accounts.length === 0 ? (
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    {developer.all_accounts ? "Every account (no list needed)." : "None yet."}
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-wrap gap-2">
                    {developer.accounts.map((account) => (
                      <li
                        key={account.user_id}
                        className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-700 dark:border-gray-700 dark:text-gray-300"
                      >
                        <span>
                          {account.organization_name ? `${account.organization_name} · ` : ""}
                          {account.email}
                        </span>
                        <button
                          type="button"
                          disabled={busy}
                          aria-label={`Remove ${account.email}`}
                          onClick={() =>
                            void run(async () => {
                              replace(await revokeDeveloperAccount(developer.id, account.user_id));
                            }, `Removed ${account.email}.`)
                          }
                          className="text-gray-400 hover:text-error-600"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <form
                  className="mt-3 flex max-w-lg gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const email = (grantDrafts[developer.id] || "").trim();
                    if (!email) return;
                    void run(async () => {
                      replace(await grantDeveloperAccount(developer.id, email));
                      setGrantDrafts((drafts) => ({ ...drafts, [developer.id]: "" }));
                    }, `${developer.email} can now open ${email}.`);
                  }}
                >
                  <input
                    type="email"
                    placeholder="Add an agent's sign-in email"
                    value={grantDrafts[developer.id] || ""}
                    onChange={(event) =>
                      setGrantDrafts((drafts) => ({ ...drafts, [developer.id]: event.target.value }))
                    }
                    className={input}
                  />
                  <button
                    type="submit"
                    disabled={busy}
                    className="shrink-0 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300"
                  >
                    Add
                  </button>
                </form>
              </div>

              {developer.recent.length ? (
                <details className="mt-4">
                  <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Recent activity
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
                    {developer.recent.map((event, index) => (
                      <li key={`${event.at}-${index}`}>
                        <span className="text-gray-400">{when(event.at)}</span> ·{" "}
                        {EVENT_LABELS[event.event] || event.event}
                        {event.account_email ? ` · ${event.account_email}` : ""}
                        {event.ip_address ? ` · ${event.ip_address}` : ""}
                        {event.detail && event.event !== "granted" && event.event !== "revoked"
                          ? ` · ${event.detail}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
