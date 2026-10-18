import type { Slots } from '@/protocols/engine';
import { protocols } from '@/protocols';

/**
 * The incident log: what happened and when, written as it happens, for the
 * paramedics. The one-line summary is built from facts with a template, not
 * by a model, so it can never say something that did not happen.
 */
export type LogEntry = { at: number; text: string };

export function clock(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

export function clockWithSeconds(ms: number): string {
  const d = new Date(ms);
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

export function elapsed(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const AGE: Record<string, string> = { adult: 'Adult', child: 'Child', infant: 'Infant' };

/** "Adult, unresponsive, not breathing normally. CPR started 1:52 PM. AED arrived 1:58 PM." */
export function summaryLine(log: LogEntry[], slots: Slots, protocolId: string | null): string {
  const facts: string[] = [];
  facts.push(AGE[slots.age_group ?? ''] ?? 'Adult (age not given)');
  if (slots.conscious === 'false') facts.push('unresponsive');
  if (slots.conscious === 'true') facts.push('responsive');
  if (slots.breathing === 'abnormal') facts.push('not breathing normally');
  if (slots.breathing === 'normal') facts.push('breathing');
  if (slots.severe_fbao === 'true') facts.push('choking, cannot breathe');
  if (slots.wound_site) facts.push(`bleeding from ${{ limb: 'arm or leg', junctional: 'neck, armpit or groin', torso: 'chest or belly' }[slots.wound_site]}`);
  if (slots.burn_severity === 'major') facts.push('major burn');

  const firstOf = (re: RegExp) => log.find((e) => re.test(e.text));
  const events: string[] = [];
  const cpr = firstOf(/^Compressions started/);
  if (cpr) events.push(`CPR started ${clock(cpr.at)}`);
  const aed = firstOf(/^AED arrived/);
  if (aed) events.push(`AED arrived ${clock(aed.at)}`);
  const tq = firstOf(/^Tourniquet applied/);
  if (tq) events.push(`tourniquet on ${clock(tq.at)}`);
  const nal = log.filter((e) => /^Naloxone/.test(e.text));
  if (nal.length) events.push(`naloxone x${nal.length}, first ${clock(nal[0].at)}`);
  const stroke = firstOf(/^Stroke signs present/);
  if (stroke) events.push(`stroke signs at ${clock(stroke.at)}`);
  if (!events.length && protocolId) {
    const started = firstOf(/^Started /) ?? log[0];
    const title = protocols[protocolId]?.title ?? protocolId;
    events.push(`${title} steps begun ${clock(started?.at ?? Date.now())}${protocolId.startsWith('cpr') ? ', no compressions yet' : ''}`);
  }

  const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return [facts.join(', '), ...events.map(sentence)].join('. ') + '.';
}
