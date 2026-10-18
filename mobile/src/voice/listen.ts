import { Platform } from 'react-native';

/**
 * Speech recognition, wrapped so the rest of the app never has to care
 * which engine is underneath:
 *
 *   iPhone / Android   the phone's own recogniser, on-device when the phone
 *                      supports it, so it keeps working with no signal
 *   web preview        the browser's Web Speech API
 *   Expo Go            not available (native module missing): voice input is
 *                      off and every step still works by touch
 *
 * The audio session is set to voice-chat mode with voice processing on. That
 * turns on the phone's echo cancellation, which subtracts our own speaker
 * output (the metronome and the coaching voice) from the microphone signal
 * before recognition. echo.ts is the second line of defence.
 */

export type ListenState = 'off' | 'starting' | 'listening' | 'unavailable' | 'denied' | 'interrupted';

type Handlers = {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  /** Microphone level, 0..1. */
  onLevel?: (level: number) => void;
  onState?: (state: ListenState) => void;
};

type Sub = { remove(): void };
type Module = {
  start(o: Record<string, unknown>): void;
  abort(): void;
  stop(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean }>;
  isRecognitionAvailable(): boolean;
  supportsOnDeviceRecognition(): boolean;
  addListener(event: string, fn: (e: any) => void): Sub;
};

const HINTS = ['AED', 'CPR', 'not breathing', 'choking', 'bleeding', 'tourniquet', 'naloxone', 'Narcan', 'overdose', 'stroke', 'paramedics'];

export function createListener(h: Handlers) {
  let mod: Module | null = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require('expo-speech-recognition').ExpoSpeechRecognitionModule as Module;
    if (!mod || (Platform.OS === 'web' && !mod.isRecognitionAvailable())) mod = null;
  } catch {
    mod = null;
  }

  let wanted = false;
  let subs: Sub[] = [];
  let restartTimer: ReturnType<typeof setTimeout> | undefined;

  const setState = (s: ListenState) => h.onState?.(s);

  function begin() {
    if (!mod || !wanted) return;
    setState('starting');
    let onDevice = false;
    try {
      onDevice = mod.supportsOnDeviceRecognition();
    } catch {
      onDevice = false;
    }
    try {
      mod.start({
        lang: 'en-US',
        interimResults: true,
        continuous: true,
        addsPunctuation: false,
        contextualStrings: HINTS,
        requiresOnDeviceRecognition: onDevice,
        iosVoiceProcessingEnabled: true,
        iosCategory: { category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth', 'mixWithOthers'], mode: 'voiceChat' },
        volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
      });
    } catch {
      setState('unavailable');
    }
  }

  function attach() {
    if (!mod || subs.length) return;
    subs = [
      mod.addListener('start', () => setState('listening')),
      mod.addListener('result', (e: { isFinal: boolean; results: { transcript: string }[] }) => {
        const text = e.results?.[0]?.transcript?.trim() ?? '';
        if (!text) return;
        if (e.isFinal) h.onFinal(text);
        else h.onPartial?.(text);
      }),
      mod.addListener('volumechange', (e: { value: number }) => h.onLevel?.(Math.max(0, Math.min(1, (e.value + 2) / 12)))),
      mod.addListener('end', () => {
        // Recognisers stop after a pause. While we still want to listen, start again.
        if (wanted) restartTimer = setTimeout(begin, 300);
        else setState('off');
      }),
      mod.addListener('error', (e: { error: string }) => {
        if (e.error === 'interrupted') {
          // iOS: the audio session was taken, usually by a phone call. We are deaf
          // until it ends, and we must say so rather than pretend to listen.
          setState('interrupted');
        } else if (e.error === 'not-allowed') {
          wanted = false;
          setState('denied');
        } else if (e.error === 'no-speech' || e.error === 'speech-timeout' || e.error === 'aborted') {
          // Normal: silence. 'end' follows and restarts us.
        } else if (e.error === 'language-not-supported' || e.error === 'service-not-allowed') {
          wanted = false;
          setState('unavailable');
        }
      }),
    ];
  }

  return {
    available: mod !== null,
    async start(): Promise<ListenState> {
      if (!mod) {
        setState('unavailable');
        return 'unavailable';
      }
      try {
        const perm = await mod.requestPermissionsAsync();
        if (!perm.granted) {
          setState('denied');
          return 'denied';
        }
      } catch {
        setState('unavailable');
        return 'unavailable';
      }
      attach();
      wanted = true;
      begin();
      return 'starting';
    },
    stop() {
      wanted = false;
      if (restartTimer) clearTimeout(restartTimer);
      try {
        mod?.abort();
      } catch {
        // already stopped
      }
      subs.forEach((s) => s.remove());
      subs = [];
      setState('off');
    },
  };
}
