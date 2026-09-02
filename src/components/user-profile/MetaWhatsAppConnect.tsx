"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ApiError,
  connectWhatsApp,
  createWhatsAppSignupLink,
  disconnectWhatsApp,
  getApiKeys,
  getMetaConfig,
  registerWhatsAppNumber,
  testWhatsAppConnection,
  type ApiKeysState,
  type MetaConnectionTest,
  type MetaSignupLink,
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

/* ---------------------------------------------------------------------------
 * The result of a setup link, read back off the URL.
 *
 * A shared link is finished in someone else's browser, so the callback's only way to
 * report anything is the redirect itself: it lands on this page as
 * ?whatsapp=connected|cancelled|error&reason=…
 *
 * Read through useSyncExternalStore for the same reason useStoredUser is — the server
 * render cannot know the query string, so the server and hydration passes are handed ""
 * and React re-renders once with the real value. Reading it in an effect instead would
 * mean a setState the moment this mounts, and reading window.location during render
 * would be a hydration mismatch.
 * ------------------------------------------------------------------------- */

function subscribeToLocation(onChange: () => void) {
  // A finished link arrives as a full page load, so in practice this is read once on
  // mount and never changes. popstate is cheap insurance for a back-navigation onto
  // this page while the card stays mounted.
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

// Returns a primitive deliberately: useSyncExternalStore re-renders forever if the
// snapshot is a fresh object on every call.
function locationSearch(): string {
  return window.location.search;
}

function noLocationSearch(): string {
  return "";
}

type Arrival = { tone: "success" | "error" | "info"; message: string };

const TONE_CLASS: Record<Arrival["tone"], string> = {
  success: "text-success-600",
  error: "text-error-500",
  info: "text-gray-600 dark:text-gray-300",
};

/* The callback sends back a short sentence written for customers, and deliberately no
 * ids, phone numbers or links — see `_return_to_app` in the API. Anything outside that
 * shape did not come from us, and this URL is one people share, so `reason` is text a
 * stranger can choose and have rendered on our own domain. React escapes it, so the risk
 * is not markup; it is a convincing "your account is suspended, call this number" wearing
 * our styling. Text that breaks the API's own contract falls back to a generic message,
 * and the real detail stays in the server log where it can be trusted. */
const REASON_MAX_LENGTH = 200;
const REASON_NOT_OURS = /https?:|www\.|[@+]|\d{5,}/i;

function describeArrival(search: string): Arrival | null {
  const params = new URLSearchParams(search);
  const status = params.get("whatsapp");
  if (!status) return null;

  if (status === "connected") {
    return {
      tone: "success",
      message: "WhatsApp is connected. That setup link is now used up.",
    };
  }
  if (status === "cancelled") {
    // The callback returns before spending the nonce, so the link really does still
    // work. Worth saying: otherwise someone asks for a new one they do not need.
    return {
      tone: "info",
      message: "Setup was cancelled and nothing changed. The same link still works.",
    };
  }
  if (status !== "error") return null;

  const reason = (params.get("reason") ?? "").trim();
  const ours =
    reason.length > 0 && reason.length <= REASON_MAX_LENGTH && !REASON_NOT_OURS.test(reason);
  return {
    tone: "error",
    message: ours
      ? `${reason} Create a new setup link to try again.`
      : "That setup link did not go through. Create a new one to try again.",
  };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // No permission, or a page served over plain http, where the API does not exist.
    // The link is on screen and selectable either way, so this only changes what we
    // claim happened.
    return false;
  }
}

/* ---------------------------------------------------------------------------
 * The connection, reduced to one line.
 *
 * Two different things can be true at once, and the card has to say both: the stored
 * credentials work, and the number still cannot send. `can_send` is Meta's answer to the
 * second, so the dot follows it rather than following "we have a token".
 *
 * Before anyone presses Test Connection there is nothing live to report, only a settings
 * row that says a number was attached — hence a grey dot rather than a green one. Claiming
 * "ready to send" from stored data is exactly the claim that turned out to be wrong.
 * ------------------------------------------------------------------------- */

type Health = { dot: string; tone: string; label: string };

