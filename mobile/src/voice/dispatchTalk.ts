import systemLines from '@/audio/systemLines.json';
import type { Fix } from '@/location/location';

import { normalizeUtterance } from './router';

/**
 * Talking about 911 by voice. Mayday never calls (and says so); what it can
 * do is tell the rescuer what to say to the call-taker: where they are and
 * what happened, the same facts as the 911 card, which opens at the same time.
 *
 *   "call 911", "can you call an ambulance"   -> I can't call, call on your phone, then the script
 *   "what do I tell 911", "what do I say"     -> the script
 *   "where am I", "what's my address"         -> the address
 */
export type DispatchAsk = 'call' | 'script' | 'where';

const has = (t: string, re: RegExp) => re.test(t);
const N911 = '(911|nine one one|nine eleven|112|one one two|767|emergency services|the dispatcher|dispatch|an ambulance|the ambulance|ambulance|for help|the police|police)';

export function dispatchAsk(raw: string): DispatchAsk | null {
  const t = normalizeUtterance(raw);
  if (!t) return null;
  // "The ambulance is here" is the paramedic handoff, not this.
  if (has(t, /\b(here|arrived|is coming|are coming|on (its|their) way)\b/) && !has(t, /\bwhere\b/)) return null;
  if (has(t, new RegExp(`\\b(call|dial|phone|ring|text) ${N911}\\b`)) || has(t, /\b(did|can|could|will|would) you call\b/)) return 'call';
  if (has(t, /\bwhat (do|should|can) i (tell|say)\b/) || has(t, new RegExp(`\\b(tell|say to|ask) ${N911}\\b`)) || has(t, /\bwhat (does|do) (911|the dispatcher|dispatch) (need|want)\b/)) return 'script';
  if (has(t, /\b(where am i|where are we|my address|our address|the address|my location|our location|what street|which street)\b/)) return 'where';
  return null;
}

const L = systemLines.lines;

/** What to say, as lines to speak. The address and summary are spoken live (no recording can know them). */
export function dispatchLines(ask: DispatchAsk, fix: Fix | null, summary: string): string[] {
  if (ask === 'where') return fix?.address ? [`You're at ${fix.address}.`] : [L.noAddress];
  // "Adult (age not given)" reads well on the card; out loud the brackets are noise.
  const script = [L.tellThem, fix?.address ? `${fix.address}.` : L.noAddress, summary.replace(/\s*\([^)]*\)/g, '')];
  return ask === 'call' ? [L.cantCall, ...script] : script;
}
