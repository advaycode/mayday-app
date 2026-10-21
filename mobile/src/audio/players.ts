import { createAudioPlayer, type AudioPlayer } from 'expo-audio';

import type { SpeakResult, VoiceEngine } from './core';
import { clipKey, voiceClips, voiceDurations } from './voiceManifest';

/**
 * The audio engine for Expo Go, which does not include react-native-audio-api.
 *
 * Same job as core.ts (Mayday's recorded voice, the counts and the clicks)
 * with expo-audio players instead of the Web Audio graph. Sounds are started
 * by timers on the same clock the screen and the haptics read, a little early
 * to cover the player's start-up time. Less exact than the native engine
 * (a few tens of milliseconds), but every beat is computed from the start
 * time, so it cannot drift.
 */

/** Seconds a player takes to make sound after play(). Started this much early. */
const START_LATENCY = 0.04;

const CLICK = require('../../assets/sounds/click.wav');
const CLICK_ACCENT = require('../../assets/sounds/click-accent.wav');

export class PlayerCore implements VoiceEngine {
  readonly state = 'running';
  speakingUntil = 0;
  lastSpoken: string[] = [];
  private spokenLog: { text: string; end: number }[] = [];
  private players = new Map<string, AudioPlayer>();
  private voiceTimers = new Set<ReturnType<typeof setTimeout>>();
  private playing = new Set<AudioPlayer>();
  private click = createAudioPlayer(CLICK);
  private clickAccent = createAudioPlayer(CLICK_ACCENT);
  private volume = 1;

  constructor(
    private readonly fallbackSpeak: (text: string) => void,
    private readonly ttsUrl = '',
  ) {
    this.click.volume = 0.55;
    this.clickAccent.volume = 0.55;
  }

  now() {
    return performance.now() / 1000;
  }

  async unlock() {
    // expo-audio needs no unlock; engine.ts sets the audio mode.
  }

  has(text: string) {
    return clipKey(text) in voiceClips;
  }

  ready(text: string) {
    return this.players.get(clipKey(text))?.isLoaded ?? false;
  }

  private player(text: string): AudioPlayer | null {
    const key = clipKey(text);
    const existing = this.players.get(key);
    if (existing) return existing;
    const mod = voiceClips[key];
    const source = mod !== undefined ? mod : this.ttsUrl ? { uri: `${this.ttsUrl.replace(/\/$/, '')}/tts?text=${encodeURIComponent(text)}` } : null;
    if (source === null) return null;
    const p = createAudioPlayer(source);
    this.players.set(key, p);
    return p;
  }

  /** Create the players and wait (briefly) for them to load, so the first count is on time. */
  async preload(lines: string[]) {
    const ps = lines.map((l) => this.player(l)).filter((p): p is AudioPlayer => p !== null);
    const deadline = Date.now() + 2500;
    while (ps.some((p) => !p.isLoaded) && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  private at(when: number, fn: () => void, track = true) {
    const ms = Math.max(0, (when - START_LATENCY - this.now()) * 1000);
    const t = setTimeout(() => {
      this.voiceTimers.delete(t);
      fn();
    }, ms);
    if (track) this.voiceTimers.add(t);
  }

  private start(p: AudioPlayer) {
    p.seekTo(0).catch(() => {});
    p.play();
  }

  playClick(when: number, accent = false) {
    const p = accent ? this.clickAccent : this.click;
    this.at(when, () => this.start(p), false);
  }

  playLineAt(text: string, when: number, rate = 1): number | null {
    const key = clipKey(text);
    const p = this.players.get(key);
    if (!p || !p.isLoaded) return null;
    const seconds = (voiceDurations[key] ?? p.duration ?? 0) / rate;
    const at = Math.max(when, this.now());
    this.at(at, () => {
      p.volume = this.volume;
      p.setPlaybackRate(rate);
      this.start(p);
      this.playing.add(p);
      setTimeout(() => this.playing.delete(p), seconds * 1000 + 100);
    });
    const end = at + seconds;
    this.speakingUntil = Math.max(this.speakingUntil, end);
    this.remember(text, end);
    return seconds;
  }

  async speak(lines: string[], opts: { rate?: number; gap?: number } = {}): Promise<SpeakResult> {
    const rate = opts.rate ?? 1;
    const gap = (opts.gap ?? 0.28) / rate;
    this.stopSpeech();
    await this.preload(lines);
    const start = this.now() + 0.05;
    let t = start;
    for (const line of lines) {
      const d = this.playLineAt(line, t, rate);
      if (d === null) {
        // Not recorded: the phone's own voice, with an estimated length.
        this.at(t, () => this.fallbackSpeak(line));
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

  stopSpeech() {
    for (const t of this.voiceTimers) clearTimeout(t);
    this.voiceTimers.clear();
    for (const p of this.playing) p.pause();
    this.playing.clear();
    this.speakingUntil = this.now();
  }

  isSpeaking() {
    return this.now() < this.speakingUntil;
  }

  duck(on: boolean) {
    this.volume = on ? 0.25 : 1;
    for (const p of this.playing) p.volume = this.volume;
  }

  private remember(text: string, end: number) {
    this.lastSpoken = [...this.lastSpoken.slice(-5), text];
    this.spokenLog = [...this.spokenLog.filter((s) => s.end > this.now() - 30), { text, end }];
  }

  recentlySaid(seconds = 12): string[] {
    const since = this.now() - seconds;
    return this.spokenLog.filter((s) => s.end >= since).map((s) => s.text);
  }
}
