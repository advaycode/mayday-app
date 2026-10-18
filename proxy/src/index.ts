/**
 * Mayday model proxy.
 *
 * The phone never holds an API key. It calls this small server, which holds
 * the keys as secrets, rate-limits each caller, checks every request, and
 * checks every model answer against a schema before passing it on. Runs as
 * a Cloudflare Worker in production (`wrangler deploy`) and as plain Node for
 * local development (`npm run dev`, see dev.ts).
 *
 *   POST /route   Groq, fast: what does this sentence mean? -> protocol id, facts, fixed question id
 *   POST /ask     Claude: answer an open question using ONLY the cited passages the app sends
 *   POST /scan    Claude vision: hedged description of a burn or wound photo -> which protocol fits
 *
 * None of these can make the app say a medical instruction that is not in its
 * own cited protocol library: /route returns ids from fixed lists, /ask must
 * cite the passages it was given (and is rejected if it does not), and /scan
 * only picks between two protocols and describes what it sees.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';

export interface Env {
  ANTHROPIC_API_KEY?: string;
  GROQ_API_KEY?: string;
  /** Override the Claude model; defaults to claude-opus-5-5. */
  CLAUDE_MODEL?: string;
  /** Override the Groq model; defaults to llama-3.1-8b-instant. */
  GROQ_MODEL?: string;
  /** Comma-separated origins allowed to call from a browser (the web preview). */
  ALLOWED_ORIGINS?: string;
}

const CLAUDE_MODEL = 'claude-opus-5-5';
const GROQ_MODEL = 'llama-3.1-8b-instant';

// --- Fixed vocabularies (mirror mobile/src/voice/routerSchema.ts) ------------

const PROTOCOLS = ['cpr_adult', 'cpr_child', 'cpr_infant', 'choking', 'choking_infant', 'bleeding', 'burns', 'stroke', 'opioid_overdose', 'recovery_position'] as const;
const INTENTS = ['yes', 'no', 'next', 'repeat', 'what_now', 'alone', 'aed_here', 'vomiting', 'tired', 'breathing', 'not_breathing', 'responsive', 'unresponsive', 'coughing', 'choking', 'object_out', 'worse', 'still_bleeding', 'limb', 'junctional', 'torso', 'major', 'minor', 'pregnant', 'ems_here'] as const;

const RouterOutput = z.object({
  protocol_id: z.enum(PROTOCOLS).nullable(),
  intent: z.enum(INTENTS).nullable(),
  slots: z
    .object({
      age_group: z.enum(['adult', 'child', 'infant']),
      conscious: z.enum(['true', 'false']),
      breathing: z.enum(['normal', 'abnormal']),
      severe_fbao: z.enum(['true', 'false']),
      wound_site: z.enum(['limb', 'junctional', 'torso']),
      burn_severity: z.enum(['major', 'minor']),
      has_naloxone: z.enum(['true', 'false']),
      others_present: z.enum(['true', 'false']),
    })
    .partial(),
  confidence: z.number().min(0).max(1),
  next_question: z.enum(['age', 'what', 'breathing']).nullable(),
  urgent: z.boolean(),
});

const AskInput = z.object({
  question: z.string().min(1).max(300),
  passages: z
    .array(z.object({ id: z.string().max(80), text: z.string().max(1200), source: z.string().max(200) }))
    .min(1)
    .max(5),
  in_compressions: z.boolean().default(false),
});
const AskOutput = z.object({
  grounded: z.boolean(),
  cite: z.array(z.string()),
  say: z.array(z.string()),
});

const ScanInput = z.object({
  image_b64: z.string().min(100).max(7_000_000),
  media_type: z.enum(['image/jpeg', 'image/png', 'image/webp']).default('image/jpeg'),
});
const ScanOutput = z.object({
  observation: z.string(),
  suggested_protocol: z.enum(['burns', 'bleeding']).nullable(),
  severity_hint: z.enum(['major', 'minor']).nullable(),
  confidence: z.number().min(0).max(1),
});

