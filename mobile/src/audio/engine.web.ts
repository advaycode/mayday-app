import { Asset } from 'expo-asset';

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
  );
  return core;
}

export function unlockAudio() {
  audio()?.unlock();
}
