"use client";

/**
 * Flow voice (vc_v1): talk to the flow-based voice agent through the microphone.
 *
 * The browser stands in for the phone line. It plays each prompt and reports
 * when it finished, listens for the caller, cuts an interruptible prompt when
 * they talk over it, and uploads each answer for speech-to-text. The flow on the
 * server decides every next step; the panel on the right shows that decision.
 *
 * All the call state that audio callbacks read lives in refs, because the mic
 * and the <audio> element call back long after the render that set them up.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { failureText } from "@/lib/api";
import {
  controlVoiceFlowCall,
  fetchVoiceFlowPrompt,
  getVoiceFlowConfig,
  sendVoiceFlowAudio,
  startVoiceFlowCall,
  type VoiceFlowConfig,
  type VoiceFlowEvent,
  type VoiceFlowSnapshot,
} from "@/lib/voiceFlow";
import { VoiceFlowMic } from "@/lib/voiceFlowMic";

type Orb = "idle" | "listening" | "hearing" | "transcribing" | "agent" | "muted";
type Line = { index: number; event: VoiceFlowEvent; cut?: boolean };

const ORB_STYLES: Record<Orb, string> = {
  idle: "bg-gray-300 dark:bg-gray-700",
  listening: "bg-success-500 animate-pulse",
  hearing: "bg-success-600 scale-110",
  transcribing: "bg-warning-500 animate-pulse",
  agent: "bg-brand-500 animate-pulse",
  muted: "bg-gray-400 dark:bg-gray-600",
};

const RETRY_LIMIT = 2;

export default function VoiceFlowConsole({ defaultCustomerName }: { defaultCustomerName: string }) {
  const [config, setConfig] = useState<VoiceFlowConfig | null>(null);
  const [error, setError] = useState("");
  const [customerName, setCustomerName] = useState(defaultCustomerName);
  const [language, setLanguage] = useState("");
  const [aiFallback, setAiFallback] = useState(true);
  const [headphones, setHeadphones] = useState(false);
  const [lines, setLines] = useState<Line[]>([]);
  const [snap, setSnap] = useState<VoiceFlowSnapshot | null>(null);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [orb, setOrb] = useState<{ state: Orb; text: string }>({
    state: "idle",
    text: "Press Start call. The microphone turns on with the call.",
  });
  const [level, setLevel] = useState(0);
  const [muted, setMuted] = useState(false);
  const [starting, setStarting] = useState(false);

  const callRef = useRef<string | null>(null);
  const cursorRef = useRef(0);
  const chainRef = useRef<Promise<unknown>>(Promise.resolve());
  const micRef = useRef<VoiceFlowMic | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** The prompt being played, or null. */
  const playingRef = useRef<{ index: number; bargeIn: boolean } | null>(null);
  const headphonesRef = useRef(false);
  const configRef = useRef<VoiceFlowConfig | null>(null);
  const flow = config?.flows[0] ?? null;

  useEffect(() => {
    headphonesRef.current = headphones;
  }, [headphones]);

  useEffect(() => {
    void (async () => {
      try {
        const loaded = await getVoiceFlowConfig();
        configRef.current = loaded;
        setConfig(loaded);
        setLanguage(loaded.flows[0]?.default_language ?? "");
        if (!loaded.ai_available) setAiFallback(false);
      } catch (err) {
        setError(failureText(err, "Could not reach the Flow voice service."));
      }
    })();
  }, []);

  // -- talking to the API, one request at a time ----------------------------

  const enqueue = useCallback((task: () => Promise<void>) => {
    chainRef.current = chainRef.current
      .then(task)
      .catch((err) => setError(failureText(err, "Something went wrong with the call.")));
  }, []);

  const stopPlayback = useCallback((clear = true) => {
    if (playTimerRef.current) clearTimeout(playTimerRef.current);
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.pause();
      audioRef.current = null;
    }
    if (clear) {
      playingRef.current = null;
      setPlayingIndex(null);
    }
  }, []);

  const stopMic = useCallback(() => {
    micRef.current?.stop();
    micRef.current = null;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setMuted(false);
  }, []);

  // `apply` and `send` call each other through playback; a ref breaks the cycle.
  const applyRef = useRef<(next: VoiceFlowSnapshot) => void>(() => {});

  const send = useCallback(
    (type: "played" | "silence" | "hangup") => {
      const call = callRef.current;
      if (!call) return;
      if (type === "hangup") stopPlayback();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      enqueue(async () => {
        applyRef.current(await controlVoiceFlowCall(call, type, cursorRef.current));
      });
    },
    [enqueue, stopPlayback],
  );

  const armSilence = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    const mic = micRef.current;
    if (!mic || mic.muted) return;
    const wait = configRef.current?.no_input_timeout_ms ?? 6000;
    silenceTimerRef.current = setTimeout(() => {
      // Never "silence" while the caller is talking or being transcribed.
      if (micRef.current && (micRef.current.speaking || micRef.current.sending)) return armSilence();
      send("silence");
    }, wait);
  }, [send]);

  const play = useCallback(
    async (index: number, text: string, bargeIn: boolean) => {
      stopPlayback(false);
      playingRef.current = { index, bargeIn };
      setPlayingIndex(index);
      setOrb({ state: "agent", text: "Agent speaking…" });
      const done = () => {
        if (playingRef.current?.index !== index) return;
        playingRef.current = null;
        setPlayingIndex(null);
        send("played");
      };
      // Moves on once the clip's length has passed, armed before play() because a
      // browser with no audio output or blocked autoplay may never end the clip.
      const fallback = (seconds: number) => {
        if (playTimerRef.current) clearTimeout(playTimerRef.current);
        playTimerRef.current = setTimeout(done, seconds * 1000 + 1500);
      };
      if (!configRef.current?.tts_available) {
        fallback(Math.min(3, text.length * 0.055));
        return;
      }
      try {
        const blob = await fetchVoiceFlowPrompt(callRef.current as string, index);
        if (playingRef.current?.index !== index) return; // barged while it loaded
        const clip = new Audio(URL.createObjectURL(blob));
        audioRef.current = clip;
        clip.onended = done;
        fallback(text.length * 0.075);
        clip.onloadedmetadata = () => {
          if (audioRef.current === clip && Number.isFinite(clip.duration)) fallback(clip.duration);
        };
        clip.play().catch(() => {
          // Pausing for a barge-in also rejects play(); only the live clip matters.
          if (audioRef.current === clip && playingRef.current) {
            setError("The browser blocked audio; the call continues on timing.");
          }
        });
      } catch (err) {
        setError(failureText(err, "Voice failed; continuing on timing."));
        fallback(1);
      }
    },
    [send, stopPlayback],
  );

  const apply = useCallback(
    (next: VoiceFlowSnapshot) => {
      const base = next.cursor - next.events.length;
      cursorRef.current = next.cursor;
      setSnap(next);
      if (next.events.length) {
        setLines((current) => [
          ...current,
          ...next.events.map((event, i) => ({ index: base + i, event })),
        ]);
      }
      if (next.ended) {
        stopPlayback();
        stopMic();
        setOrb({ state: "idle", text: "Call ended. Press Start call to try again." });
        return;
      }
      let lastAgent = -1;
      next.events.forEach((event, i) => {
        if (event.role === "agent") lastAgent = i;
      });
      if (next.playing && lastAgent >= 0) {
        const event = next.events[lastAgent] as Extract<VoiceFlowEvent, { role: "agent" }>;
        void play(base + lastAgent, event.text, event.barge_in);
      } else if (next.listening) {
        const mic = micRef.current;
        setOrb(
          mic?.muted
            ? { state: "muted", text: "Muted: the agent cannot hear you." }
            : { state: "listening", text: "Listening… answer out loud." },
        );
        armSilence();
      }
    },
    [armSilence, play, stopMic, stopPlayback],
  );
  applyRef.current = apply;

  // -- the microphone ---------------------------------------------------------

  const cutPlayback = useCallback(() => {
    const playing = playingRef.current;
    if (!playing) return;
    setLines((current) =>
      current.map((line) => (line.index === playing.index ? { ...line, cut: true } : line)),
    );
    stopPlayback();
  }, [stopPlayback]);

  const startMic = useCallback(async () => {
    const mic = new VoiceFlowMic({
      onLevel: setLevel,
      onSpeechStart: () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (playingRef.current?.bargeIn) cutPlayback(); // barge-in
      },
      onHearing: (ms) => setOrb({ state: "hearing", text: `Hearing you… ${(ms / 1000).toFixed(1)} s` }),
      onSpeechEnd: (wav) => {
        const call = callRef.current;
        if (!call) return;
        mic.sending = true;
        setOrb({ state: "transcribing", text: "Understanding what you said…" });
        enqueue(async () => {
          try {
            applyRef.current(await sendVoiceFlowAudio(call, wav, cursorRef.current));
          } finally {
            mic.sending = false;
          }
        });
      },
      agentTalking: () => playingRef.current !== null && !!configRef.current?.tts_available,
      fullDuplex: () => headphonesRef.current,
    });
    await mic.start();
    micRef.current = mic;
  }, [cutPlayback, enqueue]);

  const startCall = async () => {
    setError("");
    stopPlayback();
    setStarting(true);
    try {
      if (!micRef.current) await startMic();
    } catch (err) {
      const name = err instanceof Error ? err.name : "error";
      setOrb({ state: "muted", text: `Microphone blocked (${name}). Allow the microphone and try again.` });
      setStarting(false);
      return;
    }
    // Measure the room before the agent talks, or its voice becomes the noise floor.
    setOrb({ state: "muted", text: "Measuring room noise… stay quiet for a moment." });
    await micRef.current?.waitForCalibration();
    setLines([]);
    setSnap(null);
    cursorRef.current = 0;
    enqueue(async () => {
      try {
        const started = await startVoiceFlowCall({
          customer_name: customerName.trim() || undefined,
          language: language || undefined,
          ai_fallback: aiFallback,
        });
        callRef.current = started.session_id;
        apply(started);
      } finally {
        setStarting(false);
      }
    });
  };

  const toggleMute = () => {
    const mic = micRef.current;
    if (!mic) return;
    mic.setMuted(!mic.muted);
    setMuted(mic.muted);
    if (mic.muted) {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setOrb({ state: "muted", text: "Muted: the agent cannot hear you." });
    } else if (snap?.listening) {
      setOrb({ state: "listening", text: "Listening… answer out loud." });
      armSilence();
    }
  };

  // Leaving the page hangs up and frees the microphone.
  useEffect(
    () => () => {
      const call = callRef.current;
      micRef.current?.stop();
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      audioRef.current?.pause();
      if (call) void controlVoiceFlowCall(call, "hangup", 0).catch(() => undefined);
    },
    [],
  );

  const live = !!snap && !snap.ended;
  const micSupported = VoiceFlowMic.supported();
  const canStart = !!config && !!flow && config.stt_available && micSupported && !starting && !live;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[180px] flex-1 flex-col gap-1 text-xs text-gray-500">
            Customer name the agent greets
            <input
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
              disabled={live}
              maxLength={80}
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 disabled:opacity-60 dark:border-gray-700 dark:text-white/90"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-gray-500">
            Language
            <select
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
              disabled={live || !flow}
              className="h-10 rounded-lg border border-gray-300 bg-transparent px-3 text-sm text-gray-800 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
            >
              {(flow?.languages ?? []).map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void startCall()}
            disabled={!canStart}
            className="h-10 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start call"}
          </button>
        </div>

        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 dark:text-gray-400">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={aiFallback}
              onChange={(event) => setAiFallback(event.target.checked)}
              disabled={live || !config?.ai_available}
            />
            AI fallback for answers the rules can&rsquo;t place
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={headphones}
              onChange={(event) => setHeadphones(event.target.checked)}
            />
            I&rsquo;m on headphones (I can interrupt the agent)
          </label>
        </div>
        {config && !config.ai_available ? (
          <p className="mt-1 text-xs text-gray-400">The AI fallback is not set up on the voice service.</p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-4 rounded-xl bg-gray-50 p-4 dark:bg-white/[0.04]">
          <span
            aria-hidden
            className={`h-4 w-4 shrink-0 rounded-full transition ${ORB_STYLES[orb.state]}`}
          />
          <p className="min-w-0 flex-1 text-sm text-gray-700 dark:text-gray-300" aria-live="polite">
            {orb.text}
          </p>
          <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800" aria-hidden>
            <div className="h-full bg-success-500 transition-[width]" style={{ width: `${level * 100}%` }} />
          </div>
          <button
            type="button"
            onClick={toggleMute}
            disabled={!live || !micRef.current}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:opacity-40 dark:border-gray-700 dark:text-gray-300"
          >
            {muted ? "Unmute" : "Mute"}
          </button>
          <button
            type="button"
            onClick={() => send("hangup")}
            disabled={!live}
            className="rounded-lg bg-error-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-error-600 disabled:opacity-40"
          >
            Hang up
          </button>
        </div>

        {!micSupported ? (
          <p className="mt-3 text-sm text-error-500">This browser gives no microphone access. Use Chrome or Safari.</p>
        ) : null}
        {config && !config.stt_available ? (
          <p className="mt-3 text-sm text-error-500">Speech-to-text is not set up on the voice service.</p>
        ) : null}
        {error ? <p className="mt-3 text-sm text-error-500">{error}</p> : null}

        <ol className="mt-5 flex max-h-[520px] flex-col gap-3 overflow-y-auto">
          {lines.length === 0 ? (
            <li className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500 dark:border-gray-800">
              Press <b>Start call</b> and answer out loud. Every sentence the agent says is fixed by the flow.
            </li>
          ) : (
            lines.map((line) => (
              <TranscriptLine key={line.index} line={line} playing={line.index === playingIndex} />
            ))
          )}
        </ol>
      </section>

      <aside className="flex flex-col gap-4">
        <Panel title="Current step">
          {snap ? (
            <>
              <p className="font-mono text-sm text-gray-800 dark:text-white/90">{snap.state.id}</p>
              <p className="mt-1 text-xs text-gray-500">{snap.state.purpose}</p>
              {snap.state.collect ? (
                <p className="mt-1 text-xs text-gray-500">
                  Collects <b>{snap.state.collect}</b>
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-400">No call yet.</p>
          )}
        </Panel>
        <Panel title="Retries in this step">
          {(["no_input", "no_match", "off_topic"] as const).map((key) => (
            <div key={key} className="flex items-center justify-between py-0.5 text-sm text-gray-600 dark:text-gray-400">
              <span>{key.replace("_", " ")}</span>
              <span className="flex gap-1">
                {Array.from({ length: RETRY_LIMIT + 1 }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2.5 w-2.5 rounded-full ${
                      i < (snap?.counters[key] ?? 0)
                        ? i >= RETRY_LIMIT
                          ? "bg-error-500"
                          : "bg-warning-500"
                        : "bg-gray-200 dark:bg-gray-700"
                    }`}
                  />
                ))}
              </span>
            </div>
          ))}
        </Panel>
        <Panel title="Collected">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            {(flow?.slots ?? []).map((slot) => (
              <div key={slot} className="contents">
                <dt className="text-gray-500">{slot}</dt>
                <dd className="text-gray-800 dark:text-white/90">{collected(snap, slot)}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        {snap?.outcome ? (
          <Panel title="Outcome">
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {snap.outcome.disposition} → {snap.outcome.next_action}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {snap.outcome.reason} · {snap.outcome.turns} turns · {snap.outcome.flow}
            </p>
          </Panel>
        ) : null}
      </aside>
    </div>
  );
}

/** A collected value, with the date the caller said when one decided it. */
function collected(snap: VoiceFlowSnapshot | null, slot: string): string {
  const value = snap?.slots[slot];
  if (!value) return "—";
  const when = snap?.dates?.[slot];
  if (!when) return value.replace(/_/g, " ");
  const day = new Date(`${when}T00:00:00`);
  const label = day.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${label} (${value.replace(/_/g, " ")})`;
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03]">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
      {children}
    </section>
  );
}

function TranscriptLine({ line, playing }: { line: Line; playing: boolean }) {
  const { event } = line;
  if (event.role === "end") {
    return (
      <li className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-800 dark:bg-white/[0.04]">
        <b>{event.outcome.disposition}</b> → {event.outcome.next_action}
      </li>
    );
  }
  if (event.role === "caller") {
    if (event.kind !== "speech") {
      return (
        <li className="text-center text-xs text-gray-400">
          {event.kind === "silence" ? "… caller stays silent" : "caller hung up"}
        </li>
      );
    }
    return (
      <li className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand-500 px-4 py-2 text-sm text-white">
        {event.text || "(nothing recognisable)"}
        <span className="mt-1 flex flex-wrap gap-1 text-[11px] text-white/80">
          {event.stt_ms !== undefined ? <span>STT {event.stt_ms} ms</span> : null}
          {event.over_prompt ? <span>· over the prompt</span> : null}
          {event.ai ? <span title={event.ai.reason}>· AI → {event.ai.placed}</span> : null}
        </span>
      </li>
    );
  }
  return (
    <li
      className={`max-w-[80%] rounded-2xl rounded-bl-sm px-4 py-2 text-sm text-gray-800 dark:text-white/90 ${
        playing ? "bg-brand-50 ring-1 ring-brand-300 dark:bg-brand-500/10" : "bg-gray-100 dark:bg-white/[0.06]"
      } ${line.cut ? "opacity-60" : ""}`}
    >
      <span className="mb-1 flex flex-wrap gap-1 text-[11px] text-gray-500">
        <span className="font-mono">{event.state}</span>
        {event.barge_in ? null : <span>· not interruptible</span>}
        {line.cut ? <span>· interrupted</span> : null}
      </span>
      {event.text}
    </li>
  );
}