// --- Rate limiting -------------------------------------------------------------
// A token bucket per caller IP, per server instance: 20 requests, refilling at
// one every 3 seconds. A Worker instance is short-lived, so in production add
// Cloudflare's rate limiting rules in front of this as well.

const buckets = new Map<string, { tokens: number; at: number }>();
function allow(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: 20, at: now };
  b.tokens = Math.min(20, b.tokens + (now - b.at) / 3000);
  b.at = now;
  if (b.tokens < 1) {
    buckets.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  if (buckets.size > 5000) buckets.clear();
  return true;
}

// --- Helpers -----------------------------------------------------------------------

function cors(env: Env, req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? '';
  const allowed = (env.ALLOWED_ORIGINS ?? 'http://localhost:8742,http://localhost:8081').split(',').map((s) => s.trim());
  return {
    'access-control-allow-origin': allowed.includes(origin) ? origin : allowed[0],
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type',
    vary: 'origin',
  };
}

function json(body: unknown, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

// --- /route (Groq) ---------------------------------------------------------------

const ROUTE_SYSTEM = `You classify one sentence said by a bystander during a medical emergency.
Reply with JSON only, exactly this shape:
{"protocol_id": one of ${JSON.stringify(PROTOCOLS)} or null,
 "intent": one of ${JSON.stringify(INTENTS)} or null,
 "slots": {any of "age_group":"adult|child|infant", "conscious":"true|false", "breathing":"normal|abnormal", "severe_fbao":"true|false", "wound_site":"limb|junctional|torso", "burn_severity":"major|minor", "has_naloxone":"true|false", "others_present":"true|false"},
 "confidence": 0 to 1,
 "next_question": "age" | "what" | "breathing" | null,
 "urgent": true if someone may be not breathing, unresponsive, choking, or bleeding heavily}
Rules: only include slots the sentence actually states. Gasping or barely breathing is "abnormal". A baby under one year is "infant"; ages 1 to 12 are "child". If unsure, set protocol_id null, confidence below 0.5, and pick the next_question that would help most. Never write advice or instructions.`;

async function route(body: unknown, env: Env) {
  const input = z.object({ transcript: z.string().min(1).max(400), context: z.unknown().optional() }).parse(body);
  if (!env.GROQ_API_KEY) return { status: 503, body: { error: 'GROQ_API_KEY not configured' } };
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${env.GROQ_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.GROQ_MODEL ?? GROQ_MODEL,
      temperature: 0,
      max_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ROUTE_SYSTEM },
        { role: 'user', content: input.transcript },
      ],
    }),
  });
  if (!res.ok) return { status: 502, body: { error: `groq ${res.status}` } };
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  let parsed: unknown;
  try {
    parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '');
  } catch {
    return { status: 502, body: { error: 'model returned invalid JSON' } };
  }
  const out = RouterOutput.safeParse(parsed);
  // Anything that does not fit the schema is discarded, not repaired.
  return out.success ? { status: 200, body: out.data } : { status: 502, body: { error: 'model output failed validation' } };
}

// --- /ask (Claude, grounded) ---------------------------------------------------------

const ASK_SYSTEM = `You are the voice of Mayday, an app that coaches a bystander through a medical emergency while help is on the way.
You are given a question from the rescuer and numbered passages from the app's own first-aid protocols, each from a cited guideline.
Answer ONLY with what the passages say. Do not add facts, doses, numbers, or steps that are not in a passage. Do not diagnose.
Reply as JSON: {"grounded": boolean, "cite": [ids of the passages you used], "say": [one or two short spoken sentences, 12 words or fewer each, calm and plain]}.
If the passages do not clearly answer the question, reply {"grounded": false, "cite": [], "say": []}. That is the right answer when unsure.`;

