import systemLines from '@/audio/systemLines.json';
import { sources } from '@/protocols';

import data from './answers.json';
import { normalizeUtterance } from './router';

/**
 * Offline answers to open questions ("should I move him?", "how deep do I
 * push?").
 *
 * We match the question against hand-written answer cards (answers.json):
 * each card lists the ways people ask it, a short spoken answer, and its
 * source. Words are weighted by how rare they are across all the cards
 * (IDF), so "bra" counts for much more than "take", and "take her bra off"
 * can't match "take the tourniquet off". A card only applies inside the
 * protocols it names, so "how deep" gets the child answer during child CPR.
 *
 * If nothing clearly matches, we do not improvise. We say "I don't know.
 * Keep doing compressions." The online path (proxy /ask) can
 * rephrase, but only from the cards this file selects.
 */

export type Card = {
  id: string;
  protocols: string[];
  ask: string[];
  say: string[];
  source: string;
  quote: string | null;
  verified: boolean;
  note?: string;
  /**
   * Quick guidance for an emergency with no protocol of its own (a seizure, an
   * allergic reaction): offered from Talk to Mayday before any protocol starts,
   * never as an answer in the middle of one.
   */
  intakeOnly?: boolean;
};

export const cards = data.cards as Card[];

const STOP = new Set(
  'a an the i you he she they it is are was be do does did should can could would will to of in on at for with my his her their this that and or if what how when where why which who me we us them now just so not no yes him have has had there here off up about any some get go ok okay'.split(' '),
);

function stem(w: string) {
  return w.replace(/(ing|ed|es|s)$/, '') || w;
}

export function terms(text: string): string[] {
  return normalizeUtterance(text)
    .split(' ')
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

// How rare each word is across every way of asking every card.
const df = new Map<string, number>();
const phrases = cards.flatMap((c) => c.ask.map((a) => new Set(terms(a))));
for (const p of phrases) for (const t of p) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + phrases.length / (1 + (df.get(t) ?? 0)));

/**
 * How well a question matches one way of asking a card, 0 to 1. Mostly: how
 * much of the card's phrasing (weighted by rarity) appears in the question.
 * A little: how much of the question the card explains. So extra words in a
 * real question ("is it safe to go near the car") cost little, but a single
 * shared common word ("take") is never enough.
 */
function similarity(q: Set<string>, a: Set<string>): number {
  let shared = 0;
  let inA = 0;
  let inQ = 0;
  for (const t of a) {
    inA += idf(t);
    if (q.has(t)) shared += idf(t);
  }
  for (const t of q) inQ += idf(t);
  if (!inA || !inQ) return 0;
  return 0.7 * (shared / inA) + 0.3 * (shared / inQ);
}

const inScope = (card: Card, protocolId: string | null) =>
  card.intakeOnly ? protocolId === null : card.protocols.length === 0 || (protocolId !== null && card.protocols.some((p) => protocolId.startsWith(p)));

/** Quick guidance for something with no protocol ("he's having a seizure"), or null. */
export function guideFor(text: string): Card | null {
  const [best] = rank(text, null);
  return best && best.card.intakeOnly && best.score >= ANSWER_THRESHOLD ? best.card : null;
}

/** Cards that fit this question, best first. */
export function rank(question: string, protocolId: string | null) {
  const q = new Set(terms(question));
  if (!q.size) return [];
  // A tie goes to the card asked the same way: "what is an AED" and "should I
  // get the AED" share every word that counts; "what" and "should" do not.
  const lead = (s: string) => normalizeUtterance(s).split(' ')[0] ?? '';
  const asked = lead(question);
  return cards
    .filter((c) => inScope(c, protocolId))
    .map((card) => {
      const scored = card.ask.map((a) => ({ score: similarity(q, new Set(terms(a))), same: lead(a) === asked }));
      const score = Math.max(...scored.map((s) => s.score));
      return { card, score, same: scored.some((s) => s.score === score && s.same) };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.same) - Number(a.same));
}

export const ANSWER_THRESHOLD = 0.6;

export type Answer =
  | { kind: 'card'; card: Card; lines: string[]; source: string; score: number }
  | { kind: 'fallback'; lines: string[]; score: number };

export function answer(question: string, protocolId: string | null, inCompressions: boolean): Answer {
  const [best] = rank(question, protocolId);
  if (best && best.score >= ANSWER_THRESHOLD) {
    return {
      kind: 'card',
      card: best.card,
      lines: best.card.say,
      source: sources[best.card.source]?.title ?? best.card.source,
      score: best.score,
    };
  }
  return {
    kind: 'fallback',
    lines: [inCompressions ? systemLines.lines.groundFallback : systemLines.lines.groundFallbackGeneral],
    score: best?.score ?? 0,
  };
}

/** Passages for the online path: the best few cards, as citable text. */
export function passagesFor(question: string, protocolId: string | null) {
  return rank(question, protocolId)
    .filter((r) => r.score > 0.15)
    .slice(0, 3)
    .map(({ card }) => ({
      id: card.id,
      text: `${card.ask[0]}? ${card.say.join(' ')}`,
      source: sources[card.source]?.title ?? card.source,
    }));
}

/** Does this sound like a question rather than a report or a command? */
export function isQuestion(text: string): boolean {
  const t = normalizeUtterance(text);
  return /\?\s*$/.test(text) || /^(should|can|could|do|does|is|are|how|what|where|why|when|will|would|which|am i)\b/.test(t);
}