const UNCHECKED: Health = {
  dot: "bg-gray-400",
  tone: "text-gray-800 dark:text-white/90",
  label: "Connected",
};

function describeHealth(check: MetaConnectionTest | null): Health {
  if (!check) return UNCHECKED;
  if (!check.ok) {
    return { dot: "bg-error-500", tone: "text-error-500", label: "Could not verify" };
  }
  if (check.can_send) {
    return { dot: "bg-success-500", tone: "text-success-600", label: "Connected" };
  }
  // Meta's own word, lowercased and passed through. It has added values here before, and a
  // status we do not recognise is still more use to the person reading it than "not ready".
  const status = (check.status ?? "").trim().toLowerCase();
  return {
    dot: "bg-warning-500",
    tone: "text-warning-600",
    label: status ? `Connected · Meta says ${status}` : "Connected · not ready to send",
  };
}

/* Meta's own field, not a rating we compute. UNKNOWN is what a number that has not sent
 * enough messages to be rated reports, which is not worth a line on the card. */
function describeQuality(check: MetaConnectionTest | null): string {
  const rating = (check?.quality_rating ?? "").trim();
  return rating && rating.toUpperCase() !== "UNKNOWN" ? rating.toLowerCase() : "";
}

// Takes the timestamp the server put in the response rather than reading the clock, so this
// stays a pure function of the result it is describing.
function checkedAtLabel(iso: string): string {
  const at = new Date(iso);
  return Number.isNaN(at.getTime())
    ? ""
    : at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Meta's rule, enforced here only to keep the button off until there is something to send.
// The real check is the backend's, which refuses anything that is not six digits.
const PIN_LENGTH = 6;

type Props = {
  apiKeys: ApiKeysState | null;
  onChange: (keys: ApiKeysState) => void;
};

export default function MetaWhatsAppConnect({ apiKeys, onChange }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  // False until the config arrives, which is what keeps the setup-link button off a
  // deployment that has no Redirect URI registered — there, minting a link would only
  // produce something that dead-ends at Meta.
  const [canShare, setCanShare] = useState(false);
  // Separate from `busy` so the label lands on the button that is actually working. Both
  // still lock every control: two Meta flows at once is not a thing anyone wants.
  const [sharing, setSharing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [checking, setChecking] = useState(false);
  const [registering, setRegistering] = useState(false);
  // The last live answer from Meta, or null when nobody has asked yet. Never seeded from
  // the settings row: the point of the button is that stored data cannot answer this.
  const [check, setCheck] = useState<MetaConnectionTest | null>(null);
  // What the connect said about registration. The server read the number's status while
  // completing the connection, so the PIN field can be offered with the warning that asks
  // for it — the alternative was a warning pointing at a control that only appears after a
  // Test Connection, which is how this ended up reading as "go and find another screen".
  const [connectCanRegister, setConnectCanRegister] = useState(false);
  // The number's own two-step verification PIN, held only long enough to send it. Not
  // written anywhere and cleared as soon as Meta has seen it.
  const [pin, setPin] = useState("");
  const [link, setLink] = useState<MetaSignupLink | null>(null);
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
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

  useEffect(() => {
    void (async () => {
      try {
        setCanShare((await getMetaConfig()).hosted_signup_available);
      } catch {
        // This only decides whether the setup-link button is offered. Connect fetches
        // the config again on click and reports its own failure, so there is nothing to
        // announce here: a card with one working button beats an error on arrival.
      }
    })();
  }, []);

  const connect = useCallback(async () => {
    setError("");
    setNotice("");
    setWarnings([]);
    setLink(null);
    setCopied("");
    setCheck(null);
    setConnectCanRegister(false);
    setPin("");
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
            // `?? false` rather than a bare read: the field is optional, and an API old
            // enough not to send it should leave the card exactly as it was.
            setConnectCanRegister(result.can_register ?? false);
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
        // featureType comes from the server, not from here. Empty is Meta's standard
        // flow — create a WABA or attach an existing one — and stays the default. The
        // value that switches on Coexistence (keep the WhatsApp Business app on the same
        // number) is only accepted once Meta has allow-listed the app, so it is one
        // server setting away rather than a constant in the bundle.
        extras: {
          setup: {},
          featureType: config.feature_type ?? "",
          sessionInfoVersion: "3",
        },
      },
    );
  }, [onChange]);

  /**
   * Mint a link that lets someone else finish the setup, and put it on the clipboard.
   *
   * The other half of the same door: the popup needs the agency's Facebook password in
   * front of this screen, and often it is not. Nothing is sent from here — the link is
   * handed back for the person to pass on however they already talk to their customer.
   */
  const share = useCallback(async () => {
    setSharing(true);
    setError("");
    setNotice("");
    setWarnings([]);
    setLink(null);
    setCopied("");
    try {
      const minted = await createWhatsAppSignupLink();
      setLink(minted);
      setCopied((await copyToClipboard(minted.url)) ? "done" : "failed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create a setup link.");
    } finally {
      setSharing(false);
    }
  }, []);

  const recopy = useCallback(async (url: string) => {
    setCopied((await copyToClipboard(url)) ? "done" : "failed");
  }, []);

  /**
   * Ask Meta about the number this account already holds.
   *
   * Nothing is sent. A test message would need a recipient, would count against the
   * account's messaging limits and would land in somebody's chat — so the server asks Meta
   * about the number instead, which is what actually breaks: a revoked token, a number
   * moved to another business, a number that was never registered for sending.
   *
   * A refusal from Meta is not an exception here: the server answers with `ok: false` and
   * Meta's own reason, and only a request that never completed lands in `catch`.
   */
  const runCheck = useCallback(async () => {
    setChecking(true);
    setError("");
    setNotice("");
    setWarnings([]);
    try {
      setCheck(await testWhatsAppConnection());
    } catch (err) {
      setCheck(null);
      setError(err instanceof ApiError ? err.message : "Could not check the connection.");
    } finally {
      setChecking(false);
    }
  }, []);

  /**
   * Finish the one step a connect cannot do: register the number for sending.
   *
   * Meta's wizard normally does this, and when it does not, the missing piece is a PIN that
   * only the person who owns the number can supply — which is why it is asked for here, one
   * attempt at a time, instead of being a setting on the server.
   *
   * A failure leaves the last check in place on purpose. The likely cause is a wrong PIN,
   * and the field has to still be there to try again; that retry is the whole reason this
   * action exists rather than "disconnect and start over".
   */
  const registerNumber = useCallback(async () => {
    if (pin.length !== PIN_LENGTH) return;
    setRegistering(true);
    setError("");
    setNotice("");
    setWarnings([]);
    try {
      setCheck(await registerWhatsAppNumber(pin));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not register this number.");
    } finally {
      // Cleared either way. Meta has seen this attempt, and a value left in the box invites
      // pressing the same wrong PIN a second time.
      setPin("");
      setRegistering(false);
    }
  }, [pin]);

  const disconnect = useCallback(async () => {
    setDisconnecting(true);
    setError("");
    setNotice("");
    setWarnings([]);
    setLink(null);
    setCopied("");
    setCheck(null);
    setConnectCanRegister(false);
    setPin("");
    try {
      onChange(await disconnectWhatsApp());
      setNotice("WhatsApp disconnected. Your chats and contacts are untouched.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not disconnect WhatsApp.");
    } finally {
      setDisconnecting(false);
    }
  }, [onChange]);

  const connected = apiKeys?.whatsapp_configured ?? false;
  const selfService = apiKeys?.whatsapp_connected_via === "embedded_signup";
  const locked = busy || sharing || disconnecting || checking || registering;
  // Live values win over stored ones. A number can be renamed at Meta, and the check just
  // read the current answer; the settings row records how things looked at connect time.
  const phone =
    check?.display_number ||
    apiKeys?.whatsapp_display_number ||
    apiKeys?.whatsapp_phone_number_id ||
    "";
  const business = check?.verified_name || apiKeys?.whatsapp_verified_name || "";
  const health = describeHealth(connected ? check : null);
  const quality = describeQuality(check);
  const checkedAt = check ? checkedAtLabel(check.checked_at) : "";
  // Two sources, and the precedence is load-bearing. A live check is newer than the connect
  // that preceded it, and `registerNumber` replaces `check` with the answer Meta gave after
  // registering — so once that succeeds, `can_register: false` closes the box. Falling back
  // to the connect value instead of merging with it is what stops a stale "not registered"
  // from keeping the PIN field open over a number that is now sending.
  const canRegister = connected && (check ? check.can_register : connectCanRegister);

  const search = useSyncExternalStore(subscribeToLocation, locationSearch, noLocationSearch);
  // Anything the person has done since arriving is more current than the URL they
  // arrived with, so their own result wins the message area.
  const acted = Boolean(error || notice || link || warnings.length || check);
  const arrival = acted ? null : describeArrival(search);

  return (
    <div className="rounded-xl border border-brand-100 bg-brand-25 p-4 dark:border-brand-500/30 dark:bg-brand-500/[0.06]">
      {connected ? (
        <>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className={`flex items-center gap-2 font-medium ${health.tone}`}>
                <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${health.dot}`} />
                {health.label}
              </p>
              {/* Omitted rather than faked when Meta never gave us a name, or when the
                  connection predates our storing it. The first Test Connection fills it in. */}
              {business ? (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                  Business:{" "}
                  <span className="font-medium text-gray-800 dark:text-white/90">{business}</span>
                </p>
              ) : null}
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                Phone:{" "}
                <span className="font-medium text-gray-800 dark:text-white/90">
                  {phone || "not recorded"}
                </span>
              </p>
              {check?.ok && (quality || checkedAt) ? (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {quality ? `Quality ${quality}` : null}
                  {quality && checkedAt ? " · " : null}
                  {checkedAt ? `Checked at ${checkedAt}` : null}
                </p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void runCheck()}
                disabled={locked}
                className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
              >
                {checking ? "Checking…" : "Test Connection"}
              </button>
              {selfService ? (
                <button
                  type="button"
                  onClick={() => void disconnect()}
                  disabled={locked}
                  className="rounded-lg border border-brand-200 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
                >
                  {disconnecting ? "Working…" : "Disconnect"}
                </button>
              ) : null}
            </div>
          </div>

          {!selfService ? (
            <p className="mt-3 max-w-xl text-sm text-gray-600 dark:text-gray-300">
              These credentials were entered by hand. Reconnect through Meta to manage this
              number from here.
            </p>
          ) : null}

          {/* The check's own words, in the colour its own verdict earns. Kept out of `notice`
              and `error`, which belong to connecting, sharing and disconnecting: a green tick
              on "connected, but Meta reports it as pending" would say the wrong thing.

              The wrapper is always rendered, empty included: a live region announces changes
              to itself, so one that appears at the same moment as its content announces
              nothing. */}
          <div aria-live="polite">
            {check ? <p className={`mt-3 text-sm ${health.tone}`}>{check.message}</p> : null}
            {check?.warnings.length ? (
              <ul className="mt-2 space-y-1 text-sm text-warning-600">
                {check.warnings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Offered whenever the server said this number can be registered — from a live
              check or from the connect that just finished — so the card never asks for a PIN
              it has nowhere to send, and never mentions registration without showing where
              it happens. Placed above the links because it is the thing to do next. The
              reason for it sits directly above after a check and at the foot of the card
              after a connect, which is why the warning names this box by its heading rather
              than saying "below". */}
          {canRegister ? (
            <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                Register this number for sending
              </p>
              <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-300">
                Enter the six-digit two-step verification PIN for this WhatsApp number. It is
                passed to Meta and not saved here. If the number has no PIN yet, this becomes
                it.
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  type="password"
                  value={pin}
                  // Digits only, six at most, so a PIN pasted with spaces still works and a
                  // stray character never reaches Meta as a failed attempt.
                  onChange={(event) =>
                    setPin(event.currentTarget.value.replace(/\D/g, "").slice(0, PIN_LENGTH))
                  }
                  // This card sits inside the API-keys form. Without this, Enter in the PIN
                  // field would submit that form and save credentials nobody was editing.
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    if (!locked && pin.length === PIN_LENGTH) void registerNumber();
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={PIN_LENGTH}
                  placeholder="••••••"
                  aria-label="Six-digit PIN for this WhatsApp number"
                  className="h-10 w-28 rounded-lg border border-gray-300 bg-transparent px-3 text-center text-sm tracking-widest text-gray-700 dark:border-gray-700 dark:text-white/90"
                />
                <button
                  type="button"
                  onClick={() => void registerNumber()}
                  disabled={locked || pin.length !== PIN_LENGTH}
                  className="h-10 rounded-lg bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
                >
                  {registering ? "Registering…" : "Register for sending"}
                </button>
              </div>
            </div>
          ) : null}

          {/* Reconnect and the setup link are still here, just no longer competing with the
              two things someone visiting a working connection actually came to do. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={locked}
              className="text-gray-600 underline-offset-4 hover:underline disabled:opacity-50 dark:text-gray-300"
            >
              {busy ? "Working…" : "Reconnect"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={() => void share()}
                disabled={locked}
                className="text-gray-600 underline-offset-4 hover:underline disabled:opacity-50 dark:text-gray-300"
              >
                {sharing ? "Working…" : "Create a setup link"}
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-medium text-gray-800 dark:text-white/90">
              Connect your existing WhatsApp Business
            </p>
            {/*
              The number the agency already gives out is the primary case, and the heading
              and this line say so. Nothing here is created for them and nothing is lent to
              them: they connect their own number, and it stays theirs.
            */}
            <p className="mt-1 max-w-xl text-sm text-gray-600 dark:text-gray-300">
              Connect the WhatsApp number you already use with your customers. Meta securely
              handles the connection — you don&apos;t need to copy tokens.
            </p>
            <p className="mt-2 max-w-xl text-sm text-gray-500 dark:text-gray-400">
              Don&apos;t have WhatsApp Business yet? You can create one during setup.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void connect()}
              disabled={locked}
              className="rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-600 disabled:opacity-50"
            >
              {busy ? "Working…" : "Connect WhatsApp"}
            </button>
            {canShare ? (
              <button
                type="button"
                onClick={() => void share()}
                disabled={locked}
                className="rounded-lg border border-brand-200 px-4 py-2.5 text-sm font-medium text-brand-600 hover:bg-brand-50 disabled:opacity-50 dark:border-brand-500/40 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                {sharing ? "Working…" : "Create a setup link"}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {canShare && !connected && !link ? (
        <p className="mt-3 max-w-xl text-sm text-gray-600 dark:text-gray-300">
          Not the person with the Facebook password? Create a setup link and send it to
          whoever is. They finish in Meta, and the number arrives here.
        </p>
      ) : null}

      {link ? (
        <div className="mt-3 rounded-lg border border-brand-200 p-3 dark:border-brand-500/40">
          <p className="text-sm font-medium text-gray-800 dark:text-white/90">
            Send this to the person finishing the setup
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              readOnly
              value={link.url}
              aria-label="Setup link"
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-700 dark:border-gray-700 dark:text-white/90"
            />
            <button
              type="button"
              onClick={() => void recopy(link.url)}
              className="h-10 rounded-lg bg-brand-500 px-3 text-sm font-medium text-white hover:bg-brand-600"
            >
              Copy
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {copied === "done" ? "Copied to your clipboard. " : null}
            {copied === "failed" ? "Select the link to copy it. " : null}
            It works once and expires in {link.expires_in_minutes}{" "}
            {link.expires_in_minutes === 1 ? "minute" : "minutes"}. Whoever opens it can
            attach a WhatsApp number to this account, so send it to one person rather
            than a group.
          </p>
        </div>
      ) : null}

      {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-success-600">{notice}</p> : null}
      {warnings.length ? (
        <ul className="mt-3 space-y-1 text-sm text-warning-600">
          {warnings.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {arrival ? (
        <p className={`mt-3 text-sm ${TONE_CLASS[arrival.tone]}`}>{arrival.message}</p>
      ) : null}
    </div>
  );
}
