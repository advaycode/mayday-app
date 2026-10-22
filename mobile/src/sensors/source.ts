import { Platform } from 'react-native';

import { G, type Sample } from './analyze';
import { simulate, type Scenario } from './sim';

/**
 * Where samples come from: the phone's accelerometer, or the simulated
 * person when there is no accelerometer (the desktop phone window) or when
 * someone wants to see a scenario. The screen always says which.
 */
export type SourceKind = 'phone' | 'simulated';

export type Source = {
  kind: SourceKind;
  /** Resolves false if the sensor is missing or permission was refused. Call from a tap: iOS asks permission only then. */
  start(onSample: (s: Sample) => void): Promise<boolean>;
  stop(): void;
};

type MotionEvent = {
  accelerationIncludingGravity: { x: number | null; y: number | null; z: number | null } | null;
  rotationRate: { alpha: number | null; beta: number | null; gamma: number | null } | null;
  timeStamp: number;
};
type MotionPermission = { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * The browser's motion events (the iPhone home-screen app and Safari): the
 * accelerometer and, in the same event, the gyroscope's rotation rates in
 * degrees a second. Browsers disagree on which of alpha, beta and gamma is
 * which axis; the analysis works that out from the data (`alignGyro`).
 */
function webSource(): Source {
  let handler: ((e: MotionEvent) => void) | null = null;
  return {
    kind: 'phone',
    async start(onSample) {
      if (typeof window === 'undefined' || typeof (window as unknown as { DeviceMotionEvent?: unknown }).DeviceMotionEvent === 'undefined') return false;
      // iOS 13+: must be asked inside the tap that started this.
      const ask = (window as unknown as { DeviceMotionEvent: MotionPermission }).DeviceMotionEvent.requestPermission;
      if (ask) {
        try {
          if ((await ask()) !== 'granted') return false;
        } catch {
          return false;
        }
      }
      // Desktop browsers define the event but never fire it with data: wait for a real reading.
      return new Promise<boolean>((resolve) => {
        let got = false;
        handler = (e) => {
          const a = e.accelerationIncludingGravity;
          if (a?.x == null || a.y == null || a.z == null) return;
          if (!got) {
            got = true;
            resolve(true);
          }
          const r = e.rotationRate;
          const rot: [number, number, number] | undefined = r && r.alpha != null && r.beta != null && r.gamma != null ? [r.alpha, r.beta, r.gamma] : undefined;
          onSample({ t: e.timeStamp / 1000, x: a.x, y: a.y, z: a.z, rot });
        };
        window.addEventListener('devicemotion', handler as unknown as EventListener);
        setTimeout(() => {
          if (!got) {
            if (handler) window.removeEventListener('devicemotion', handler as unknown as EventListener);
            handler = null;
            resolve(false);
          }
        }, 1500);
      });
    },
    stop() {
      if (handler) window.removeEventListener('devicemotion', handler as unknown as EventListener);
      handler = null;
    },
  };
}

/**
 * expo-sensors on iPhone and Android, 100 samples a second. DeviceMotion gives
 * the accelerometer and the gyroscope together, on one clock; a phone without
 * a gyroscope falls back to the accelerometer alone.
 */
function nativeSource(): Source {
  let sub: { remove(): void } | null = null;
  return {
    kind: 'phone',
    async start(onSample) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Accelerometer, DeviceMotion } = require('expo-sensors') as typeof import('expo-sensors');
        if (await DeviceMotion.isAvailableAsync()) {
          DeviceMotion.setUpdateInterval(10);
          sub = DeviceMotion.addListener((m) => {
            const a = m.accelerationIncludingGravity;
            const r = m.rotationRate;
            const t = a.timestamp ?? performance.now() / 1000;
            onSample({ t, x: a.x, y: a.y, z: a.z, rot: r ? [r.alpha, r.beta, r.gamma] : undefined });
          });
          return true;
        }
        if (!(await Accelerometer.isAvailableAsync())) return false;
        Accelerometer.setUpdateInterval(10);
        sub = Accelerometer.addListener((m) => onSample({ t: m.timestamp, x: m.x * G, y: m.y * G, z: m.z * G }));
        return true;
      } catch {
        return false;
      }
    },
    stop() {
      sub?.remove();
      sub = null;
    },
  };
}

export function phoneSource(): Source {
  return Platform.OS === 'web' ? webSource() : nativeSource();
}

/**
 * The simulated person (see sim.ts), played back in real time at 60 samples
 * a second like a browser would deliver them. Change `scenario` at any time.
 */
export function simulatedSource(initial: Scenario): Source & { scenario: Scenario; setScenario(s: Scenario): void } {
  let timer: ReturnType<typeof setInterval> | null = null;
  let emit: ((s: Sample) => void) | null = null;
  let samples: Sample[] = [];
  let idx = 0;
  let t0 = 0;
  let offset = 0;
  // A different simulated person each run, so "Measure again" is not a replay.
  let seed = 1 + (Date.now() % 9973);
  const src = {
    kind: 'simulated' as const,
    scenario: initial,
    setScenario(s: Scenario) {
      src.scenario = s;
      load();
    },
    async start(onSample: (s: Sample) => void) {
      emit = onSample;
      t0 = Date.now() / 1000;
      load();
      timer = setInterval(tick, 20);
      return true;
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
      emit = null;
    },
  };
  // Three fresh simulated minutes, continuing the clock from now. The body and
  // the sensor offset stay the same from one to the next, so the level does not jump.
  function load() {
    const now = Date.now() / 1000 - t0;
    samples = simulate({ scenario: src.scenario, seconds: 180, seed: seed++, fs: 60, jitterMs: 2, dropRate: 0.01, pitch0: 3.2, roll0: -1.4, biasMg: 0 }).samples;
    idx = 0;
    offset = now;
  }
  function tick() {
    const now = Date.now() / 1000 - t0;
    while (idx < samples.length && samples[idx].t + offset <= now) {
      const s = samples[idx++];
      emit?.({ ...s, t: s.t + offset });
    }
    if (idx >= samples.length) load();
  }
  return src;
}
