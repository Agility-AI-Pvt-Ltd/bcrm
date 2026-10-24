"use client";

import { FormEvent, useEffect, useState } from "react";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  ApiError,
  type DeveloperCodeSent,
  type TokenResponse,
} from "@/lib/auth";

type Props = {
  requestCode: (payload: {
    account_email: string;
    developer_email: string;
  }) => Promise<DeveloperCodeSent>;
  verifyCode: (payload: {
    account_email: string;
    developer_email: string;
    code: string;
  }) => Promise<TokenResponse>;
  onSignedIn: (enabled: boolean) => void;
};

/**
 * Developer sign-in: the agent account to open, the developer's own email, then
 * the 6-digit code that arrives there. No agent password is ever asked for —
 * the platform admin decides which accounts each developer may open.
 */
export default function DeveloperSignIn({ requestCode, verifyCode, onSignedIn }: Props) {
  const [accountEmail, setAccountEmail] = useState("");
  const [developerEmail, setDeveloperEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState<DeveloperCodeSent | null>(null);
  const [wait, setWait] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  const send = async () => {
    const account = accountEmail.trim();
    const dev = developerEmail.trim();
    if (!account || !dev) {
      setError("Enter the agent account email and your developer email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await requestCode({ account_email: account, developer_email: dev });
      setSent(result);
      setWait(result.retry_after_seconds);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  };

  const onSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send();
  };

  const onVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await verifyCode({
        account_email: accountEmail.trim(),
        developer_email: developerEmail.trim(),
        code: digits,
      });
      onSignedIn(result.user.is_enabled);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code did not work.");
    } finally {
      setBusy(false);
    }
  };

  const button =
    "bg-brand-500 shadow-theme-xs hover:bg-brand-600 inline-flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-medium text-white transition disabled:opacity-50";

  if (!sent) {
    return (
      <form onSubmit={onSend} className="space-y-6">
        <div>
          <Label>
            Agent account email <span className="text-error-500">*</span>
          </Label>
          <Input
            name="account_email"
            type="email"
            placeholder="agent@agency.com"
            defaultValue={accountEmail}
            onChange={(event) => setAccountEmail(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The email the agent signs in with — the account you want to open.
          </p>
        </div>
        <div>
          <Label>
            Your developer email <span className="text-error-500">*</span>
          </Label>
          <Input
            name="developer_email"
            type="email"
            placeholder="you@company.com"
            defaultValue={developerEmail}
            onChange={(event) => setDeveloperEmail(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            The code goes here. Only emails the platform admin has added as developers, for
            accounts they were given, receive one.
          </p>
        </div>
        {error ? <p className="text-sm text-error-500">{error}</p> : null}
        <button type="submit" disabled={busy} className={button}>
          {busy ? "Sending…" : "Email me a code"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={(event) => void onVerify(event)} className="space-y-6">
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-300">
        {sent.message}
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Account: {accountEmail.trim()} · Code sent to: {developerEmail.trim()}
        </span>
      </div>
      <div>
        <Label>
          6-digit code <span className="text-error-500">*</span>
        </Label>
        <input
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={code}
          onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
          placeholder="123456"
          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-center text-lg tracking-[0.4em] text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:text-white/90"
        />
      </div>
      {error ? <p className="text-sm text-error-500">{error}</p> : null}
      <button type="submit" disabled={busy} className={button}>
        {busy ? "Checking…" : "Open account"}
      </button>
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <button
          type="button"
          onClick={() => {
            setSent(null);
            setError("");
          }}
          className="underline hover:text-gray-700"
        >
          Change emails
        </button>
        <button
          type="button"
          disabled={busy || wait > 0}
          onClick={() => void send()}
          className="underline hover:text-gray-700 disabled:no-underline disabled:opacity-60"
        >
          {wait > 0 ? `Resend in ${wait}s` : "Resend code"}
        </button>
      </div>
    </form>
  );
}
