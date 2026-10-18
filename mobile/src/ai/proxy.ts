import { z } from 'zod';

import { PROXY_URL } from '@/config';

/**
 * Calls to the model proxy (proxy/ at the repo root). Every call has a
 * deadline, every answer is parsed with a schema, and every failure returns
 * null so the caller falls back to the offline path. Nothing here is on the
 * critical path of a protocol.
 */

export const online = () => PROXY_URL.length > 0;

async function post<T>(path: string, body: unknown, schema: z.ZodType<T>, deadlineMs: number): Promise<T | null> {
  if (!online()) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const res = await fetch(`${PROXY_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const parsed = schema.safeParse(await res.json());
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const AskAnswer = z.object({ grounded: z.boolean(), cite: z.array(z.string()), say: z.array(z.string()) });
export type AskAnswer = z.infer<typeof AskAnswer>;

/** Ask Claude to answer from these passages only. Null = no answer in time; use the offline answer. */
export function askModel(question: string, passages: { id: string; text: string; source: string }[], inCompressions: boolean) {
  return post('/ask', { question, passages, in_compressions: inCompressions }, AskAnswer, 4000);
}

const ScanResult = z.object({
  observation: z.string(),
  suggested_protocol: z.enum(['burns', 'bleeding']).nullable(),
  severity_hint: z.enum(['major', 'minor']).nullable(),
  confidence: z.number(),
});
export type ScanResult = z.infer<typeof ScanResult>;

export function scanPhoto(imageBase64: string, mediaType = 'image/jpeg') {
  return post('/scan', { image_b64: imageBase64, media_type: mediaType }, ScanResult, 15000);
}
