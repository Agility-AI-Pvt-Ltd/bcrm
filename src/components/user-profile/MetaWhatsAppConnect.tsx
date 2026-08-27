"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  connectWhatsApp,
  disconnectWhatsApp,
  getApiKeys,
  getMetaConfig,
  type ApiKeysState,
} from "@/lib/auth";

/* Facebook Login for Business, reduced to the three calls this flow makes.
 * The SDK is loaded on click rather than on mount: most visits to this page never
 * press the button, and a third-party script that only some people need should only
 * load for those people. */
type FbLoginResponse = {
  authResponse?: { code?: string } | null;
  status?: string;
};

type FbSdk = {
  init: (params: {
    appId: string;
    version: string;
    cookie?: boolean;
    xfbml?: boolean;
  }) => void;
  login: (
    callback: (response: FbLoginResponse) => void,
    options: Record<string, unknown>,
  ) => void;
};

declare global {
  interface Window {
    FB?: FbSdk;
    fbAsyncInit?: () => void;
  }
}

const SDK_ID = "facebook-jssdk";
const SDK_SRC = "https://connect.facebook.net/en_US/sdk.js";
// Meta posts the signup result from its own origin. Anything else is not Meta.
const TRUSTED_ORIGINS = [
  "https://www.facebook.com",
  "https://web.facebook.com",
  "https://business.facebook.com",
];

// One in-flight load, shared by concurrent clicks and cleared on failure. Without the
// reset, a script element that failed still sits in the DOM: `window.FB` stays undefined,
// the element is found on the next click, and a `load` listener gets attached to a script
// that already fired — a promise that never settles and a button that looks alive but
// does nothing until the page is reloaded.
let sdkPromise: Promise<FbSdk> | null = null;
let sdkInitialised = false;

function loadSdk(appId: string, version: string): Promise<FbSdk> {
  const ready = (fb: FbSdk) => {
    if (!sdkInitialised) {
      fb.init({ appId, version, cookie: false, xfbml: false });
      sdkInitialised = true;
    }
    return fb;
  };
  if (window.FB) return Promise.resolve(ready(window.FB));
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise<FbSdk>((resolve, reject) => {
    const fail = (message: string) => {
      sdkPromise = null;
      document.getElementById(SDK_ID)?.remove();
      reject(new Error(message));
    };
    const script = document.createElement("script");
    script.id = SDK_ID;
    script.src = SDK_SRC;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (!window.FB) {
        fail("Facebook loaded but did not start up. Please try again.");
        return;
      }
      resolve(ready(window.FB));
    };
    script.onerror = () =>
      fail("Could not load Facebook. Check your connection and try again.");
    document.body.appendChild(script);
  });
  return sdkPromise;
}

type Props = {
  apiKeys: ApiKeysState | null;
  onChange: (keys: ApiKeysState) => void;
};

export default function MetaWhatsAppConnect({ apiKeys, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  // Meta delivers the account details and the authorization code through two separate
  // browser channels, so each one is parked here until the other shows up.
  const signup = useRef<{ waba_id?: string; phone_number_id?: string }>({});
  // Held so the listener can be dropped if this component unmounts mid-flow — closing the
  // settings page with Meta's popup still open would otherwise leak it for the life of
  // the page. Cleanup only; nothing is set here, so no cascading render.
  const listener = useRef<((event: MessageEvent) => void) | null>(null);

  useEffect(
    () => () => {
      if (listener.current) window.removeEventListener("message", listener.current);
    },
    [],
  );

  const connect = useCallback(async () => {
    setError("");
    setNotice("");
    setWarnings([]);
    signup.current = {};

    let config;
    try {
      config = await getMetaConfig();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not start the connection.");
      return;
    }
    if (!config.configured || !config.app_id || !config.config_id) {
      setError(
        "Self-service connection is not set up on this server yet. Enter your WhatsApp credentials below instead.",
      );
      return;
    }

    let sdk: FbSdk;
    try {
      sdk = await loadSdk(config.app_id, config.graph_version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load Facebook.");
      return;
    }

    // Attached before FB.login, deliberately. The signup message can arrive while the
    // popup is still open — a listener registered afterwards would miss it, and the
    // account details it carries would be gone.
    const onMessage = (event: MessageEvent) => {
      if (!TRUSTED_ORIGINS.includes(event.origin)) return;
      try {
        const data = JSON.parse(event.data as string) as {
          type?: string;
          event?: string;
          data?: { waba_id?: string; phone_number_id?: string };
        };
        if (data.type !== "WA_EMBEDDED_SIGNUP") return;
        if (data.event === "FINISH" || data.event === "FINISH_ONLY_WABA") {
          signup.current = {
            waba_id: data.data?.waba_id,
            phone_number_id: data.data?.phone_number_id,
          };
        }
      } catch {
        // Facebook posts other, unrelated messages from the same origin.
      }
    };
    window.addEventListener("message", onMessage);
    listener.current = onMessage;

    setBusy(true);
    sdk.login(
      (response) => {
        window.removeEventListener("message", onMessage);
        listener.current = null;
        const code = response.authResponse?.code;
        if (!code) {
          setBusy(false);
          setError("Connection cancelled.");
          return;
        }
        void (async () => {
          try {
            const result = await connectWhatsApp({
              code,
              waba_id: signup.current.waba_id ?? null,
              phone_number_id: signup.current.phone_number_id ?? null,
            });
            setNotice(result.message);
            setWarnings(result.warnings);
            // The connect response says what happened; the settings row is what the rest
            // of the page reads, so re-read it rather than patching a copy by hand.
            onChange(await getApiKeys());
          } catch (err) {
            setError(
              err instanceof ApiError ? err.message : "Could not finish connecting WhatsApp.",
            );
          } finally {
            setBusy(false);
          }
        })();
      },
      {
        config_id: config.config_id,
        response_type: "code",
        override_default_response_type: true,
        extras: { setup: {}, featureType: "", sessionInfoVersion: "3" },
      },
    );
  }, [onChange]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError("");
    setNotice("");
    setWarnings([]);
    try {
      onChange(await disconnectWhatsApp());
      setNotice("WhatsApp disconnected. Your chats and contacts are untouched.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect WhatsApp.");
    } finally {
      setBusy(false);
    }
  }, [onChange]);

  const connected = apiKeys?.whatsapp_configured ?? false;
  const selfService = apiKeys?.whatsapp_connected_via === "embedded_signup";
  const label =
    apiKeys?.whatsapp_display_number || apiKeys?.whatsapp_phone_number_id || "your number";

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-25 p-4 dark:border-brand-500/30 dark:bg-brand-500/[0.06]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-gray-800 dark:text-white/90">
            {connected ? `Connected on ${label}` : "Connect your WhatsApp number"}
          </p>
          <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-300">
            {connected
              ? selfService
                ? "Messages to this number reach EstateFlow, and replies go out from it."
                : "These credentials were entered by hand. Reconnect through Meta to manage the number from here."
              : "Sign in with Facebook and pick the number you use for customers. Meta handles the setup — you never copy a token."}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void connect()}
            disabled={busy}
            className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? "Working…" : connected ? "Reconnect" : "Connect WhatsApp"}
          </button>
          {connected && selfService ? (
            <button
              type="button"
              onClick={() => void disconnect()}
              disabled={busy}
              className="text-sm font-medium text-gray-600 underline-offset-4 hover:underline disabled:opacity-50 dark:text-gray-300"
            >
              Disconnect
            </button>
          ) : null}
        </div>
      </div>

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}
      {warnings.length ? (
        <ul className="mt-3 space-y-1 text-sm text-warning-600">
          {warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
