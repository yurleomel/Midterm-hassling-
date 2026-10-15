#!/usr/bin/env node
// =====================================================================================
// UI audit: WCAG colour contrast + button affordances, in the light AND dark theme.
//
//   node tools/ui-audit.mjs [--out ui-audit-out] [--themes light,dark] [--only name,...]
//                           [--no-shots] [--allowlist tools/ui-audit-allowlist.json] [--site <checkout>]
//
// No dependencies: Node >= 22 (built-in fetch/WebSocket) and a local Google Chrome
// (CHROME_PATH overrides the macOS default). The tool
//   1. copies the static site to a temp dir and rewrites the cloud-sync URL (the friend's
//      production AWS endpoint in js/user.js) to an unroutable local port, then refuses to
//      start if "amazonaws" is still anywhere in the copy;
//   2. serves the copy on 127.0.0.1 and starts its own headless Chrome with a fresh profile;
//   3. lets only local + CDN GET requests out (everything else is failed in the browser) and
//      exits with an error if anything ever tries to reach amazonaws;
//   4. logs in as guest and walks every section and key state (see STATES) in both themes at
//      1440px, plus every section and the drawer at 390px, and checks:
//        text-contrast   every visible text node, input value and placeholder vs its composited
//                        background (4.5:1; 3:1 for large text and for unavailable controls, i.e.
//                        disabled + cursor:not-allowed), also while the control is hovered
//        icon-contrast   icon-only controls (3:1)
//        field-boundary  text inputs/selects: border or fill vs surroundings (3:1)
//        cursor          interactive elements must show cursor:pointer
//        affordance      a filled button whose fill/border/ring blends into the surface behind it
//        hover           interactive elements must visibly change on hover
//        focus           keyboard focus must be visible (3:1 indicator)
//        spacing         label touching or spilling out of its button/badge box
//        size-mismatch   buttons side by side in one row with different heights
//        page-overflow   horizontal page scroll
//   5. writes report.json, report.txt and screenshots to --out, and exits 1 when a violation
//      is not covered by the allowlist (tools/ui-audit-allowlist.json).
// =====================================================================================

import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SITE_ENTRIES = ['index.html', 'css', 'js', 'vendor'];
const BACKEND_URL_RE = /https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9-]+\.amazonaws\.com/g;
const NEUTRAL_BACKEND = 'http://127.0.0.1:9';
const CDN_HOSTS = new Set(['cdn.tailwindcss.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com']);
export const CATEGORIES = ['text-contrast', 'icon-contrast', 'field-boundary', 'focus', 'hover', 'cursor', 'affordance', 'spacing', 'size-mismatch', 'page-overflow'];
const DESKTOP = { width: 1440, height: 900, mobile: false };
const PHONE = { width: 390, height: 844, mobile: true };
const SHOT_MAX_HEIGHT = 6000;

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ------------------------------------------------------------------ CLI
function parseArgs(argv) {
  const opts = {
    out: path.join(ROOT, 'ui-audit-out'),
    themes: ['light', 'dark'],
    only: null,
    shots: true,
    allowlist: path.join(ROOT, 'tools', 'ui-audit-allowlist.json'),
    site: ROOT
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--out') opts.out = path.resolve(val());
    else if (a === '--themes') opts.themes = val().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--only') opts.only = val().split(',').map(s => s.trim()).filter(Boolean);
    else if (a === '--no-shots') opts.shots = false;
    else if (a === '--allowlist') opts.allowlist = path.resolve(val());
    else if (a === '--site') opts.site = path.resolve(val());
    else if (a === '-h' || a === '--help') {
      console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 30).join('\n'));
      process.exit(0);
    } else throw new Error(`unknown option ${a}`);
  }
  return opts;
}

// ------------------------------------------------------------------ safe site copy + server
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

export function buildSafeSite(siteRoot = ROOT) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stathustle-ui-site-'));
  for (const entry of SITE_ENTRIES) fs.cpSync(path.join(siteRoot, entry), path.join(dir, entry), { recursive: true });
  const textFiles = walk(dir).filter(f => /\.(js|mjs|html|css|json)$/.test(f));
  for (const file of textFiles) {
    const src = fs.readFileSync(file, 'utf8');
    const out = src.replace(BACKEND_URL_RE, NEUTRAL_BACKEND);
    if (out !== src) fs.writeFileSync(file, out);
  }
  const leftovers = textFiles.filter(f => fs.readFileSync(f, 'utf8').includes('amazonaws'));
  if (leftovers.length) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`refusing to serve: "amazonaws" still referenced in ${leftovers.map(f => path.relative(dir, f)).join(', ')}`);
  }
  return dir;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf'
};

function serve(dir) {
  const server = createServer((req, res) => {
    let rel = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = path.join(dir, path.normalize(rel));
    const ok = (req.method === 'GET' || req.method === 'HEAD') && file.startsWith(dir + path.sep) &&
      fs.existsSync(file) && fs.statSync(file).isFile();
    if (!ok) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

// What may leave the browser: our own server and GETs to the CDNs the page loads its libraries from.
// Anything aimed at amazonaws is flagged as a backend request (the run fails) and, like all the rest, blocked.
export function requestPolicy(rawUrl, method, origin) {
  let url;
  try { url = new URL(rawUrl); } catch { return { allowed: false, backend: false }; }
  const backend = /(^|\.)amazonaws\.com$/i.test(url.hostname);
  const allowed = !backend && (url.origin === origin || url.protocol === 'data:' || url.protocol === 'blob:' ||
    (CDN_HOSTS.has(url.hostname) && url.protocol === 'https:' && (method === 'GET' || method === 'HEAD')));
  return { allowed, backend };
}

// ------------------------------------------------------------------ Chrome + DevTools protocol
async function launchChrome() {
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME_PATH)`);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'stathustle-ui-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking',
    '--disable-component-update', '--disable-sync', '--disable-default-apps', '--mute-audio',
    // never throttle or park the audited tab (long runs used to stall once Chrome treated it as hidden)
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-hang-monitor', '--disable-features=IntensiveWakeUpThrottling,CalculateNativeWinOcclusion',
    '--use-mock-keychain', '--password-store=basic',
    '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank'
  ], { stdio: 'ignore' });
  const portFile = path.join(profile, 'DevToolsActivePort');
  let lines = [];
  for (let i = 0; i < 150; i++) {
    if (fs.existsSync(portFile)) {
      lines = fs.readFileSync(portFile, 'utf8').trim().split('\n');
      if (lines.length >= 2) break;
    }
    await sleep(100);
  }
  if (lines.length < 2) { proc.kill('SIGKILL'); throw new Error('Chrome did not open a DevTools port'); }
  const ws = new WebSocket(`ws://127.0.0.1:${lines[0]}${lines[1]}`);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('DevTools websocket failed')), { once: true });
  });
  return { proc, profile, cdp: new CDP(ws) };
}

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener('message', ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id !== undefined) {
        const p = this.pending.get(msg.id);
        if (!p) return;
        this.pending.delete(msg.id);
        if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`));
        else p.resolve(msg.result);
      } else {
        // A crashed or closed tab never answers: fail its pending calls instead of hanging
        if (msg.method === 'Target.detachedFromTarget') this.failSession(msg.params.sessionId, 'tab closed or crashed');
        if (msg.method === 'Inspector.targetCrashed') this.failSession(msg.sessionId, 'renderer crashed');
        for (const fn of this.listeners) fn(msg);
      }
    });
  }

  failSession(sessionId, reason) {
    for (const [id, p] of this.pending) {
      if (p.sessionId === sessionId) { this.pending.delete(id); p.reject(new Error(`${p.method}: ${reason}`)); }
    }
  }

  send(method, params = {}, sessionId, timeout = 120000) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method}: no reply in ${timeout / 1000}s`));
      }, timeout);
      this.pending.set(id, {
        method, sessionId,
        resolve: v => { clearTimeout(timer); resolve(v); },
        reject: e => { clearTimeout(timer); reject(e); }
      });
      this.ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    });
  }

  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
}

// One tab in its own browser context (fresh localStorage/IndexedDB per theme)
class Page {
  constructor(cdp, sessionId, network, baseUrl) {
    this.cdp = cdp;
    this.sessionId = sessionId;
    this.network = network;
    this.origin = new URL(baseUrl).origin;
    this.errors = [];
    this.off = cdp.on(msg => { if (msg.sessionId === sessionId) this.onEvent(msg); });
  }

  send(method, params) { return this.cdp.send(method, params, this.sessionId); }

  onEvent({ method, params }) {
    if (method === 'Fetch.requestPaused') return this.guard(params);
    if (method === 'Page.javascriptDialogOpening') {
      this.send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
    } else if (method === 'Runtime.exceptionThrown') {
      this.errors.push(params.exceptionDetails.exception?.description?.split('\n')[0] || params.exceptionDetails.text);
    }
  }

