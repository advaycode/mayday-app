// Tiny static server for the phone mirror. No dependencies.
//
//   node mirror/serve.mjs                serve the exported web build (mobile/dist) + the mirror
//   node mirror/serve.mjs --port 8742
//
// The mirror is at http://localhost:8742/__mirror/ and the bare app at http://localhost:8742/
// To mirror the live dev server instead: http://localhost:8742/__mirror/?src=http://localhost:8081/
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const dist = resolve(here, '..', 'mobile', 'dist');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 8742;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
};

function send(res, file, status = 200) {
  res.writeHead(status, {
    'content-type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream',
    'cache-control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const path = decodeURIComponent(url.pathname);

  // The mirror page itself.
  if (path === '/__mirror' || path === '/__mirror/') return send(res, join(here, 'index.html'));

  // Everything else is the exported app.
  const rel = normalize(path).replace(/^([/\\])+/, '');
  const file = join(dist, rel);
  if (!file.startsWith(dist)) return res.writeHead(403).end();
  if (rel && existsSync(file) && statSync(file).isFile()) return send(res, file);
  // Single-page app: unknown paths get index.html and the router takes over.
  const index = join(dist, 'index.html');
  if (existsSync(index)) return send(res, index);
  res.writeHead(503, { 'content-type': 'text/plain' });
  res.end('No web build yet. Run: cd mobile && npm run build:web');
}).listen(port, '127.0.0.1', () => {
  console.log(`Mayday phone mirror: http://localhost:${port}/__mirror/`);
});