async function ask(body: unknown, env: Env, client: Anthropic) {
  const input = AskInput.parse(body);
  const passages = input.passages.map((p) => `[${p.id}] (${p.source}) ${p.text}`).join('\n');
  const response = await client.beta.messages.parse({
    model: env.CLAUDE_MODEL ?? CLAUDE_MODEL,
    max_tokens: 1024,
    // Effort low: this answers a short question during an emergency; speed matters most.
    output_config: { effort: 'low', format: betaZodOutputFormat(AskOutput) },
    // If the model declines on policy grounds, the API retries on its recommended fallback model.
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: ASK_SYSTEM,
    messages: [{ role: 'user', content: `Passages:\n${passages}\n\nQuestion: ${input.question}` }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return { status: 200, body: { grounded: false, cite: [], say: [] } };
  }
  const out = response.parsed_output;
  const ids = new Set(input.passages.map((p) => p.id));
  // Our own checks, on top of the schema: it must cite what it was given, and speak briefly.
  const valid =
    out.grounded &&
    out.cite.length > 0 &&
    out.cite.every((c) => ids.has(c)) &&
    out.say.length >= 1 &&
    out.say.length <= 2 &&
    out.say.every((s) => words(s) <= 12);
  return { status: 200, body: valid ? out : { grounded: false, cite: [], say: [] } };
}

// --- /scan (Claude vision, hedged) -----------------------------------------------------

const SCAN_SYSTEM = `You look at one photo taken by a bystander during an emergency, usually of a burn or a wound.
Describe only what is visible, in hedged terms. The observation must start with "This looks consistent with" or with "I can't tell".
Never diagnose and never give treatment instructions; the app has its own cited steps.
Choose suggested_protocol from "burns", "bleeding", or null when neither fits or the photo is unclear.
severity_hint: "major" if a burn looks larger than a palm, deep, charred, or on the face, hands, feet or groin, or if bleeding looks heavy; "minor" if clearly small; null if unsure.
Reply as JSON: {"observation": one sentence of 25 words or fewer, "suggested_protocol": ..., "severity_hint": ..., "confidence": 0 to 1}.`;

async function scan(body: unknown, env: Env, client: Anthropic) {
  const input = ScanInput.parse(body);
  const response = await client.beta.messages.parse({
    model: env.CLAUDE_MODEL ?? CLAUDE_MODEL,
    max_tokens: 1024,
    output_config: { effort: 'medium', format: betaZodOutputFormat(ScanOutput) },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: SCAN_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: input.media_type, data: input.image_b64 } },
          { type: 'text', text: 'What does this photo show?' },
        ],
      },
    ],
  });
  const unsure = { observation: "I can't tell from the photo.", suggested_protocol: null, severity_hint: null, confidence: 0 };
  if (response.stop_reason === 'refusal' || !response.parsed_output) return { status: 200, body: unsure };
  const out = response.parsed_output;
  const hedged = /^(This looks consistent with|I can't tell)/.test(out.observation) && words(out.observation) <= 25;
  return { status: 200, body: hedged ? out : unsure };
}

// --- Entry point ----------------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const headers = cors(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const path = new URL(req.url).pathname;
    if (req.method === 'GET' && path === '/health') {
      return json({ ok: true, groq: !!env.GROQ_API_KEY, claude: !!env.ANTHROPIC_API_KEY }, 200, headers);
    }
    if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, headers);

    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for') ?? 'local';
    if (!allow(ip)) return json({ error: 'rate limited' }, 429, { ...headers, 'retry-after': '3' });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid JSON body' }, 400, headers);
    }

    try {
      if (path === '/route') {
        const r = await route(body, env);
        return json(r.body, r.status, headers);
      }
      if (path === '/ask' || path === '/scan') {
        if (!env.ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 503, headers);
        const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: path === '/ask' ? 8_000 : 20_000 });
        const r = path === '/ask' ? await ask(body, env, client) : await scan(body, env, client);
        return json(r.body, r.status, headers);
      }
      return json({ error: 'not found' }, 404, headers);
    } catch (err) {
      if (err instanceof z.ZodError) return json({ error: 'invalid request', issues: err.issues.length }, 400, headers);
      if (err instanceof Anthropic.RateLimitError) return json({ error: 'upstream rate limited' }, 429, headers);
      if (err instanceof Anthropic.APIError) return json({ error: `upstream ${err.status ?? 'error'}` }, 502, headers);
      return json({ error: 'internal error' }, 500, headers);
    }
  },
};
