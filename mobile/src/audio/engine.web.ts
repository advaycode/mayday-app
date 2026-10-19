import { Asset } from 'expo-asset';

import { TTS_URL } from '@/config';

import { AudioCore, type Ctx } from './core';

/**
 * Web: the browser's own AudioContext. Browsers only allow audio to start
 * after a user gesture, so the home screen's hold button calls unlockAudio()
 * the moment a finger touches it.
 */
let core: AudioCore | null = null;

export function audio(): AudioCore | null {
  if (core) return core;
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  // iPhone Safari mutes web audio when the ring switch is on silent, unless the
  // page says it is playing media (Safari 16.4+). A rescuer must hear the count.
  try {
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'playback';
  } catch {
    // older browser: the silent switch applies
  }
  const ctx = new Ctor({ latencyHint: 'interactive' }) as unknown as Ctx;
  core = new AudioCore(
    ctx,
    async (mod) => {
      const asset = Asset.fromModule(mod);
      const res = await fetch(asset.uri);
      return ctx.decodeAudioData(await res.arrayBuffer());
    },
    (text) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 0.95;
        window.speechSynthesis.speak(u);
      } catch {
        // no system voice available
      }
    },
    TTS_URL,
  );
  return core;
}

export function unlockAudio() {
  audio()?.unlock();
}
