import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

import { TTS_URL } from '@/config';

import { AudioCore, type Ctx } from './core';

/**
 * Phone: react-native-audio-api gives us the Web Audio API on the native
 * audio engine, so core.ts schedules beats on the hardware clock here too.
 *
 * It is a native module, so it exists in development and store builds but
 * not inside Expo Go. In Expo Go audio() returns null, and the CPR screen
 * still runs on haptics and the on-screen count.
 */
let core: AudioCore | null = null;
let tried = false;

export function audio(): AudioCore | null {
  if (core || tried) return core;
  tried = true;
  try {
    // Required lazily so Expo Go (which lacks the module) does not crash on import.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AudioContext } = require('react-native-audio-api') as { AudioContext: new () => Ctx };
    const ctx = new AudioContext();
    core = new AudioCore(
      ctx,
      (mod) => ctx.decodeAudioData(mod),
      (text) => Speech.speak(text, { rate: 0.95, pitch: 0.95 }),
      TTS_URL,
    );
  } catch {
    core = null;
  }
  return core;
}

export function unlockAudio() {
  // Play through the silent switch, and lower (not stop) other apps' audio.
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', allowsRecording: true }).catch(() => {});
  audio()?.unlock();
}
