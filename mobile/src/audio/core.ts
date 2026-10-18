import { voiceClips, clipKey } from './voiceManifest';

/**
 * The audio engine, written once against the Web Audio API.
 *
 * In the browser that API is built in. On the phone, react-native-audio-api
 * provides the same API on top of the phone's native audio engine. So this
 * one file schedules clicks, counts and voice lines on the audio hardware
 * clock on both. engine.ts and engine.web.ts only decide where the
 * AudioContext comes from.
 *
 * Voice: every line the app can say during a protocol is pre-rendered to a
 * file at build time (tools/render_voice.py), so speaking costs no network
 * and no text-to-speech delay, and a count lands exactly on its beat. Lines
 * that are not pre-rendered fall back to the system voice.
 */

// The few Web Audio types we use, so this works with either implementation.
type Buf = { duration: number; getChannelData(ch: number): Float32Array };
type Param = { value: number; setValueAtTime(v: number, t: number): unknown; linearRampToValueAtTime(v: number, t: number): unknown };
type Node = { connect(dest: any): unknown; disconnect?: () => void };
type Source = Node & { buffer: Buf | null; start(when?: number): void; stop(when?: number): void; onEnded?: unknown; onended?: unknown };
export type Ctx = {
  currentTime: number;
  sampleRate: number;
  state?: string;
  destination: any;
  resume(): Promise<void>;
  createGain(): Node & { gain: Param };
  createBufferSource(): Source;
  createBuffer(channels: number, length: number, rate: number): Buf;
  decodeAudioData(input: any): Promise<Buf>;
};

export type SpeakResult = { start: number; end: number };

export class AudioCore {
  private buffers = new Map<string, Buf>();
  private loading = new Map<string, Promise<Buf | null>>();
  private voiceGain: ReturnType<Ctx['createGain']>;
  private clickGain: ReturnType<Ctx['createGain']>;
  private voiceSources = new Set<Source>();
  private click: Buf;
  private clickAccent: Buf;
  /** Audio-clock time until which our own voice is playing (for the echo guard). */
  speakingUntil = 0;
  lastSpoken: string[] = [];

  constructor(
    readonly ctx: Ctx,
    private readonly loadAsset: (moduleId: number) => Promise<Buf>,
    private readonly fallbackSpeak: (text: string) => void,
  ) {
    this.voiceGain = ctx.createGain();
    this.voiceGain.connect(ctx.destination);
    this.clickGain = ctx.createGain();
    this.clickGain.gain.value = 0.55;
    this.clickGain.connect(ctx.destination);
    this.click = this.synthClick(1650, 0.028);
    this.clickAccent = this.synthClick(2100, 0.034);
  }

  now(): number {
    return this.ctx.currentTime;
  }

  async unlock() {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
  }

  /** A short, soft woodblock-like tick: a decaying sine with a little noise for the attack. */
  private synthClick(freq: number, seconds: number): Buf {
    const rate = this.ctx.sampleRate;
    const n = Math.floor(rate * seconds);
    const buf = this.ctx.createBuffer(1, n, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      const env = Math.exp(-t * 160);
      data[i] = (Math.sin(2 * Math.PI * freq * t) * 0.8 + (Math.random() * 2 - 1) * 0.2 * Math.exp(-t * 900)) * env;
    }
    return buf;
  }

  has(text: string) {
    return clipKey(text) in voiceClips;
  }

  /** Decode clips ahead of time so the first count is not late. */
  async preload(lines: string[]) {
    await Promise.all(lines.map((l) => this.buffer(l)));
  }

  private buffer(text: string): Promise<Buf | null> {
    const key = clipKey(text);
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    const inflight = this.loading.get(key);
    if (inflight) return inflight;
    const mod = voiceClips[key];
    if (mod === undefined) return Promise.resolve(null);
    const p = this.loadAsset(mod)
      .then((b) => {
        this.buffers.set(key, b);
        return b;
      })
      .catch(() => null);
    this.loading.set(key, p);
    return p;
  }

  playClick(when: number, accent = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = accent ? this.clickAccent : this.click;
    src.connect(this.clickGain);
    src.start(Math.max(when, this.ctx.currentTime));
  }

  /** Play one pre-rendered line at an exact time. Returns its duration, or null if not pre-rendered/loaded. */
  playLineAt(text: string, when: number): number | null {
    const buf = this.buffers.get(clipKey(text));
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.voiceGain);
    const at = Math.max(when, this.ctx.currentTime);
    src.start(at);
    this.voiceSources.add(src);
    const end = at + buf.duration;
    this.speakingUntil = Math.max(this.speakingUntil, end);
    this.lastSpoken = [...this.lastSpoken.slice(-5), text];
    setTimeout(() => this.voiceSources.delete(src), (end - this.ctx.currentTime) * 1000 + 100);
    return buf.duration;
  }

  /**
   * Say several lines back to back, starting now. Missing clips use the
   * system voice. Returns when, on the audio clock, the speech will end.
   */
  async speak(lines: string[], gap = 0.28): Promise<SpeakResult> {
    this.stopSpeech();
    await Promise.all(lines.map((l) => this.buffer(l)));
    const start = this.ctx.currentTime + 0.05;
    let t = start;
    for (const line of lines) {
      const d = this.playLineAt(line, t);
      if (d === null) {
        // Not pre-rendered: hand it to the system voice and estimate its length.
        const at = t;
        setTimeout(() => this.fallbackSpeak(line), Math.max(0, (at - this.ctx.currentTime) * 1000));
        const est = 0.35 + line.split(/\s+/).length * 0.36;
        this.speakingUntil = Math.max(this.speakingUntil, t + est);
        this.lastSpoken = [...this.lastSpoken.slice(-5), line];
        t += est + gap;
      } else {
        t += d + gap;
      }
    }
    return { start, end: t - gap };
  }

  /** Barge-in: the person started talking, so we stop. */
  stopSpeech() {
    for (const s of this.voiceSources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.voiceSources.clear();
    this.speakingUntil = this.ctx.currentTime;
  }

  isSpeaking() {
    return this.ctx.currentTime < this.speakingUntil;
  }

  /** Lower our own voice while the person is speaking, so we do not talk over them. */
  duck(on: boolean) {
    const t = this.ctx.currentTime;
    this.voiceGain.gain.setValueAtTime(this.voiceGain.gain.value, t);
    this.voiceGain.gain.linearRampToValueAtTime(on ? 0.25 : 1, t + 0.12);
  }
}
