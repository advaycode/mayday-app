import { Platform } from 'react-native';

import { audio } from '@/audio/engine';

import { frameFeatures, type SoundFrame } from './sounds';

/**
 * The microphone, as sound frames for sounds.ts: about 50 a second, each the
 * energy and flatness of 100-4000 Hz over the last 1024 samples.
 *
 * Browser only for now (the iPhone home-screen app, Safari and Chrome): Web
 * Audio's analyser does the Fourier transform. Echo cancellation stays on (it
 * removes our own voice), noise suppression and automatic gain stay off
 * (they would remove or level the very sounds we listen for). Each frame is
 * marked while the app is speaking, so our voice is skipped as well.
 *
 * On a phone app build this reports unavailable; the breathing check then
 * runs on motion alone, as before.
 */
export type Mic = {
  /** Call synchronously inside the tap that starts the check: browsers only start audio inside one. */
  prime(): void;
  start(onFrame: (f: SoundFrame) => void): Promise<boolean>;
  stop(): void;
};

type AudioCtx = AudioContext;

export function mic(): Mic {
  let ctx: AudioCtx | null = null;
  let stream: MediaStream | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const web = Platform.OS === 'web' && typeof window !== 'undefined';
  return {
    prime() {
      if (!web || ctx) return;
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      try {
        ctx = new Ctor();
        void ctx.resume();
      } catch {
        ctx = null;
      }
    },
    async start(onFrame) {
      if (!web || !navigator.mediaDevices?.getUserMedia) return false;
      this.prime();
      if (!ctx) return false;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false } });
      } catch {
        return false;
      }
      try {
        const src = ctx.createMediaStreamSource(stream);
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        an.smoothingTimeConstant = 0;
        src.connect(an);
        const db = new Float32Array(an.frequencyBinCount);
        const power = new Float64Array(an.frequencyBinCount);
        const binHz = ctx.sampleRate / an.fftSize;
        const c = ctx;
        timer = setInterval(() => {
          an.getFloatFrequencyData(db);
          for (let i = 0; i < db.length; i++) power[i] = Number.isFinite(db[i]) ? 10 ** (db[i] / 10) : 0;
          onFrame({ t: c.currentTime, ...frameFeatures(power, binHz), own: audio()?.isSpeaking() ?? false });
        }, 20);
        return true;
      } catch {
        // Whatever failed, the check carries on with motion alone.
        this.stop();
        return false;
      }
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
      void ctx?.close();
      ctx = null;
    },
  };
}
