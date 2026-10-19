import { capabilities } from '@/ai/proxy';
import { PROXY_URL } from '@/config';
import type { Slots } from '@/protocols/engine';

import { RouterOutput, type RouterOutput as Output } from './routerSchema';

/**
 * The model router: a second opinion from a fast language model (Groq,
 * behind our proxy) for utterances the keyword router could not place.
 *
 * Rules it lives by:
 *   - It is only asked when the keyword router is unsure. A life threat the
 *     keywords recognise has already started its protocol.
 *   - It answers in the RouterOutput JSON shape and nothing else. The output
 *     is parsed with zod; if parsing fails, the answer is discarded.
 *   - It has 1.2 seconds. After that we carry on without it.
 *   - No proxy configured (or no signal) means it is simply never asked.
 */
const DEADLINE_MS = 1200;

export async function routeWithModel(transcript: string, context: { phase: string; slots: Slots }): Promise<Output | null> {
  if (!PROXY_URL || !(await capabilities()).groq) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEADLINE_MS);
  try {
    const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript, context }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const parsed = RouterOutput.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
