/**
 * The browser's microphone, playing the part a phone line plays on a real call.
 *
 * It decides when the caller starts speaking (so an interruptible prompt can be
 * cut, a barge-in) and when they stop (so the answer is sent to speech-to-text).
 * Energy based, calibrated to the room for half a second first: the agent's
 * voice must not become the "noise floor", so calibrate before it talks.
 *
 * Half duplex unless the caller is on headphones: while the agent speaks through
 * the laptop's speakers, its own voice would otherwise count as the caller.
 */

const VAD = { preRollMs: 350, startMs: 130, endMs: 700, maxMs: 15_000, minMs: 250 };
/** 10 triggers just above room noise; 1 needs a loud voice. */
const SENSITIVITY = 6;

export type MicEvents = {
  /** Input level, 0..1, for a meter. */
  onLevel: (level: number) => void;
  onSpeechStart: () => void;
  /** How long the caller has been talking, while they talk. */
  onHearing: (ms: number) => void;
  /** One finished answer, ready to upload. */
  onSpeechEnd: (wav: Blob) => void;
  /** True while the agent's prompt is coming out of the speakers. */
  agentTalking: () => boolean;
  /** True when the caller may talk over the agent (headphones). */
  fullDuplex: () => boolean;
};

export class VoiceFlowMic {
  muted = false;
  speaking = false;
  /** An answer is being transcribed; never call that silence. */
  sending = false;

  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private node: ScriptProcessorNode | null = null;
  private frameMs = 0;
  private floor: number | null = null;
  private calib: number[] = [];
  private above = 0;
  private below = 0;
  private preroll: Float32Array[] = [];
  private chunks: Float32Array[] = [];

  constructor(private readonly events: MicEvents) {}

  static supported(): boolean {
    return typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  }

  get calibrated(): boolean {
    return this.floor !== null;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.ctx = new AudioContext();
    this.source = this.ctx.createMediaStreamSource(this.stream);
    // Deprecated but everywhere, and it needs no separate worklet file to serve.
    this.node = this.ctx.createScriptProcessor(1024, 1, 1);
    this.frameMs = (1024 / this.ctx.sampleRate) * 1000;
    this.node.onaudioprocess = (event) =>
      this.onFrame(new Float32Array(event.inputBuffer.getChannelData(0)));
    this.source.connect(this.node);
    // A ScriptProcessor only runs while connected; its output is silence.
    this.node.connect(this.ctx.destination);
  }

  /** Resolves once the room noise is measured (about half a second). */
  async waitForCalibration(): Promise<void> {
    for (let i = 0; i < 40 && this.ctx && this.floor === null; i++) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  stop(): void {
    this.node?.disconnect();
    this.source?.disconnect();
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.ctx?.close();
    this.ctx = this.stream = this.source = this.node = null;
    this.speaking = this.sending = false;
    this.events.onLevel(0);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.speaking = false;
    this.preroll = [];
    this.above = 0;
  }

  private threshold(): number {
    const factor = 1.6 + (10 - SENSITIVITY) * 0.6;
    return Math.max(0.006, (this.floor ?? 0.01) * factor);
  }

  private onFrame(samples: Float32Array): void {
    let sum = 0;
    for (const value of samples) sum += value * value;
    const rms = Math.sqrt(sum / samples.length);
    this.events.onLevel(this.muted ? 0 : Math.min(1, rms * 9));
    if (this.muted || !this.ctx) return;

    if (this.floor === null) {
      this.calib.push(rms);
      if (this.calib.length * this.frameMs >= 500) {
        const sorted = [...this.calib].sort((a, b) => a - b);
        this.floor = sorted[Math.floor(sorted.length / 2)] || 0.005;
      }
      return;
    }
    if (this.events.agentTalking() && !this.events.fullDuplex() && !this.speaking) {
      this.preroll = [];
      this.above = 0;
      return;
    }
    const threshold = this.threshold();

    if (!this.speaking) {
      this.preroll.push(samples);
      while (this.preroll.length * this.frameMs > VAD.preRollMs) this.preroll.shift();
      // Follow slow changes in room noise.
      if (rms < threshold) this.floor = this.floor * 0.98 + rms * 0.02;
      this.above = rms > threshold ? this.above + 1 : 0;
      if (this.above * this.frameMs >= VAD.startMs) {
        this.speaking = true;
        this.below = 0;
        this.chunks = [...this.preroll];
        this.events.onSpeechStart();
      }
      return;
    }
    this.chunks.push(samples);
    this.below = rms < threshold * 0.7 ? this.below + 1 : 0;
    const spokenMs = this.chunks.length * this.frameMs;
    this.events.onHearing(spokenMs);
    if (this.below * this.frameMs >= VAD.endMs || spokenMs >= VAD.maxMs) {
      this.speaking = false;
      const chunks = this.chunks;
      this.chunks = [];
      this.preroll = [];
      if (spokenMs - this.below * this.frameMs >= VAD.minMs) {
        this.events.onSpeechEnd(encodeWav(chunks, this.ctx.sampleRate, 16_000));
      }
    }
  }
}

/** Mono float frames to a 16-bit PCM WAV at `toRate`, by linear interpolation. */
export function encodeWav(chunks: Float32Array[], fromRate: number, toRate: number): Blob {
  const total = chunks.reduce((n, chunk) => n + chunk.length, 0);
  const input = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    input.set(chunk, offset);
    offset += chunk.length;
  }
  const ratio = fromRate / toRate;
  const length = Math.floor(total / ratio);
  const pcm = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const position = i * ratio;
    const j = Math.floor(position);
    const fraction = position - j;
    const value = (input[j] ?? 0) * (1 - fraction) + (input[j + 1] ?? input[j] ?? 0) * fraction;
    pcm[i] = Math.max(-1, Math.min(1, value)) * 0x7fff;
  }
  const buffer = new ArrayBuffer(44 + pcm.byteLength);
  const view = new DataView(buffer);
  const text = (at: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(at + i, char.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + pcm.byteLength, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, toRate, true);
  view.setUint32(28, toRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, "data");
  view.setUint32(40, pcm.byteLength, true);
  new Int16Array(buffer, 44).set(pcm);
  return new Blob([buffer], { type: "audio/wav" });
}
