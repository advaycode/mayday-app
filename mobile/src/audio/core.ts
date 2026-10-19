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
type Source = Node & { buffer: Buf | null; playbackRate: Param; start(when?: number): void; stop(when?: number): void; onEnded?: unknown; onended?: unknown };
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
  /** Everything said lately, with when it ends on the audio clock, for the echo guard. */
  private spokenLog: { text: string; end: number }[] = [];

  constructor(
    readonly ctx: Ctx,
    private readonly loadAsset: (moduleId: number) => Promise<Buf>,
    private readonly fallbackSpeak: (text: string) => void,
    /** Neural voice server for lines that only exist at runtime (tools/tts_server.py). */
    private readonly ttsUrl = '',
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

  /** Is this line's audio decoded and ready to play with no delay? */
  ready(text: string) {
    return this.buffers.has(clipKey(text));
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
    if (mod === undefined) {
      // Not pre-recorded (an adapted line): ask the voice server, same voice.
      if (!this.ttsUrl) return Promise.resolve(null);
      const p = fetch(`${this.ttsUrl.replace(/\/$/, '')}/tts?text=${encodeURIComponent(text)}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('tts'))))
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((b) => {
          this.buffers.set(key, b);
          return b;
        })
        .catch(() => null);
      this.loading.set(key, p);
      return p;
    }
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

  /** Play one loaded line at an exact time. Returns its duration, or null if it isn't loaded. */
  playLineAt(text: string, when: number, rate = 1): number | null {
    const buf = this.buffers.get(clipKey(text));
    if (!buf) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    // Slower is also slightly lower: a calmer voice for a rescuer who is struggling.
    src.playbackRate.value = rate;
    src.connect(this.voiceGain);
    const at = Math.max(when, this.ctx.currentTime);
    src.start(at);
    this.voiceSources.add(src);
    const end = at + buf.duration / rate;
    this.speakingUntil = Math.max(this.speakingUntil, end);
    this.remember(text, end);
    setTimeout(() => this.voiceSources.delete(src), (end - this.ctx.currentTime) * 1000 + 100);
    return buf.duration / rate;
  }

  /**
   * Say several lines back to back, starting now. Missing clips use the
   * system voice. Returns when, on the audio clock, the speech will end.
   */
  async speak(lines: string[], opts: { rate?: number; gap?: number } = {}): Promise<SpeakResult> {
    const rate = opts.rate ?? 1;
    const gap = (opts.gap ?? 0.28) / rate;
    this.stopSpeech();
    await Promise.all(lines.map((l) => this.buffer(l)));
    const start = this.ctx.currentTime + 0.05;
    let t = start;
    for (const line of lines) {
      const d = this.playLineAt(line, t, rate);
      if (d === null) {
        // Not pre-rendered: hand it to the system voice and estimate its length.
        const at = t;
        setTimeout(() => this.fallbackSpeak(line), Math.max(0, (at - this.ctx.currentTime) * 1000));
        const est = 0.35 + line.split(/\s+/).length * 0.36;
        this.speakingUntil = Math.max(this.speakingUntil, t + est);
        this.remember(line, t + est);
        t += est + gap;
      } else {
        t += d + gap;
      }
    }
    return { start, end: t - gap };
  }

  private remember(text: string, end: number) {
    this.lastSpoken = [...this.lastSpoken.slice(-5), text];
    this.spokenLog = [...this.spokenLog.filter((s) => s.end > this.ctx.currentTime - 30), { text, end }];
  }

  /**
   * Lines that ended in the last `seconds` (or are still playing). Speech
   * recognisers can deliver a final transcript several seconds late, so the
   * echo guard looks back in time rather than at the last few lines.
   */
  recentlySaid(seconds = 12): string[] {
    const since = this.ctx.currentTime - seconds;
    return this.spokenLog.filter((s) => s.end >= since).map((s) => s.text);
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
