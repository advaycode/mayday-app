import type { PaceSummary } from '@/cpr/pace';
import type { PaceStatus } from '@/cpr/usePaceSensor';

import type { BreathReading } from './analyze';
import type { SoundReading } from './sounds';

/**
 * What the phone's sensors know right now, for the voice assistant to answer
 * from (voice/sensorTalk.ts): the last breathing check, the CPR pace, and a
 * way to start the phone check by voice. The screens that own the sensors
 * write here; nothing here measures anything.
 */
export type PhoneCheckStart = 'started' | 'needs-tap' | 'unavailable';

type Live = {
  breath: { reading: BreathReading; heard: SoundReading | null; at: number } | null;
  pace: { status: PaceStatus; summary: PaceSummary; at: number } | null;
  phoneCheck: (() => PhoneCheckStart) | null;
};

const live: Live = { breath: null, pace: null, phoneCheck: null };

export const getLive = (): Readonly<Live> => live;

export function setBreath(reading: BreathReading, heard: SoundReading | null) {
  live.breath = { reading, heard, at: Date.now() };
}

export function setPace(status: PaceStatus, summary: PaceSummary) {
  live.pace = { status, summary, at: Date.now() };
}

export function clearPace() {
  live.pace = null;
}

/** The emergency screen registers how to open the phone check (null when it cannot, e.g. a baby). */
export function setPhoneCheck(fn: Live['phoneCheck']) {
  live.phoneCheck = fn;
}

/** A new emergency: forget the last one's readings. */
export function resetLive() {
  live.breath = null;
  live.pace = null;
}
