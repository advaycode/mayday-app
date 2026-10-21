import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

import { TTS_URL } from '@/config';

import { AudioCore, type Ctx, type VoiceEngine } from './core';
import { PlayerCore } from './players';

/**
 * Phone: react-native-audio-api gives us the Web Audio API on the native
 * audio engine, so core.ts schedules beats on the hardware clock here too.
 *
 * It is a native module, so it exists in development and store builds but
 * not inside Expo Go. In Expo Go, players.ts plays the same recorded voice,
 * counts and clicks through expo-audio, a little less exactly.
 */
let core: VoiceEngine | null = null;
let tried = false;

export function audio(): VoiceEngine | null {
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
    // Expo Go: no audio engine module, so the recorded voice and clicks go through expo-audio players.
    core = new PlayerCore((text) => Speech.speak(text, { rate: 0.95, pitch: 0.95 }), TTS_URL);
  }
  return core;
}

export function unlockAudio() {
  // Play through the silent switch, and lower (not stop) other apps' audio.
  setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers', allowsRecording: true }).catch(() => {});
  audio()?.unlock();
}
