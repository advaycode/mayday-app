import systemLines from '@/audio/systemLines.json';
import { PACE_LINES } from '@/cpr/pace';
import { suggestAnswer } from '@/sensors/analyze';
import type { getLive } from '@/sensors/live';

import { normalizeUtterance, unsureAboutBreathing } from './router';

/**
 * The voice assistant and the phone's sensors.
 *
 *   at "Breathing normally?"
 *     "check his breathing", "is she breathing?", "I can't tell"
 *         -> opens the phone check (it speaks its own steps). Where the
 *            platform wants a tap first (Safari on iPhone): "Tap Check with
 *            the phone." Where there is no phone check (a baby): "If you're
 *            not sure, treat it as not breathing."
 *     "what did the phone see?"
 *         -> the check's result again, the same way it was first said
 *   during CPR
 *     "how am I doing?", "am I too slow?", "is this fast enough?"
 *         -> from the pace the phone feels: good, faster, a little slower,
 *            keep pushing, or "I can't feel your pushes from here".
 *
 * Every reply is a fixed, pre-recorded line chosen by rules from what the
 * sensors measured; no model writes any of it. And the same rule as the
 * check itself: nothing here ever says someone is breathing normally. A
 * check that saw steady movement asks the rescuer to decide.
 */
export type SensorAsk = 'check_breathing' | 'breathing_result' | 'pace';

export type Where = {
  /** The current step's kind ('ask', 'do', 'cpr', ...), or null outside a protocol. */
  stepKind: string | null;
  /** The current step asks whether they are breathing normally. */
  breathingStep: boolean;
};

const PACE = /\b(how am i doing|how (is|am) (my|i) (doing|going|pace|speed|rhythm)|am i (doing|going|pushing) (it |this )?(right|ok|okay|well|good|fast enough|too fast|too slow|fast|slow)|my (pace|speed|rhythm|rate)|fast enough|too fast|too slow|right (speed|pace|rhythm)|is (this|that) (right|ok|okay|good|fast enough)|keeping up|(should|do) i (go|push) (faster|slower))\b/;
const RESULT = /\b(what (did|does|do) (it|the phone|the sensor|you) (see|say|show|find|think|get)|what (is|was) the (result|reading)|did (it|the phone|you) (work|see|find|detect)|what did you find)\b/;
const CHECK = /\b(check|measure|test|feel|look at)( \w+){0,3} (breath\w*|chest)\b|\b(use|try|with) the (phone|sensor)\b|\bphone check\b|\bcan you (check|tell|see|measure|feel)\b/;

export function sensorAsk(text: string, where: Where): SensorAsk | null {
  const t = normalizeUtterance(text);
  if (!t || !where.stepKind) return null;
  if (where.stepKind === 'cpr') return PACE.test(t) ? 'pace' : null;
  if (RESULT.test(t)) return 'breathing_result';
  if (where.breathingStep && (CHECK.test(t) || unsureAboutBreathing(t))) return 'check_breathing';
  return null;
}

const L = systemLines.lines;

export type SensorReply = { lines: string[]; openCheck?: boolean; why: string } | null;

/**
 * What to say. `openCheck` asks the caller to open the phone check (then
 * `afterOpen` gives the lines for how that went). Null: nothing sensor-ish
 * to say, so the question goes to the answer cards as usual.
 */
export function sensorReply(ask: SensorAsk, live: ReturnType<typeof getLive>, where: Where): SensorReply {
  if (ask === 'pace') {
    const p = live.pace;
    if (!p || p.status !== 'on') return { lines: [L.paceUnfelt], why: p ? `pace sensor ${p.status}` : 'no pace sensor' };
    if (!p.summary.trusted) return { lines: [L.paceUnfelt], why: 'compressions not clearly felt yet' };
    if (p.summary.advice) return { lines: [PACE_LINES[p.summary.advice]], why: `${p.summary.advice}${p.summary.perMin ? ` (${Math.round(p.summary.perMin)}/min)` : ''}` };
    return { lines: [L.paceGood], why: `${Math.round(p.summary.perMin ?? 0)}/min, in 100-120` };
  }
  if (ask === 'breathing_result') {
    const b = live.breath;
    if (!b) return where.breathingStep ? { lines: [], openCheck: true, why: 'no check yet: checking now' } : null;
    const r = b.reading;
    if (suggestAnswer(r) === 'abnormal') {
      const gasps = b.heard?.status === 'gasps' && r.status === 'irregular';
      return { lines: gasps ? [L.soundGasp, L.soundGaspNot, L.sensorNone] : [L.sensorNone], why: `last check: ${r.status} (${r.why})` };
    }
    // Steady movement: the rescuer decides. Never "breathing normally".
    if (r.status === 'regular') return { lines: [L.sensorMoving], why: `last check: chest moving ${Math.round(r.perMin ?? 0)}/min` };
    return { lines: [L.sensorUnsure], why: `last check: ${r.status}` };
  }
  return { lines: [], openCheck: true, why: 'checking with the phone' };
}

/** After asking to open the phone check: what to say, by how it went. */
export function afterOpen(result: 'started' | 'needs-tap' | 'unavailable'): string[] {
  return result === 'started' ? [] : result === 'needs-tap' ? [L.sensorTap] : [L.sensorDoubt];
}
