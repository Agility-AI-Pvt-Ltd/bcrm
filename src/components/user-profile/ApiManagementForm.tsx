"use client";

import { FormEvent, useEffect, useState } from "react";
import MetaWhatsAppConnect from "@/components/user-profile/MetaWhatsAppConnect";
import {
  ApiError,
  getApiKeys,
  updateApiKeys,
  type ApiKeysState,
} from "@/lib/auth";

const fieldClass =
  "h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm dark:border-gray-700 dark:text-white/90";

export default function ApiManagementForm() {
  const [apiKeys, setApiKeys] = useState<ApiKeysState | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        setApiKeys(await getApiKeys());
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load API keys.");
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
      const openai = String(form.get("openai_api_key") || "").trim();
      const sarvam = String(form.get("sarvam_api_key") || "").trim();
      const whatsappToken = String(form.get("whatsapp_access_token") || "").trim();
      const updated = await updateApiKeys({
        openai_api_key: openai || undefined,
        sarvam_api_key: sarvam || undefined,
        openai_enabled: form.get("openai_enabled") === "on",
        sarvam_enabled: form.get("sarvam_enabled") === "on",
        whatsapp_phone_number_id: String(form.get("whatsapp_phone_number_id") || "").trim() || undefined,
        whatsapp_access_token: whatsappToken || undefined,
        whatsapp_business_id: String(form.get("whatsapp_business_id") || "").trim() || undefined,
        whatsapp_enabled: form.get("whatsapp_enabled") === "on",
      });
      setApiKeys(updated);
      setNotice("API keys saved.");
      event.currentTarget.reset();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "API key update failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
        API management
      </h3>
      <p className="mt-1 mb-4 text-sm text-gray-500 dark:text-gray-400">
        Credentials for your organization. Connect WhatsApp with the button below — the
        number you connect is how inbound chats find their way to this org.
      </p>

      {error ? <p className="mb-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mb-3 text-sm text-success-600">{notice}</p> : null}

      <form onSubmit={(event) => void onSave(event)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-medium text-gray-800 dark:text-white/90">OpenAI</p>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="openai_enabled"
                  key={`openai-en-${apiKeys?.openai_enabled}`}
                  defaultChecked={apiKeys?.openai_enabled ?? true}
                />
                Enabled
              </label>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Current: {apiKeys?.openai_api_key_masked || "not set"}
            </p>
            <input
              name="openai_api_key"
              type="password"
              placeholder="Paste new OpenAI key (leave blank to keep)"
              className={fieldClass}
            />
          </div>
          <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="font-medium text-gray-800 dark:text-white/90">Sarvam AI</p>
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  name="sarvam_enabled"
                  key={`sarvam-en-${apiKeys?.sarvam_enabled}`}
                  defaultChecked={apiKeys?.sarvam_enabled ?? true}
                />
                Enabled
              </label>
            </div>
            <p className="mb-2 text-xs text-gray-500">
              Current: {apiKeys?.sarvam_api_key_masked || "not set"}
            </p>
            <input
              name="sarvam_api_key"
              type="password"
              placeholder="Paste new Sarvam key (leave blank to keep)"
              className={fieldClass}
            />
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
          {/* Heading and rule, with the Enabled switch riding on the same line. The card
              below owns everything about the connection itself, so this stays a frame:
              one name for the section and one control that belongs to us rather than Meta. */}
          <div className="mb-3 flex items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-gray-800">
            <p className="font-medium text-gray-800 dark:text-white/90">WhatsApp Integration</p>
            <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
              <input
                type="checkbox"
                name="whatsapp_enabled"
                key={`wa-en-${apiKeys?.whatsapp_enabled}`}
                defaultChecked={apiKeys?.whatsapp_enabled ?? true}
              />
              Enabled
            </label>
          </div>

          <MetaWhatsAppConnect apiKeys={apiKeys} onChange={setApiKeys} />

          {/* Kept, not replaced: an org that already pasted its own credentials, or whose
              server has no Meta app configured, still needs somewhere to type them. It
              starts closed so the button above is the obvious path. */}
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 marker:text-gray-400 dark:text-gray-300">
              Enter credentials manually
            </summary>
            <p className="mt-3 mb-3 text-xs text-gray-500">
              {apiKeys?.whatsapp_configured
                ? `Token on file: ${apiKeys.whatsapp_access_token_masked}`
                : "From Meta Business Manager: this org's Cloud API Phone Number ID, WABA ID, and token."}
            </p>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-gray-500">Phone Number ID</label>
                <input
                  name="whatsapp_phone_number_id"
                  type="text"
                  defaultValue={apiKeys?.whatsapp_phone_number_id || ""}
                  placeholder="Meta Phone Number ID"
                  className={fieldClass}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-gray-500">WhatsApp Business Account ID (WABA)</label>
                <input
                  name="whatsapp_business_id"
                  type="text"
                  defaultValue={apiKeys?.whatsapp_business_id || ""}
                  placeholder="WABA / Business ID"
                  className={fieldClass}
                />
              </div>
              <div className="lg:col-span-2">
                <label className="mb-1 block text-xs text-gray-500">Access token</label>
                <input
                  name="whatsapp_access_token"
                  type="password"
                  placeholder="Paste new access token (leave blank to keep)"
                  className={fieldClass}
                />
              </div>
            </div>
          </details>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save API keys"}
        </button>
      </form>
    </section>
  );
}
