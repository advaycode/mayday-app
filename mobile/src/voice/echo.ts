import { normalizeUtterance } from './router';

/**
 * Echo guard. Even with the phone's echo cancellation on, a loud speaker can
 * leak our own voice back into the microphone, and "seventeen, eighteen" from
 * the metronome must never be mistaken for the rescuer talking.
 *
 * A transcript is treated as our own echo if:
 *   - it is made only of counting words, or
 *   - most of its words appear in something we said in the last few seconds.
 */
const COUNT_WORDS = new Set([
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'and',
]);

export function isEcho(transcript: string, recentlySaid: string[]): boolean {
  const words = normalizeUtterance(transcript).split(' ').filter(Boolean);
  if (!words.length) return true;
  if (words.every((w) => COUNT_WORDS.has(w) || /^\d+$/.test(w))) return true;

  const said = new Set(recentlySaid.flatMap((l) => normalizeUtterance(l).split(' ')));
  const overlap = words.filter((w) => said.has(w)).length / words.length;
  return words.length >= 2 && overlap >= 0.7;
}
