import { normalizeUtterance } from './router';
import type { RouterOutput } from './routerSchema';

/**
 * Echo guard. Even with the phone's echo cancellation on, a loud speaker can
 * leak our own voice back into the microphone, and "seventeen, eighteen" from
 * the metronome must never be mistaken for the rescuer talking.
 *
 * Bag-of-words overlap alone is not enough: right after "Gasping is not
 * breathing. Is he breathing normally?", the most natural answer, "he's not
 * breathing", uses only words we just said. What tells them apart is order:
 * an echo repeats a stretch of what we said word for word; an answer
 * rearranges our words. So a transcript is
 *
 *   echo     made only of counting words, or mostly our words in our order
 *   suspect  mostly our words, rearranged: probably the rescuer, possibly
 *            our echo misheard. It may push toward more care, never less
 *            (useIncident strips anything reassuring from it).
 *   clear    the rescuer.
 */
const COUNT_WORDS = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'and',
]);

const wordsOf = (t: string) => normalizeUtterance(t).split(' ').filter(Boolean);

/** Share of the transcript's words that we said ourselves in the last few seconds (0 to 1). */
export function echoOverlap(transcript: string, recentlySaid: string[]): number {
  const words = wordsOf(transcript);
  if (!words.length) return 1;
  const said = new Set(recentlySaid.flatMap(wordsOf));
  return words.filter((w) => said.has(w)).length / words.length;
}

/**
 * How much of the transcript follows what we said in the same order (the
 * longest common subsequence of words), as a share of the transcript (0 to 1).
 * A misheard word in our own line costs one word; a rearranged answer costs more.
 */
export function echoInOrder(transcript: string, recentlySaid: string[]): number {
  const t = wordsOf(transcript);
  if (!t.length) return 1;
  const lcs = (s: string[]) => {
    let prev = new Array<number>(s.length + 1).fill(0);
    for (let i = 1; i <= t.length; i++) {
      const row = new Array<number>(s.length + 1).fill(0);
      for (let j = 1; j <= s.length; j++) row[j] = t[i - 1] === s[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1]);
      prev = row;
    }
    return prev[s.length];
  };
  // An echo is one stretch of our speech: up to three lines in a row. Over
  // everything we said, repeated lines would let any answer be pieced together.
  let best = 0;
  for (let i = 0; i < recentlySaid.length; i++) {
    for (let n = 1; n <= 3 && i + n <= recentlySaid.length; n++) best = Math.max(best, lcs(recentlySaid.slice(i, i + n).flatMap(wordsOf)));
  }
  return best / t.length;
}

export type EchoKind = 'echo' | 'suspect' | 'clear';

export function echoKind(transcript: string, recentlySaid: string[]): EchoKind {
  const words = wordsOf(transcript);
  if (!words.length) return 'echo';
  if (words.every((w) => COUNT_WORDS.has(w) || /^\d+$/.test(w))) return 'echo';
  // One word ("no", "yes", "done") is always an answer.
  if (words.length < 2 || echoOverlap(transcript, recentlySaid) < 0.7) return 'clear';
  return echoInOrder(transcript, recentlySaid) >= 0.8 ? 'echo' : 'suspect';
}

export function isEcho(transcript: string, recentlySaid: string[]): boolean {
  return echoKind(transcript, recentlySaid) === 'echo';
}

/**
 * Words still arriving. Shown on screen as they are heard, so a fragment of
 * our own voice ("tell" from "Tell me what's happening") must not appear:
 * a partial made only of words we just said is hidden until it is more.
 */
export function isEchoPartial(transcript: string, recentlySaid: string[]): boolean {
  return isEcho(transcript, recentlySaid) || echoOverlap(transcript, recentlySaid) === 1;
}

/**
 * A transcript that is mostly our own words rearranged ("suspect" above):
 * probably the rescuer, possibly our own voice misheard. It keeps anything
 * that leads to more care and loses anything that reassures.
 */
export function withoutReassurance(r: RouterOutput): RouterOutput {
  const slots = { ...r.slots };
  if (slots.breathing === 'normal') delete slots.breathing;
  if (slots.conscious === 'true') delete slots.conscious;
  const intent = r.intent && ['yes', 'breathing', 'responsive', 'object_out'].includes(r.intent) ? null : r.intent;
  return { ...r, slots, intent };
}
