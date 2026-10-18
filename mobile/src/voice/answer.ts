import { protocols, sources, type Step } from '@/protocols';

import { normalizeUtterance } from './router';

/**
 * Offline answers to open questions ("should I move him?", "how deep do I
 * push?"). We search the protocol corpus, the same cited steps the app
 * already speaks, and if one clearly answers the question we say that step
 * again, with its source. If nothing clearly matches, we do not improvise:
 * we tell the rescuer to keep going and ask the dispatcher.
 *
 * Retrieval here is simple keyword overlap weighted by how rare each word is
 * (a small TF-IDF). The online path (proxy /ask) can rephrase an answer with
 * Claude, but only from passages this function retrieved.
 */

const STOP = new Set(
  'a an the i you he she they it is are was be do does did should can could would will to of in on at for with my his her their this that and or if what how when where why which who me we us them now just so not no yes'.split(' '),
);

type Doc = { protocolId: string; step: Step; terms: Map<string, number> };

function terms(text: string): string[] {
  return normalizeUtterance(text)
    .split(' ')
    .filter((w) => w.length > 2 && !STOP.has(w))
    .map((w) => w.replace(/(ing|ed|es|s)$/, ''));
}

const docs: Doc[] = Object.values(protocols).flatMap((p) =>
  p.steps.map((step) => {
    const text = [step.text, step.sub ?? '', ...step.say, step.quote ?? ''].join(' ');
    const counts = new Map<string, number>();
    for (const t of terms(text)) counts.set(t, (counts.get(t) ?? 0) + 1);
    return { protocolId: p.id, step, terms: counts };
  }),
);

const df = new Map<string, number>();
for (const d of docs) for (const t of d.terms.keys()) df.set(t, (df.get(t) ?? 0) + 1);
const idf = (t: string) => Math.log(1 + docs.length / (1 + (df.get(t) ?? 0)));

export type Answer =
  | { kind: 'step'; protocolId: string; step: Step; lines: string[]; source: string; score: number }
  | { kind: 'fallback'; lines: string[]; score: number };

export function retrieve(question: string, k = 3, prefer?: string) {
  const q = terms(question);
  return docs
    .map((d) => {
      let score = 0;
      for (const t of q) if (d.terms.has(t)) score += idf(t);
      if (prefer && d.protocolId === prefer) score *= 1.25;
      return { d, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

export function answer(question: string, currentProtocol: string | null, inCompressions: boolean): Answer {
  const [best] = retrieve(question, 1, currentProtocol ?? undefined);
  // Threshold chosen so that at least two meaningful words must match.
  if (best && best.score >= 4) {
    return {
      kind: 'step',
      protocolId: best.d.protocolId,
      step: best.d.step,
      lines: best.d.step.say,
      source: sources[best.d.step.source]?.title ?? best.d.step.source,
      score: best.score,
    };
  }
  return {
    kind: 'fallback',
    lines: [inCompressions ? 'Keep doing compressions. Tell the dispatcher that.' : "I'm not sure. Tell the dispatcher that."],
    score: best?.score ?? 0,
  };
}

/** Does this sound like a question rather than a report or a command? */
export function isQuestion(text: string): boolean {
  const t = normalizeUtterance(text);
  return /\?\s*$/.test(text) || /^(should|can|could|do|does|is|are|how|what|where|why|when|will|would|which|am i)\b/.test(t);
}