  // Network policy: our local server and CDN GETs only. Everything else never leaves the browser.
  guard({ requestId, request }) {
    const entry = { method: request.method, url: request.url.slice(0, 200) };
    const { allowed, backend } = requestPolicy(request.url, request.method, this.origin);
    if (backend) this.network.backend.push(entry);
    if (allowed) {
      this.network.allowed++;
      this.send('Fetch.continueRequest', { requestId }).catch(() => {});
    } else {
      this.network.blocked.push(entry);
      this.send('Fetch.failRequest', { requestId, errorReason: 'BlockedByClient' }).catch(() => {});
    }
  }

  async init(theme) {
    await this.send('Page.bringToFront');
    await this.send('Emulation.setFocusEmulationEnabled', { enabled: true });
    await this.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] });
    await this.send('Inspector.enable');
    await this.send('Page.enable');
    await this.send('Runtime.enable');
    await this.send('DOM.enable');
    await this.send('CSS.enable');
    await this.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]
    });
    // The app reads its theme from localStorage before first paint (inline script in <head>)
    await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem('stathustle_theme', ${JSON.stringify(theme)}); } catch (e) {}`
    });
  }

  async viewport({ width, height, mobile }) {
    await this.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  }

  async goto(url) {
    const loaded = new Promise(resolve => {
      const off = this.cdp.on(msg => {
        if (msg.sessionId === this.sessionId && msg.method === 'Page.loadEventFired') { off(); resolve(); }
      });
    });
    await this.send('Page.navigate', { url });
    await Promise.race([loaded, sleep(60000).then(() => { throw new Error(`page did not load: ${url}`); })]);
  }

  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) {
      throw new Error(r.exceptionDetails.exception?.description?.split('\n')[0] || r.exceptionDetails.text);
    }
    return r.result.value;
  }

  async waitFor(expression, timeout = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await this.eval(`!!(${expression})`).catch(() => false)) return;
      await sleep(100);
    }
    throw new Error(`timed out waiting for ${expression}`);
  }

  // Let Tailwind's CDN compiler pick up classes added by a re-render, then let layout settle
  // (two frames; the timer is a fallback in case the tab is not being painted)
  settle() {
    return this.eval(`new Promise(r => {
      let done = false;
      const finish = () => { if (!done) { done = true; setTimeout(r, 150); } };
      requestAnimationFrame(() => requestAnimationFrame(finish));
      setTimeout(finish, 1000);
    })`);
  }

  async screenshot(file, mode, rootSelector) {
    const metrics = await this.send('Page.getLayoutMetrics');
    const vw = metrics.cssLayoutViewport.clientWidth;
    let clip;
    if (mode === 'viewport') {
      clip = { x: metrics.cssVisualViewport.pageX, y: metrics.cssVisualViewport.pageY, width: vw, height: metrics.cssLayoutViewport.clientHeight };
    } else if (mode === 'root' && rootSelector) {
      const box = await this.eval(`(() => { const el = document.querySelector(${JSON.stringify(rootSelector)});
        if (!el) return null; const r = el.getBoundingClientRect();
        return { x: r.left + scrollX, y: r.top + scrollY, width: r.width, height: r.height }; })()`);
      if (box && box.width > 0 && box.height > 0) {
        clip = { x: Math.max(0, box.x - 8), y: Math.max(0, box.y - 8), width: Math.min(vw, box.width + 16), height: Math.min(SHOT_MAX_HEIGHT, box.height + 16) };
      }
    }
    if (!clip) clip = { x: 0, y: 0, width: vw, height: Math.min(SHOT_MAX_HEIGHT, metrics.cssContentSize.height) };
    const shot = await this.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 80, captureBeyondViewport: true, clip: { ...clip, scale: 1 }
    });
    fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  }
}

// ------------------------------------------------------------------ in-page audit library
// Serialised with Function#toString and evaluated in the page, so it must be self-contained.
function pageAuditLib() {
  if (window.__uiAudit) return;

  // Freeze transitions/animations: computed styles then show the end state at once (hover checks,
  // stable screenshots). Colours are unaffected.
  const freeze = document.createElement('style');
  freeze.id = 'ui-audit-freeze';
  freeze.textContent = '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';
  document.head.appendChild(freeze);

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const colorCache = new Map();

  function parseColor(str) {
    if (!str || str === 'transparent' || str === 'none') return [0, 0, 0, 0];
    if (colorCache.has(str)) return colorCache.get(str);
    let out;
    const m = str.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%?))?\s*\)$/);
    if (m) {
      const a = m[4] === undefined ? 1 : parseFloat(m[4]) / (m[5] ? 100 : 1);
      out = [+m[1], +m[2], +m[3], a];
    } else {
      // Any other syntax (color(), oklch(), hex...): let the canvas resolve it to 8-bit sRGB
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = str;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      out = [d[0], d[1], d[2], d[3] / 255];
    }
    colorCache.set(str, out);
    return out;
  }

  const over = (top, bottom) => [0, 1, 2].map(i => top[i] * top[3] + bottom[i] * (1 - top[3]));
  const lerp = (a, b, t) => [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
  const channel = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = c => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const contrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');

  // Colour stops of a gradient background-image; 'image' for url() backgrounds
  function gradientStops(img) {
    if (!img || img === 'none') return null;
    if (/url\(/.test(img)) return 'image';
    const found = img.match(/rgba?\([^)]*\)|color\([^)]*\)|oklch\([^)]*\)|oklab\([^)]*\)|hsla?\([^)]*\)|#[0-9a-f]{3,8}\b/gi);
    return found?.length ? found.map(parseColor) : null;
  }

  // Per-call cache of paint layers (styles do not change during one audit pass)
  let layerCache = null;

  function layerOf(e) {
    if (layerCache?.has(e)) return layerCache.get(e);
    const s = getComputedStyle(e);
    const bg = parseColor(s.backgroundColor);
    let stops = gradientStops(s.backgroundImage);
    let note = '';
    if (stops === 'image') { note = 'background image'; stops = null; }
    else if (stops) {
      note = 'gradient (worst stop)';
      stops = stops.filter(c => c[3] > 0);
      if (!stops.length) stops = null;
    }
    const layer = { bg: bg[3] > 0 ? bg : null, stops, opacity: parseFloat(s.opacity), note };
    layerCache?.set(e, layer);
    return layer;
  }

  // Paint layers from <html> down to `el`: background colour, gradient stops, group opacity
  function layersOf(el) {
    const chain = [];
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.push(e);
    chain.reverse();
    const layers = chain.map(layerOf);
    const note = layers.some(l => l.note === 'background image') ? 'background image'
      : layers.some(l => l.note) ? 'gradient (worst stop)' : '';
    return { layers, note };
  }

  // Every combination of gradient stops (one per gradient layer), capped
  function stopChoices(layers) {
    let combos = [[]];
    layers.forEach((L, i) => {
      if (!L.stops) return;
      const next = [];
      for (const c of combos) for (let k = 0; k < L.stops.length; k++) next.push([...c, [i, k]]);
      combos = next.slice(0, 27);
    });
    return combos;
  }

  // Composite text colour `fg` (rgba or null) over the layers; returns the worst-case pair and
  // whether gradient stops actually changed the result (a gradient covered by an opaque fill does not)
  function resolvePair(layers, fg) {
    let worst = null;
    let minLum = Infinity;
    let maxLum = -Infinity;
    for (const combo of stopChoices(layers)) {
      const pick = new Map(combo);
      let bg = [255, 255, 255];
      const groups = [];
      layers.forEach((L, i) => {
        if (L.opacity < 1) groups.push({ below: bg, o: L.opacity });
        if (L.bg) bg = over(L.bg, bg);
        if (L.stops) bg = over(L.stops[pick.get(i)], bg);
      });
      let text = fg ? over(fg, bg) : null;
      for (let g = groups.length - 1; g >= 0; g--) {
        bg = lerp(groups[g].below, bg, groups[g].o);
        if (text) text = lerp(groups[g].below, text, groups[g].o);
      }
      const ratio = text ? contrast(text, bg) : 0;
      if (!worst || (text && ratio < worst.ratio)) worst = { fg: text, bg, ratio };
      minLum = Math.min(minLum, lum(bg));
      maxLum = Math.max(maxLum, lum(bg));
    }
    worst.varies = maxLum - minLum > 0.002;
    return worst;
  }

  function surfaceOf(el) {
    const { layers } = layersOf(el);
    return resolvePair(layers, null);
  }

  const fixedCache = new WeakMap();
  // Off-canvas drawers (fixed + translated out of the viewport) are not visible
  function offCanvas(el) {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      if (fixedCache.has(e)) { if (fixedCache.get(e)) return true; continue; }
      const s = getComputedStyle(e);
      let out = false;
      if (s.position === 'fixed') {
        const r = e.getBoundingClientRect();
        out = r.right <= 1 || r.left >= innerWidth - 1 || r.bottom <= 1 || r.top >= innerHeight - 1;
      }
      fixedCache.set(e, out);
      if (out) return true;
    }
    return false;
  }

  // Clipped away by an overflow:hidden/clip ancestor?
  function clippedAway(el, rect) {
    for (let e = el.parentElement; e && e !== document.documentElement; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (/hidden|clip/.test(s.overflowX) || /hidden|clip/.test(s.overflowY)) {
        const r = e.getBoundingClientRect();
        if (rect.right <= r.left + 1 || rect.left >= r.right - 1 || rect.bottom <= r.top + 1 || rect.top >= r.bottom - 1) return true;
      }
    }
    return false;
  }

  function isShown(el) {
    if (!el.isConnected) return false;
    if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true })) return false;
    if (el.closest('.katex-mathml, .sr-only')) return false;
    return !offCanvas(el);
  }

  function unionRect(rects) {
    if (!rects.length) return null;
    const u = { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity };
    for (const r of rects) {
      u.left = Math.min(u.left, r.left); u.top = Math.min(u.top, r.top);
      u.right = Math.max(u.right, r.right); u.bottom = Math.max(u.bottom, r.bottom);
    }
    return u;
  }

  function directTextNodes(el) {
    return [...el.childNodes].filter(n => n.nodeType === 3 && n.nodeValue.trim());
  }

  function textRects(nodes) {
    const rects = [];
    for (const n of nodes) {
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0.5 && r.height > 0.5) rects.push(r);
    }
    return rects;
  }

  const SKIP_TEXT = 'script, style, noscript, template, svg, option, select, textarea, title';
  // An unavailable action (disabled + "not-allowed" cursor) is WCAG-exempt; it still has to stay legible (3:1).
  // Disabled controls that only lock content in place (answered quiz options, a solved answer) keep the full threshold.
  const DISABLED = 'button:disabled, input:disabled, select:disabled, textarea:disabled, fieldset:disabled, [aria-disabled="true"]';
  const inactiveCtl = el => { const c = el.closest(DISABLED); return !!c && getComputedStyle(c).cursor === 'not-allowed'; };

  // Formula glyphs report as the element that holds the formula; per-item ids (prob-card-12) as one pattern
  const mathHost = el => { const k = el.closest('.katex'); return k ? k.parentElement : el; };
  const idPattern = id => '#' + id.replace(/\d+/g, 'N');

  function sigOf(node) {
    const el = mathHost(node);
    const host = el.closest('[id]');
    const cls = [...el.classList].filter(c => !c.startsWith('lucide')).slice(0, 14).join('.');
    return `${host ? idPattern(host.id) + ' ' : ''}${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${el !== node ? ' (math)' : ''}`;
  }

  function pathOf(node) {
    const parts = [];
    for (let e = mathHost(node); e && e !== document.body && parts.length < 4; e = e.parentElement) {
      if (e.id) { parts.unshift(idPattern(e.id)); break; }
      const cls = [...e.classList].filter(c => !c.startsWith('lucide')).slice(0, 3).join('.');
      parts.unshift(e.tagName.toLowerCase() + (cls ? '.' + cls : ''));
    }
    return parts.join(' > ');
  }

  const snippet = s => s.replace(/\s+/g, ' ').trim().slice(0, 70);

  function thresholdFor(s) {
    const px = parseFloat(s.fontSize);
    const bold = parseInt(s.fontWeight, 10) >= 700;
    const large = px >= 24 || (px >= 18.66 && bold);
    return { large, need: large ? 3 : 4.5 };
  }

  // Contrast of the text that `el` itself holds (its direct text nodes)
  function checkTextElement(el) {
    const nodes = directTextNodes(el);
    if (!nodes.length || el.closest(SKIP_TEXT) || !isShown(el)) return null;
    const rect = unionRect(textRects(nodes));
    if (!rect || clippedAway(el, rect)) return null;
    const s = getComputedStyle(el);
    let fg = parseColor(s.color);
    const fill = s.webkitTextFillColor && parseColor(s.webkitTextFillColor);
    if (fill && (fill[3] !== fg[3] || fill.some((v, i) => v !== fg[i]))) fg = fill;
    if (fg[3] === 0) return { skipped: 'transparent text (background-clip text)' };
    const { layers, note: layerNote } = layersOf(el);
    if (layerNote === 'background image') return { skipped: 'text over a background image' };
    const pair = resolvePair(layers, fg);
    const note = pair.varies ? 'gradient (worst stop)' : '';
    const disabled = inactiveCtl(el);
    const t = thresholdFor(s);
    const need = disabled ? Math.min(3, t.need) : t.need;
    return {
      text: snippet(nodes.map(n => n.nodeValue).join(' ')),
      fg: hex(pair.fg), bg: hex(pair.bg), ratio: +pair.ratio.toFixed(2), need, large: t.large,
      fontSize: s.fontSize, disabled, note, sig: sigOf(el), path: pathOf(el)
    };
  }

  function textChecks(root, seen) {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
    for (let el = root; el; el = walker.nextNode()) {
      if (seen) { if (seen.has(el)) continue; seen.add(el); }
      const r = checkTextElement(el);
      if (r && !r.skipped) out.push(r);
    }
    return out;
  }

  // Icon-only controls: the icon is the label, it needs 3:1 (WCAG 1.4.11)
  function iconCheck(el) {
    const text = (el.innerText || '').trim();
    if (text) return null;
    const svg = [...el.querySelectorAll('svg')].find(isShown);
    if (!svg) return null;
    const s = getComputedStyle(svg);
    const fg = parseColor(s.stroke && s.stroke !== 'none' && !/url/.test(s.stroke) ? s.stroke : s.color);
    if (fg[3] === 0) return null;
    const pair = resolvePair(layersOf(svg).layers, fg);
    return { fg: hex(pair.fg), bg: hex(pair.bg), ratio: +pair.ratio.toFixed(2), need: 3, sig: sigOf(el), path: pathOf(el), text: el.getAttribute('aria-label') || el.title || '(icon)' };
  }

  const TEXT_FIELD = 'input:not([type]), input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="search"], input[type="url"], input[type="tel"], input[type="datetime-local"], input[type="date"], input[type="time"], textarea, select';

  // Value + placeholder contrast and the field's outline against its surroundings
  function fieldChecks(el) {
    if (!isShown(el)) return [];
    const out = [];
    const s = getComputedStyle(el);
    const inside = surfaceOf(el);
    const outside = surfaceOf(el.parentElement);
    const base = { sig: sigOf(el), path: pathOf(el) };
    const disabled = el.disabled;
    const inactive = disabled && s.cursor === 'not-allowed';
    const value = el.tagName === 'SELECT' ? el.selectedOptions[0]?.textContent : el.value;
    if (value && value.trim()) {
      const fg = over(parseColor(s.color), inside.bg);
      const ratio = contrast(fg, inside.bg);
      const t = thresholdFor(s);
      out.push({ ...base, kind: 'text-contrast', text: snippet(value), fg: hex(fg), bg: hex(inside.bg), ratio: +ratio.toFixed(2), need: inactive ? 3 : t.need, disabled: inactive, field: 'value' });
    } else if (el.placeholder) {
      const ph = getComputedStyle(el, '::placeholder');
      const fg = over(parseColor(ph.color), inside.bg);
      const ratio = contrast(fg, inside.bg);
      out.push({ ...base, kind: 'text-contrast', text: snippet('placeholder: ' + el.placeholder), fg: hex(fg), bg: hex(inside.bg), ratio: +ratio.toFixed(2), need: 4.5, disabled, field: 'placeholder' });
    }
    if (!disabled) {
      // A field inside a bordered group (stepper: − [n] +) is outlined by the group's border
      const ownOutline = parseFloat(s.borderTopWidth) > 0 && parseFloat(s.borderBottomWidth) > 0;
      const group = ownOutline ? null : groupOf(el);
      const box = group || el;
      const bs = group ? getComputedStyle(group) : s;
      const around = group ? surfaceOf(group.parentElement) : outside;
      const bw = parseFloat(bs.borderTopWidth);
      const border = bw > 0 ? over(parseColor(bs.borderTopColor), around.bg) : null;
      const byBorder = border ? contrast(border, around.bg) : 0;
      const byFill = contrast(inside.bg, around.bg);
      const ratio = Math.max(byBorder, byFill);
      out.push({ ...base, kind: 'field-boundary', text: el.placeholder || el.name || el.id || el.tagName.toLowerCase(),
        fg: hex(border || inside.bg), bg: hex(around.bg), ratio: +ratio.toFixed(2), need: 3, note: box !== el ? 'outlined by its group' : '' });
    }
    return out;
  }

  const INTERACTIVE = 'button, a[href], [role="button"], [onclick], select, input[type="checkbox"], input[type="radio"], input[type="file"], summary';
  const NATIVE_WIDGET = 'input[type="checkbox"], input[type="radio"], input[type="file"]';
  const FOCUSABLE = 'button, a[href], select, input, textarea, summary, [tabindex]:not([tabindex="-1"])';
  let nextId = 0;

  // Box of a control that looks like a button/badge: own background or visible border
  function boxed(el, s) {
    const bg = parseColor(s.backgroundColor);
    const hasBorder = parseFloat(s.borderTopWidth) > 0 && parseColor(s.borderTopColor)[3] > 0.05;
    return bg[3] > 0.05 || hasBorder || (s.backgroundImage && s.backgroundImage !== 'none');
  }

  // Part of `rect` that ancestors between `from` and the control `stop` (exclusive) leave visible
  function clipWithin(rect, from, stop) {
    const r = { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    for (let e = from; e && e !== stop; e = e.parentElement) {
      const s = getComputedStyle(e);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
        const c = e.getBoundingClientRect();
        r.left = Math.max(r.left, c.left); r.right = Math.min(r.right, c.right);
        r.top = Math.max(r.top, c.top); r.bottom = Math.min(r.bottom, c.bottom);
      }
    }
    return r;
  }

  // Label touching the edges or spilling out of the control
  function spacingCheck(el) {
    const s = getComputedStyle(el);
    if (!boxed(el, s) || s.display === 'inline') return null;
    const rects = [];
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (n.nodeValue.trim() && isShown(n.parentElement)) rects.push(...textRects([n]).map(r => clipWithin(r, n.parentElement, el)));
    }
    if (!rects.length) return null;
    for (const svg of el.querySelectorAll('svg')) if (isShown(svg)) rects.push(clipWithin(svg.getBoundingClientRect(), svg.parentElement, el));
    const content = unionRect(rects.filter(r => r.right > r.left && r.bottom > r.top));
    if (!content) return null;
    const r = el.getBoundingClientRect();
    const box = {
      left: r.left + parseFloat(s.borderLeftWidth), right: r.right - parseFloat(s.borderRightWidth),
      top: r.top + parseFloat(s.borderTopWidth), bottom: r.bottom - parseFloat(s.borderBottomWidth)
    };
    const gaps = { left: content.left - box.left, right: box.right - content.right, top: content.top - box.top, bottom: box.bottom - content.bottom };
    const spill = Math.min(gaps.left, gaps.right, gaps.top, gaps.bottom) < -1.5;
    const cramped = Math.min(gaps.left, gaps.right) < 3;
    if (!spill && !cramped) return null;
    return {
      sig: sigOf(el), path: pathOf(el), text: snippet(el.innerText || ''),
      detail: `${spill ? 'label spills out of its box' : 'label touches the edge'} (gaps L${gaps.left.toFixed(0)} R${gaps.right.toFixed(0)} T${gaps.top.toFixed(0)} B${gaps.bottom.toFixed(0)}px, font ${s.fontSize}, padding ${s.paddingTop} ${s.paddingRight})`
    };
  }

  // A filled button must keep a visible shape: its fill, border or ring has to stand out from the
  // surface behind it. (In the light theme slate-800 and slate-950 both became slate-100, so grey
  // buttons on grey panels read as plain text.) 1.1:1 is the slate-100-on-white step the theme uses.
  const SHAPE_MIN = 1.1;
  function ringColor(boxShadow) {
    for (const layer of (boxShadow || '').split(/,(?![^(]*\))/)) {
      const col = layer.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
      const lengths = layer.replace(col ? col[0] : '', '').match(/-?[\d.]+px/g) || [];
      if (col && lengths.length >= 4 && parseFloat(lengths[3]) >= 1) return parseColor(col[0]);
    }
    return null;
  }
  // The bordered wrapper a control is a segment of (touches its edges on ≥2 sides), if any
  function groupOf(el) {
    const p = el.parentElement;
    if (!p) return null;
    const ps = getComputedStyle(p);
    if (!(parseFloat(ps.borderTopWidth) > 0 && parseFloat(ps.borderBottomWidth) > 0) || parseColor(ps.borderTopColor)[3] === 0) return null;
    const r = el.getBoundingClientRect();
    const q = p.getBoundingClientRect();
    const inner = { left: q.left + parseFloat(ps.borderLeftWidth), right: q.right - parseFloat(ps.borderRightWidth),
      top: q.top + parseFloat(ps.borderTopWidth), bottom: q.bottom - parseFloat(ps.borderBottomWidth) };
    const touching = ['left', 'right', 'top', 'bottom'].filter(side => Math.abs(r[side] - inner[side]) <= 2).length;
    return touching >= 2 ? p : null;
  }

  function shapeCheck(el) {
    const s = getComputedStyle(el);
    if (parseColor(s.backgroundColor)[3] <= 0.05) return null; // outline/ghost buttons are judged elsewhere
    const group = groupOf(el);
    if (group) {
      // a segment (− / + of a stepper) takes its shape from the group's border
      const out = surfaceOf(group.parentElement).bg;
      if (contrast(over(parseColor(getComputedStyle(group).borderTopColor), out), out) >= SHAPE_MIN) return null;
    }
    const around = surfaceOf(el.parentElement).bg;
    const fill = surfaceOf(el).bg;
    let ratio = contrast(fill, around);
    if (parseFloat(s.borderTopWidth) > 0) ratio = Math.max(ratio, contrast(over(parseColor(s.borderTopColor), around), around));
    const ring = ringColor(s.boxShadow);
    if (ring && ring[3] > 0) ratio = Math.max(ratio, contrast(over(ring, fill), around));
    if (ratio >= SHAPE_MIN) return null;
    return { sig: sigOf(el), path: pathOf(el), text: snippet(el.innerText || el.getAttribute('aria-label') || ''),
      fg: hex(fill), bg: hex(around), ratio: +ratio.toFixed(2), need: SHAPE_MIN,
      detail: 'button has no visible shape (fill, border and ring blend into the surface)' };
  }

  // Buttons next to each other in one row should share a height
  function rowMismatch(buttons) {
    const out = [];
    const byParent = new Map();
    for (const b of buttons) {
      const p = b.parentElement;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p).push(b);
    }
    for (const [parent, list] of byParent) {
      if (list.length < 2) continue;
      const rects = list.map(b => ({ b, r: b.getBoundingClientRect() }));
      for (let i = 1; i < rects.length; i++) {
        const a = rects[i - 1], c = rects[i];
        const sameRow = Math.abs((a.r.top + a.r.bottom) / 2 - (c.r.top + c.r.bottom) / 2) < 4;
        if (sameRow && Math.abs(a.r.height - c.r.height) > 4) {
          out.push({ sig: sigOf(parent) + ' > buttons', path: pathOf(parent), text: snippet(`${a.b.innerText} | ${c.b.innerText}`),
            detail: `heights ${a.r.height.toFixed(0)}px vs ${c.r.height.toFixed(0)}px` });
          break;
        }
      }
    }
    return out;
  }

  function interactiveRecord(el, field = false) {
    const s = getComputedStyle(el);
    if (!isShown(el) || s.pointerEvents === 'none') return null;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || clippedAway(el, r)) return null;
    if (!el.dataset.uaId) el.dataset.uaId = String(++nextId);
    const disabled = el.disabled === true || el.getAttribute('aria-disabled') === 'true';
    // The current page / selected option is not an action: it may stay still on hover
    const current = el.matches('[aria-current]:not([aria-current="false"]), [aria-selected="true"], [aria-pressed="true"]');
    const type = el.getAttribute('type');
    return {
      id: el.dataset.uaId,
      sig: sigOf(el) + (type ? `[type=${type}]` : ''),
      path: pathOf(el),
      text: snippet(el.innerText || el.value || el.getAttribute('aria-label') || el.title || ''),
      disabled,
      cursor: s.cursor,
      current,
      field,
      hoverable: !field && !disabled && !current && !el.matches(NATIVE_WIDGET),
      focusable: !disabled && el.matches(FOCUSABLE)
    };
  }

  function pageOverflow() {
    const width = document.documentElement.scrollWidth;
    if (width <= innerWidth + 1) return null;
    const offenders = [];
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.right > innerWidth + 1 && r.width > 0 && isShown(el)) {
        let scroller = false;
        for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
          const s = getComputedStyle(e);
          if (s.overflowX !== 'visible') { scroller = true; break; }
        }
        if (!scroller) offenders.push(pathOf(el) + ` (right edge ${Math.round(r.right)}px)`);
      }
      if (offenders.length >= 5) break;
    }
    return { width, offenders };
  }

  function truncations(roots) {
    const out = [];
    for (const root of roots) {
      for (const el of root.querySelectorAll('*')) {
        const s = getComputedStyle(el);
        const ellipsis = s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1;
        const clamped = s.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1;
        if ((ellipsis || clamped) && isShown(el)) out.push({ path: pathOf(el), text: snippet(el.textContent || ''), kind: ellipsis ? 'ellipsis' : 'line-clamp' });
        if (out.length >= 40) return out;
      }
    }
    return out;
  }

  // Normalised visual fingerprint: transparent colours/shadows collapse to one value
  function normColor(v) { const c = parseColor(v); return c[3] === 0 ? 'none' : `${hex(c)}/${c[3].toFixed(2)}`; }
  function normShadow(v) {
    if (!v || v === 'none') return 'none';
    const layers = v.split(/,(?![^(]*\))/).map(x => x.trim()).filter(layer => {
      const col = layer.match(/rgba?\([^)]*\)|#[0-9a-f]{3,8}/i);
      return !(col && parseColor(col[0])[3] === 0) && !/^(rgba?\([^)]*\)\s*)?(0px\s*){2,4}(0px)?$/.test(layer.replace(/inset\s*/, ''));
    });
    return layers.length ? layers.join(', ') : 'none';
  }
  function fingerprint(el) {
    const s = getComputedStyle(el);
    return [
      normColor(s.color), normColor(s.backgroundColor), s.backgroundImage,
      normColor(s.borderTopColor), normColor(s.borderBottomColor), normShadow(s.boxShadow),
      s.outlineStyle === 'none' ? 'none' : `${s.outlineStyle} ${s.outlineWidth} ${normColor(s.outlineColor)}`,
      s.textDecorationLine, s.opacity, s.transform, s.filter
    ].join('|');
  }

  window.__uiAudit = {
    audit(rootSelectors) {
      layerCache = new Map();
      try { return this.auditRoots(rootSelectors); } finally { layerCache = null; }
    },

    auditRoots(rootSelectors) {
      const roots = [];
      const missing = [];
      for (const sel of rootSelectors) {
        const found = [...document.querySelectorAll(sel)];
        if (!found.length) missing.push(sel);
        roots.push(...found);
      }
      const seen = new Set();
      const texts = [];
      for (const root of roots) texts.push(...textChecks(root, seen));
      const fields = [];
      const interactive = [];
      const icons = [];
      const spacing = [];
      const affordance = [];
      const buttons = [];
      const inter = new Set();
      for (const root of roots) {
        for (const el of [root, ...root.querySelectorAll('*')]) {
          if (el.matches(TEXT_FIELD) && !inter.has(el)) fields.push(...fieldChecks(el));
          const isField = el.matches('input, textarea') && !el.matches(INTERACTIVE);
          if (!(isField || el.matches(INTERACTIVE)) || inter.has(el)) continue;
          inter.add(el);
          const rec = interactiveRecord(el, isField);
          if (isField) { if (rec) interactive.push(rec); continue; }
          if (!rec) continue;
          interactive.push(rec);
          const ic = iconCheck(el);
          if (ic) icons.push(ic);
          if (!el.matches('select, ' + NATIVE_WIDGET)) {
            const sp = spacingCheck(el);
            if (sp) spacing.push(sp);
            if (boxed(el, getComputedStyle(el))) {
              buttons.push(el);
              const shape = shapeCheck(el);
              if (shape) affordance.push(shape);
            }
          }
        }
      }
      return {
        missing,
        texts,
        fields,
        interactive,
        icons,
        spacing,
        mismatch: rowMismatch(buttons),
        affordance,
        overflow: pageOverflow(),
        truncated: truncations(roots),
        viewport: { width: innerWidth, height: innerHeight }
      };
    },

    // Styles of a control and its subtree (for hover/focus comparison) + the contrast inside it
    snapshot(id) {
      const el = document.querySelector(`[data-ua-id="${id}"]`);
      if (!el) return null;
      const subtree = [el, ...el.querySelectorAll('*')].slice(0, 40);
      const s = getComputedStyle(el);
      const outside = surfaceOf(el.parentElement || el);
      return {
        fp: subtree.map(fingerprint),
        outline: { style: s.outlineStyle, width: parseFloat(s.outlineWidth) || 0, alpha: parseColor(s.outlineColor)[3], color: hex(over(parseColor(s.outlineColor), outside.bg)), ratio: +contrast(over(parseColor(s.outlineColor), outside.bg), outside.bg).toFixed(2) },
        shadow: normShadow(s.boxShadow),
        border: normColor(s.borderTopColor),
        borderRatio: +contrast(over(parseColor(s.borderTopColor), outside.bg), outside.bg).toFixed(2),
        bg: normColor(s.backgroundColor),
        bgRatio: +contrast(surfaceOf(el).bg, outside.bg).toFixed(2),
        outsideBg: hex(outside.bg),
        texts: textChecks(el, null).filter(t => t.ratio < t.need),
        icon: iconCheck(el)
      };
    }
  };
}

// ------------------------------------------------------------------ states
const js = s => s; // marker for readability: strings below run inside the page
const tab = name => js(`window.app.switchTab(${JSON.stringify(name)})`);
const SECTION_ROOT = name => `#tab-${name}`;
const SECTIONS = ['dashboard', 'colloquium', 'problems', 'quizzes', 'selftests', 'topics', 'formulas'];

// Self-test helpers (run inside the page)
const ST = js(`
  window.__st = {
    task: () => window.selfTestBank.session.items[window.selfTestBank.session.index].task,
    click: sel => document.querySelector(sel)?.click(),
    pick(i) { this.click('.st-option[data-i="' + i + '"]'); },
    check() { document.getElementById('st-check').click(); },
    next() { window.selfTestBank.next(); },
    choose(sel) {
      document.querySelectorAll(sel).forEach(s => { s.selectedIndex = 1; s.dispatchEvent(new Event('change', { bubbles: true })); });
    }
  };`);

const STATES = [
  { name: 'login', vp: DESKTOP, roots: ['#auth-gate-modal'], shot: 'viewport',
    run: js(`window.app.switchTab('dashboard')`) },
  { name: 'register', vp: DESKTOP, roots: ['#auth-gate-modal'], shot: 'viewport',
    run: js(`window.userProfile.switchAuthTab('register')`),
    after: js(`window.userProfile.switchAuthTab('login')`) },
  { name: 'dashboard', vp: DESKTOP, roots: ['header', '#app-sidebar', '#tab-dashboard'], shot: 'full',
    run: js(`window.userProfile.loginAsGuest(); window.app.switchTab('dashboard'); window.scrollTo(0, 0)`) },
  { name: 'pomodoro-running', vp: DESKTOP, roots: ['header', '#main-pomodoro-toggle', '#main-pomodoro-reset'], shot: 'viewport',
    run: js(`window.pomodoroTimer.start()`),
    after: js(`window.pomodoroTimer.pause(); window.pomodoroTimer.reset()`) },
  { name: 'colloquium', vp: DESKTOP, roots: ['#tab-colloquium'], shot: 'full',
    run: js(`${tab('colloquium')}; window.app.setColloquiumMode('browse');
      document.querySelectorAll('#oral-questions-list details').forEach((d, i) => { if (i < 2) d.open = true; })`) },
  { name: 'flashcard-open', vp: DESKTOP, roots: ['#flashcard-container'], shot: 'root',
    run: js(`document.getElementById('active-flashcard').click()`) },
  { name: 'flashcard-mastered', vp: DESKTOP, roots: ['#flashcard-container', '#definitions-grid-list'], shot: 'root',
    run: js(`document.getElementById('fc-self-pass-btn').click()`) },
  { name: 'drill', vp: DESKTOP, roots: ['[data-fc-mode]', '#definition-drill-container'], shot: 'root', shotRoot: '#definition-drill-container',
    run: js(`document.querySelector('[data-fc-mode="drill"]').click()`) },
  { name: 'drill-revealed', vp: DESKTOP, roots: ['#definition-drill-container'], shot: 'root',
    run: js(`document.getElementById('drill-answer-input').value = 'A random variable is a measurable function from Ω to ℝ';
      document.getElementById('drill-reveal-btn').click();
      document.querySelector('#definition-drill-container [data-kp-index="0"]')?.click()`) },
  { name: 'drill-summary', vp: DESKTOP, roots: ['#definition-drill-container'], shot: 'root',
    run: js(`(() => { const d = window.definitionDrill; d.startRound([1, 2]);
      for (const g of ['hard', 'good', 'good']) { d.reveal(); d.grade(g); } })()`) },
  { name: 'ticket', vp: DESKTOP, roots: ['[data-fc-mode]', '#exam-ticket-container'], shot: 'root', shotRoot: '#exam-ticket-container',
    run: js(`document.querySelector('[data-fc-mode="ticket"]').click()`) },
  { name: 'ticket-revealed', vp: DESKTOP, roots: ['#exam-ticket-container'], shot: 'root',
    run: js(`document.getElementById('ticket-reveal-btn').click();
      document.querySelector('[data-ticket-grade="oral:good"]')?.click();
      document.querySelectorAll('#exam-ticket-container details').forEach(d => { d.open = true; })`) },
  { name: 'ticket-graded', vp: DESKTOP, roots: ['#exam-ticket-container'], shot: 'root',
    run: js(`(() => { const t = window.examTicket; t.grade(String(t.ticket.defs[0].id), 'hard'); t.grade(String(t.ticket.defs[1].id), 'again'); })()`) },
  { name: 'oral-modal', vp: DESKTOP, roots: ['#oral-simulator-modal'], shot: 'viewport',
    run: js(`window.app.setColloquiumMode('browse'); document.querySelector('.oral-simulate-btn').click()`),
    after: js(`document.getElementById('modal-oral-close-btn').click()`) },
  { name: 'problems', vp: DESKTOP, roots: ['#tab-problems', '#app-sidebar'], shot: 'full', run: tab('problems') },
  { name: 'problems-filtered', vp: DESKTOP, roots: ['[data-prob-filter]'], shot: 'root', shotRoot: '#tab-problems > div',
    run: js(`document.querySelector('[data-prob-filter="Seminar 5"]').click()`),
    after: js(`document.querySelector('[data-prob-filter="all"]').click()`) },
  { name: 'problem-hints', vp: DESKTOP, roots: ['.problem-card:nth-of-type(1)', '.problem-card:nth-of-type(2)'], shot: 'root', shotRoot: '#problems-list-container',
    run: js(`(() => {
      const [a, b] = window.PS_DATA.PROBLEMS_BANK;
      let btn;
      for (let i = 0; i < 10 && (btn = document.querySelector('#prob-card-' + a.id + ' .hint-next-btn')); i++) btn.click();
      document.querySelector('#prob-card-' + a.id + ' details').open = true;
      document.getElementById('prob-input-' + a.id).value = 'zzz';
      window.app.verifyProblemAnswer(a.id);
      document.getElementById('prob-input-' + b.id).value = b.expectedAnswer;
      window.app.verifyProblemAnswer(b.id);
      window.scrollTo(0, 0);
    })()`) },
  { name: 'quizzes', vp: DESKTOP, roots: ['#tab-quizzes'], shot: 'full', run: tab('quizzes') },
  { name: 'quiz-wrong', vp: DESKTOP, roots: ['#tab-quizzes'], shot: 'full',
    run: js(`(() => { const qm = window.quizManager; const q = qm.currentQuiz[qm.currentIndex];
      document.querySelector('.quiz-option[data-index="' + ((q.correctIndex + 1) % q.options.length) + '"]').click(); })()`) },
  { name: 'quiz-right', vp: DESKTOP, roots: ['#tab-quizzes'], shot: 'full',
    run: js(`(() => { const qm = window.quizManager; document.getElementById('quiz-next-btn').click();
      const q = qm.currentQuiz[qm.currentIndex];
      document.querySelector('.quiz-option[data-index="' + q.correctIndex + '"]').click(); })()`) },
  { name: 'quiz-results', vp: DESKTOP, roots: ['#tab-quizzes'], shot: 'full',
    run: js(`(() => { const qm = window.quizManager; qm.score = Math.max(qm.score, Math.ceil(qm.currentQuiz.length * 0.8));
      qm.currentIndex = qm.currentQuiz.length; qm.renderCurrentQuestion(); })()`) },
  { name: 'selftests', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full', run: tab('selftests') },
  { name: 'selftest-type-modal', vp: DESKTOP, roots: ['#st-type-modal'], shot: 'viewport',
    run: js(`document.querySelector('#selftest-container .st-type').click()`) },
  { name: 'selftest-type-revealed', vp: DESKTOP, roots: ['#st-type-modal'], shot: 'viewport',
    run: js(`document.querySelector('#st-type-modal [data-ex="1"]')?.click(); document.querySelector('#st-type-modal .st-reveal').click()`),
    after: js(`window.selfTestBank.closeTypeInfo()`) },
  { name: 'selftest-picked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full',
    run: js(`${ST}
      window.app.switchTab('selftests');
      window.selfTestBank.start(['single', 'multi', 'tf', 'numeric', 'match', 'gaps']
        .map(f => window.SELFTEST_BANK.tasks.find(t => t.format === f)).filter(Boolean));
      __st.pick(__st.task().options.findIndex(o => !o.correct))`) },
  { name: 'selftest-single-checked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full', run: js(`__st.check()`) },
  { name: 'selftest-multi-checked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full',
    run: js(`__st.next(); { const t = __st.task(); __st.pick(t.options.findIndex(o => o.correct)); __st.pick(t.options.findIndex(o => !o.correct)); } __st.check()`) },
  { name: 'selftest-tf-checked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full',
    run: js(`__st.next(); __st.pick(String(!__st.task().answer)); __st.check()`) },
  { name: 'selftest-numeric-checked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full',
    run: js(`__st.next(); { const i = document.getElementById('st-numeric'); i.value = '0.123'; i.dispatchEvent(new Event('input', { bubbles: true })); } __st.check()`) },
  { name: 'selftest-match-checked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full',
    run: js(`__st.next(); __st.choose('.st-match'); __st.check()`) },
  { name: 'selftest-gaps-checked', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full',
    run: js(`__st.next(); __st.choose('.st-gap'); __st.check()`) },
  { name: 'selftest-results', vp: DESKTOP, roots: ['#tab-selftests'], shot: 'full', run: js(`__st.next()`) },
  { name: 'topics', vp: DESKTOP, roots: ['#tab-topics'], shot: 'full', run: tab('topics') },
  { name: 'formulas', vp: DESKTOP, roots: ['#tab-formulas'], shot: 'full', run: tab('formulas') },
  { name: 'dashboard-progress', vp: DESKTOP, roots: ['#app-sidebar', '#tab-dashboard'], shot: 'full',
    run: js(`(() => {
      const up = window.userProfile;
      const q = window.quizManager.currentQuiz[0] || {};
      const st = window.SELFTEST_BANK.tasks[1];
      const p = window.PS_DATA.PROBLEMS_BANK[2];
      if (q.id) up.recordMistake(q.id, q.question, q.topic, 'quiz');
      up.recordMistake('st_' + st.id, st.question, 'Self-test · Topic ' + st.topic, 'selftest');
      up.recordMistake('prob_' + p.id, p.title, p.topic, 'problem');
      up.recordMistake('prob_' + p.id, p.title, p.topic, 'problem');
      up.saveExamGrade('colloquium', '10/10', 'Ticket 7: oral question 3');
      up.saveExamGrade('midterm', '95/100', '');
      window.app.renderDashboard();
      window.app.switchTab('dashboard');
      window.scrollTo(0, 0);
    })()`) },
  { name: 'gemini-drawer', vp: DESKTOP, roots: ['#gemini-drawer'], shot: 'viewport',
    run: js(`document.getElementById('gemini-open-drawer-btn').click()`) },
  { name: 'gemini-no-key', vp: DESKTOP, roots: ['#gemini-drawer'], shot: 'viewport',
    run: js(`document.getElementById('gemini-chat-input').value = 'What is variance?'; document.getElementById('gemini-chat-send-btn').click()`) },
  { name: 'api-key-modal', vp: DESKTOP, roots: ['#gemini-settings-modal'], shot: 'viewport',
    run: js(`document.getElementById('drawer-api-key-btn').click()`) },
  { name: 'api-key-error', vp: DESKTOP, roots: ['#gemini-settings-modal'], shot: 'viewport',
    run: js(`document.getElementById('settings-test-connection-btn').click()`) },
  { name: 'api-key-cleared', vp: DESKTOP, roots: ['#gemini-settings-modal'], shot: 'viewport',
    run: js(`document.getElementById('settings-clear-key-btn').click()`),
    after: js(`document.getElementById('close-gemini-settings-btn').click(); document.getElementById('gemini-close-drawer-btn').click()`) },
  // Profile & rewards modal (js/rewards-ui.js): every tab, a shop item tried on, a sticker opened
  { name: 'rewards-avatar', vp: DESKTOP, roots: ['#user-profile-modal'], shot: 'viewport',
    run: js(`window.rewards.open('avatar')`) },
  { name: 'rewards-shop', vp: DESKTOP, roots: ['#user-profile-modal'], shot: 'viewport',
    run: js(`window.rewards.setTab('shop'); document.querySelector('#user-profile-modal [data-rw-pick]:not([data-rw-pick=""])')?.click()`) },
  { name: 'rewards-stickers', vp: DESKTOP, roots: ['#user-profile-modal'], shot: 'viewport',
    run: js(`window.rewards.setTab('stickers'); document.querySelector('#user-profile-modal [data-rw-sticker]')?.click()`) },
  { name: 'rewards-account', vp: DESKTOP, roots: ['#user-profile-modal'], shot: 'viewport',
    run: js(`window.rewards.setTab('account')`),
    after: js(`window.rewards.close()`) },
  { name: 'rewards-toast', vp: DESKTOP, roots: ['.rw-toasts'], shot: 'viewport',
    run: js(`window.rewards.toast({ art: '', title: '+20 points', sub: 'Self-test 4 · first try', go: 'shop', ms: 600000 })`),
    after: js(`document.querySelectorAll('.rw-toast').forEach(t => t.remove())`) },
  ...SECTIONS.map(name => ({
    name: `phone-${name}`, vp: PHONE, roots: ['header', SECTION_ROOT(name)], shot: 'full',
    run: js(`window.app.switchTab(${JSON.stringify(name)}); window.scrollTo(0, 0)`)
  })),
  { name: 'phone-rewards', vp: PHONE, roots: ['#user-profile-modal'], shot: 'viewport',
    run: js(`window.rewards.open('shop')`),
    after: js(`window.rewards.close()`) },
  { name: 'phone-drawer', vp: PHONE, roots: ['#app-sidebar'], shot: 'viewport',
    run: js(`window.scrollTo(0, 0); document.getElementById('nav-open-btn').click()`),
    after: js(`document.getElementById('nav-close-btn').click()`) }
];

// ------------------------------------------------------------------ running one theme
async function auditTheme({ cdp, baseUrl, theme, opts, network }) {
  const { browserContextId } = await cdp.send('Target.createBrowserContext', { disposeOnDetach: true });
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const page = new Page(cdp, sessionId, network, baseUrl);
  const findings = [];
  const states = [];
  const truncated = [];
  const checkedSigs = new Set();
  const shotDir = path.join(opts.out, 'shots', theme);
  fs.mkdirSync(shotDir, { recursive: true });

  try {
    await page.init(theme);
    let vp = DESKTOP;
    await page.viewport(vp);
    await page.goto(baseUrl);
    await page.waitFor(`window.app && window.userProfile && window.quizManager && document.documentElement.classList.contains(${JSON.stringify(theme)})`);
    await page.waitFor(`typeof window.renderMathInElement === 'function' && document.querySelector('#distributions-table-body .katex')`);
    // Fresh profile: no session, so the auth gate comes up once IndexedDB has opened
    await page.waitFor(`!document.getElementById('auth-gate-modal').classList.contains('hidden')`);
    await page.eval(`(${pageAuditLib.toString()})()`);
    await page.settle();

    let index = 0;
    for (const state of STATES) {
      index++;
      if (state.vp !== vp) {
        vp = state.vp;
        await page.viewport(vp);
      }
      try {
        await page.eval(state.run);
      } catch (err) {
        states.push({ name: state.name, error: `setup failed: ${err.message}` });
        if (/crashed|closed|no reply/.test(err.message)) break;
        continue;
      }
      await page.settle();
      if (opts.only && !opts.only.some(o => state.name.includes(o))) {
        if (state.after) await page.eval(state.after).catch(() => {});
        continue;
      }

      try {
        const errorsBefore = page.errors.length;
        const res = await page.eval(`window.__uiAudit.audit(${JSON.stringify(state.roots)})`);
        const where = { theme, state: state.name, width: vp.width };
        const add = (category, item, extra = {}) => findings.push({ category, ...where, ...item, ...extra });

        for (const t of res.texts) if (t.ratio < t.need) add('text-contrast', t, { variant: t.disabled ? 'disabled' : 'normal' });
        for (const f of res.fields) if (f.ratio < f.need) add(f.kind, f, { variant: f.field || 'boundary' });
        for (const ic of res.icons) if (ic.ratio < ic.need) add('icon-contrast', ic, { variant: 'normal' });
        for (const sp of res.spacing) add('spacing', sp);
        for (const mm of res.mismatch) add('size-mismatch', mm);
        for (const af of res.affordance) add('affordance', af);
        if (res.overflow) add('page-overflow', { sig: `page@${vp.width}`, path: 'html', text: res.overflow.offenders.join(' ; '), detail: `page is ${res.overflow.width}px wide in a ${vp.width}px viewport` });
        for (const tr of res.truncated) truncated.push({ ...where, ...tr });

        // cursor + hover + focus per control (one representative per class signature). Drop focus first:
        // an auto-focused field would otherwise already show its focus style in the "before" snapshot.
        await page.eval('document.activeElement && document.activeElement !== document.body && document.activeElement.blur()');
        const doc = await page.send('DOM.getDocument', { depth: 0 });
        for (const it of res.interactive) {
          if (it.disabled) continue;
          if (!it.field && it.cursor !== 'pointer') add('cursor', it, { detail: `cursor: ${it.cursor}` });
          if (checkedSigs.has(it.sig)) continue;
          checkedSigs.add(it.sig);
          let nodeId;
          try {
            ({ nodeId } = await page.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: `[data-ua-id="${it.id}"]` }));
          } catch { nodeId = 0; }
          if (!nodeId) continue;
          const before = await page.eval(`window.__uiAudit.snapshot(${JSON.stringify(it.id)})`);
          if (!before) continue;
          if (it.hoverable) {
            await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['hover'] });
            const hovered = await page.eval(`window.__uiAudit.snapshot(${JSON.stringify(it.id)})`);
            await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
            if (hovered) {
              if (hovered.fp.join('\n') === before.fp.join('\n')) add('hover', it, { detail: 'no visible change on hover' });
              for (const t of hovered.texts) add('text-contrast', t, { variant: 'hover' });
              if (hovered.icon && hovered.icon.ratio < hovered.icon.need) add('icon-contrast', hovered.icon, { variant: 'hover' });
            }
          }
          if (it.focusable) {
            await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['focus', 'focus-visible'] });
            const focused = await page.eval(`window.__uiAudit.snapshot(${JSON.stringify(it.id)})`);
            await page.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
            if (focused) {
              const verdict = focusVerdict(before, focused);
              if (verdict) add('focus', it, { detail: verdict });
            }
          }
        }

        const shot = opts.shots ? path.join(shotDir, `${String(index).padStart(2, '0')}-${state.name}.jpg`) : null;
        if (shot) await page.screenshot(shot, state.shot, state.shotRoot || state.roots[0]);
        states.push({
          name: state.name, width: vp.width, missingRoots: res.missing, texts: res.texts.length,
          interactive: res.interactive.length, fields: res.fields.length, shot: shot && path.relative(opts.out, shot),
          pageErrors: page.errors.slice(errorsBefore)
        });
        if (state.after) await page.eval(state.after).catch(() => {});
        await page.settle();
      } catch (err) {
        // A crashed tab cannot be audited further in this theme; anything else is recorded and the run goes on
        states.push({ name: state.name, error: err.message });
        if (/crashed|closed|no reply/.test(err.message)) break;
      }
    }
  } finally {
    page.off();
    await cdp.send('Target.closeTarget', { targetId }).catch(() => {});
    await cdp.send('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  }
  return { findings, states, truncated, pageErrors: page.errors };
}

// Is keyboard focus visible? Outline (UA 'auto' ring or a 3:1 custom one), a ring shadow, or a 3:1 border/fill change.
function focusVerdict(before, focused) {
  const o = focused.outline;
  if (o.style !== 'none' && o.width > 0 && (o.style === 'auto' || o.alpha > 0)) {
    if (o.style === 'auto' || o.ratio >= 3) return null;
    return `focus outline ${o.color} is ${o.ratio}:1 against ${focused.outsideBg} (needs 3:1)`;
  }
  if (focused.shadow !== before.shadow && focused.shadow !== 'none') return null;
  if (focused.border !== before.border && focused.borderRatio >= 3) return null;
  if (focused.bg !== before.bg && focused.bgRatio >= 3) return null;
  if (focused.border !== before.border || focused.bg !== before.bg) {
    return `focus only changes border/fill to ${focused.borderRatio}:1 / ${focused.bgRatio}:1 against ${focused.outsideBg} (needs 3:1)`;
  }
  return 'no visible focus indicator';
}

// ------------------------------------------------------------------ grouping, allowlist, report
function groupFindings(findings) {
  const groups = new Map();
  for (const f of findings) {
    const key = [f.theme, f.category, f.variant || '', f.sig, f.fg || '', f.bg || '', f.detail?.replace(/\d+(\.\d+)?/g, '#') || ''].join('|');
    let g = groups.get(key);
    if (!g) {
      g = {
        theme: f.theme, category: f.category, variant: f.variant || '', sig: f.sig, path: f.path,
        fg: f.fg, bg: f.bg, ratio: f.ratio, need: f.need, detail: f.detail, note: f.note,
        texts: [], states: [], count: 0
      };
      groups.set(key, g);
    }
    g.count++;
    if (f.ratio !== undefined) g.ratio = Math.min(g.ratio ?? Infinity, f.ratio);
    if (f.text && g.texts.length < 3 && !g.texts.includes(f.text)) g.texts.push(f.text);
    const st = f.width === PHONE.width && !f.state.startsWith('phone') ? `${f.state}@${f.width}` : f.state;
    if (!g.states.includes(st)) g.states.push(st);
  }
  return [...groups.values()];
}

export function loadAllowlist(file) {
  if (!fs.existsSync(file)) return [];
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const entries = Array.isArray(data) ? data : data.entries || [];
  for (const e of entries) {
    if (!CATEGORIES.includes(e.category) || !e.reason) {
      throw new Error(`allowlist entry needs a known "category" and a "reason": ${JSON.stringify(e)}`);
    }
  }
  return entries;
}

function allowedBy(entries, g) {
  return entries.find(e =>
    e.category === g.category &&
    (!e.theme || e.theme === '*' || e.theme === g.theme) &&
    (!e.variant || e.variant === g.variant) &&
    (!e.sig || g.sig.includes(e.sig)) &&
    (!e.text || g.texts.some(t => t.includes(e.text))));
}

function describe(g) {
  const where = g.states.slice(0, 4).join(', ') + (g.states.length > 4 ? ` +${g.states.length - 4}` : '');
  const pair = g.fg ? ` ${g.ratio}:1 < ${g.need}  ${g.fg} on ${g.bg}` : '';
  const text = g.texts.length ? `  "${g.texts[0]}"` : '';
  const variant = g.variant && g.variant !== 'normal' ? ` [${g.variant}]` : '';
  const detail = g.detail ? `  (${g.detail})` : '';
  const note = g.note ? `  {${g.note}}` : '';
  return `  ${g.category}${variant} ×${g.count}${pair}${text}${detail}${note}\n      ${g.sig}\n      states: ${where}`;
}

function writeReport({ opts, results, network, allowEntries, startedAt }) {
  const all = results.flatMap(r => r.findings);
  const groups = groupFindings(all);
  const failing = [];
  const allowed = [];
  for (const g of groups) {
    const entry = allowedBy(allowEntries, g);
    if (entry) allowed.push({ ...g, allowedBecause: entry.reason });
    else failing.push(g);
  }
  const order = CATEGORIES;
  const sortKey = g => [order.indexOf(g.category), g.theme, -(g.count || 0)];
  failing.sort((a, b) => {
    const x = sortKey(a), y = sortKey(b);
    return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2] - y[2];
  });

  const themes = results.map(r => r.theme);
  const countTable = order.map(cat => {
    const cells = themes.map(t => failing.filter(g => g.category === cat && g.theme === t).length);
    return `  ${cat.padEnd(16)}${cells.map(c => String(c).padStart(8)).join('')}`;
  });
  const totals = themes.map(t => failing.filter(g => g.theme === t).length);
  const instances = themes.map(t => failing.filter(g => g.theme === t).reduce((n, g) => n + g.count, 0));
  const stateErrors = results.flatMap(r => r.states.filter(s => s.error || s.missingRoots?.length).map(s => `${r.theme}/${s.name}: ${s.error || 'root not found: ' + s.missingRoots.join(', ')}`));
  const pass = failing.length === 0 && network.backend.length === 0 && stateErrors.length === 0;

  const lines = [
    `UI audit ${new Date(startedAt).toISOString()}  (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`,
    `Network: ${network.backend.length} request(s) to amazonaws, ${network.blocked.length} blocked third-party request(s), ${network.allowed} allowed (local + CDN)`,
    `States: ${results.map(r => `${r.theme} ${r.states.filter(s => !s.error).length}`).join(', ')}${stateErrors.length ? `  — ${stateErrors.length} state problem(s)` : ''}`,
    '',
    `Violations (grouped, not allowlisted)${''.padEnd(0)}${themes.map(t => t.padStart(8)).join('')}`,
    ...countTable,
    `  ${'TOTAL groups'.padEnd(16)}${totals.map(c => String(c).padStart(8)).join('')}`,
    `  ${'(instances)'.padEnd(16)}${instances.map(c => String(c).padStart(8)).join('')}`,
    `Allowlisted groups: ${allowed.length}`,
    ''
  ];
  if (network.backend.length) lines.push('!! BACKEND REQUESTS (must be zero):', ...network.backend.map(b => `  ${b.method} ${b.url}`), '');
  if (stateErrors.length) lines.push('State problems:', ...stateErrors.map(s => '  ' + s), '');
  for (const t of themes) {
    const mine = failing.filter(g => g.theme === t);
    if (!mine.length) continue;
    lines.push(`--- ${t} (${mine.length})`);
    for (const g of mine.slice(0, 60)) lines.push(describe(g));
    if (mine.length > 60) lines.push(`  … ${mine.length - 60} more in report.json`);
    lines.push('');
  }
  if (allowed.length) {
    lines.push('--- allowlisted');
    for (const g of allowed) lines.push(`  ${g.theme} ${g.category} ${g.sig} — ${g.allowedBecause}`);
    lines.push('');
  }
  const blockedHosts = [...new Set(network.blocked.map(b => { try { return new URL(b.url).host; } catch { return b.url; } }))];
  if (blockedHosts.length) lines.push(`Blocked hosts: ${blockedHosts.join(', ')}`);
  const pageErrors = results.flatMap(r => r.pageErrors.map(e => `${r.theme}: ${e}`));
  if (pageErrors.length) lines.push(`Page errors (${pageErrors.length}):`, ...[...new Set(pageErrors)].slice(0, 10).map(e => '  ' + e));
  lines.push(`Result: ${pass ? 'PASS' : 'FAIL'}`);

  const report = {
    startedAt: new Date(startedAt).toISOString(),
    pass,
    network,
    themes: results.map(r => ({ theme: r.theme, states: r.states, truncated: r.truncated, pageErrors: r.pageErrors })),
    violations: failing,
    allowlisted: allowed
  };
  fs.mkdirSync(opts.out, { recursive: true });
  fs.writeFileSync(path.join(opts.out, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(opts.out, 'report.txt'), lines.join('\n') + '\n');
  return { text: lines.join('\n'), pass };
}

// ------------------------------------------------------------------ main
async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const startedAt = Date.now();
  const allowEntries = loadAllowlist(opts.allowlist);
  fs.rmSync(path.join(opts.out, 'shots'), { recursive: true, force: true });

  const siteDir = buildSafeSite(opts.site);
  const server = await serve(siteDir);
  const baseUrl = `http://127.0.0.1:${server.address().port}/`;
  let chrome;
  const cleanup = () => {
    try { chrome?.cdp.ws.close(); } catch {}
    try { chrome?.proc.kill('SIGKILL'); } catch {}
    server.close();
    fs.rmSync(siteDir, { recursive: true, force: true });
    if (chrome) fs.rmSync(chrome.profile, { recursive: true, force: true, maxRetries: 3 });
  };
  process.on('SIGINT', () => { cleanup(); process.exit(130); });

  const network = { backend: [], blocked: [], allowed: 0 };
  try {
    chrome = await launchChrome();
    const results = [];
    for (const theme of opts.themes) {
      process.stderr.write(`auditing ${theme} theme…\n`);
      const r = await auditTheme({ cdp: chrome.cdp, baseUrl, theme, opts, network });
      results.push({ theme, ...r });
    }
    const { text, pass } = writeReport({ opts, results, network, allowEntries, startedAt });
    console.log(text);
    console.log(`\nreport: ${path.relative(process.cwd(), path.join(opts.out, 'report.txt'))}, report.json, shots/`);
    process.exitCode = pass ? 0 : 1;
  } finally {
    cleanup();
  }
}

// Run only when executed directly (tests import the helpers above)
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(err => {
    console.error(`ui-audit failed: ${err.stack || err.message}`);
    process.exit(2);
  });
}
