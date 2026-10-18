// Local development server: runs the same handler as the Cloudflare Worker,
// on plain Node (22.6+ runs TypeScript directly). Keys come from the
// environment or from proxy/.dev.vars (KEY=value lines, never committed).
//
//   cd proxy && npm run dev        -> http://localhost:8787
//   then in mobile/.env.local:     EXPO_PUBLIC_PROXY_URL=http://localhost:8787
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';

import worker, { type Env } from './index.ts';

const vars = new URL('../.dev.vars', import.meta.url);
const env: Env = { ...process.env };
if (existsSync(vars)) {
  for (const line of readFileSync(vars, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) (env as Record<string, string>)[m[1]] = m[2].replace(/^"|"$/g, '');
  }
}

createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const request = new Request(`http://localhost${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' ? undefined : Buffer.concat(chunks),
  });
  const response = await worker.fetch(request, env);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(8787, () => {
  console.log(`Mayday proxy on http://localhost:8787  (groq: ${!!env.GROQ_API_KEY}, claude: ${!!env.ANTHROPIC_API_KEY})`);
});
