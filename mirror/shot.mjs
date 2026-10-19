// Headless Chrome driver for screenshots and scripted taps, over the Chrome
// DevTools Protocol. No dependencies (Node 22+ has WebSocket built in).
//
//   node mirror/shot.mjs <url> <out-dir> [steps.json] [--size 402x874] [--dpr 2]
//
// steps.json is a list like:
//   [{"wait": 1500}, {"shot": "home.png"}, {"hold": [201, 640, 1000]}, {"wait": 800}, {"shot": "emergency.png"}]
// Supported: wait, shot, click [x,y], hold [x,y,ms], eval "js", key "Enter", offline true|false, reload true.
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2);
const flag = (name, def) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : def;
};
const [url, outDir = '.', stepsFile] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const [width, height] = flag('--size', '402x874').split('x').map(Number);
const dpr = Number(flag('--dpr', '2'));
const chrome = flag('--chrome', 'C:/Program Files/Google/Chrome/Application/chrome.exe');
const port = 9300 + Math.floor(Math.random() * 500);
const steps = stepsFile ? JSON.parse(readFileSync(stepsFile, 'utf8')) : [{ wait: 2500 }, { shot: 'shot.png' }];
mkdirSync(outDir, { recursive: true });

const profile = join(tmpdir(), `mayday-shot-${port}`);
const proc = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  `--window-size=${width},${height}`,
  '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream',
  // A fake microphone, so a test never hears this laptop's speakers (or the room).
  '--use-fake-device-for-media-stream',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function json(path, method = 'GET') {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${path}`, { method });
      return await r.json();
    } catch {
      await sleep(200);
    }
  }
  throw new Error('Chrome did not start');
}

const target = await json(`/json/new?about:blank`, 'PUT');
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`[${msg.params.type}] ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    logs.push(`[exception] ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
  } else if (msg.method === 'Log.entryAdded') {
    logs.push(`[${msg.params.entry.level}] ${msg.params.entry.text} ${msg.params.entry.url ?? ''}`);
  }
});
const send = (method, params = {}) =>
  new Promise((r) => {
    const n = ++id;
    pending.set(n, r);
    ws.send(JSON.stringify({ id: n, method, params }));
  });

await send('Page.enable');
await send('Runtime.enable');
await send('Log.enable');
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile: false });
await send('Browser.grantPermissions', { permissions: ['geolocation', 'audioCapture'] }).catch(() => {});
await send('Emulation.setGeolocationOverride', { latitude: 28.1866, longitude: -82.3473, accuracy: 18 });
await send('Page.navigate', { url });

const mouse = (type, x, y) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
for (const step of steps) {
  if (step.wait) await sleep(step.wait);
  if (step.offline !== undefined) {
    // Airplane mode: the network is cut (a service worker can still answer).
    await send('Network.enable');
    await send('Network.emulateNetworkConditions', { offline: step.offline, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  if (step.reload) await send('Page.reload', { ignoreCache: false });
  if (step.click) {
    await mouse('mousePressed', ...step.click);
    await mouse('mouseReleased', ...step.click);
  }
  if (step.hold) {
    const [x, y, ms] = step.hold;
    await mouse('mousePressed', x, y);
    await sleep(ms);
    await mouse('mouseReleased', x, y);
  }
  if (step.tap || step.tapLabel) {
    // Tap the element whose own text (or accessibility label) matches, like a finger would.
    const r = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const want = ${JSON.stringify(step.tap ?? step.tapLabel)};
        const byLabel = ${JSON.stringify(Boolean(step.tapLabel))};
        const els = byLabel
          ? [...document.querySelectorAll('[aria-label]')].filter(e => e.getAttribute('aria-label') === want)
          : [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && e.textContent.trim() === want);
        const el = els.find(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; });
        if (!el) return null;
        const b = el.getBoundingClientRect();
        return [b.left + b.width / 2, b.top + b.height / 2];
      })()`,
    });
    const pt = r.result?.result?.value;
    if (!pt) logs.push(`[error] tap target not found: ${step.tap ?? step.tapLabel}`);
    else {
      await mouse('mousePressed', pt[0], pt[1]);
      await sleep(60);
      await mouse('mouseReleased', pt[0], pt[1]);
    }
  }
  if (step.eval) {
    const r = await send('Runtime.evaluate', { expression: step.eval, awaitPromise: true, returnByValue: true });
    logs.push(`[eval] ${JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text)}`);
  }
  if (step.shot) {
    const r = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(outDir, step.shot), Buffer.from(r.result.data, 'base64'));
    console.log('saved', resolve(outDir, step.shot));
  }
}
writeFileSync(join(outDir, 'console.log'), logs.join('\n'));
if (logs.some((l) => l.startsWith('[exception]') || l.startsWith('[error]'))) {
  console.log('console errors:\n' + logs.filter((l) => /exception|error/.test(l)).slice(0, 20).join('\n'));
}
ws.close();
proc.kill();
process.exit(0);
