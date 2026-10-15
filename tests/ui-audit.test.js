// Run with: node --test tests/*.test.js
// The browser part of tools/ui-audit.mjs needs Chrome; these cover the parts that keep it safe to run:
// the served copy never contains the production sync URL and nothing but local/CDN GETs leaves the browser.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const tool = () => import('../tools/ui-audit.mjs');

function allFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(d =>
    d.isDirectory() ? allFiles(path.join(dir, d.name)) : [path.join(dir, d.name)]);
}

test('the audited copy of the site has the cloud-sync endpoint neutralised', async () => {
  const { buildSafeSite } = await tool();
  const dir = buildSafeSite(ROOT);
  try {
    const texts = allFiles(dir).filter(f => /\.(js|html|css)$/.test(f));
    assert.ok(texts.length > 5);
    for (const f of texts) assert.ok(!fs.readFileSync(f, 'utf8').includes('amazonaws'), `${f} still mentions amazonaws`);
    assert.match(fs.readFileSync(path.join(dir, 'js', 'user.js'), 'utf8'), /CLOUD_SYNC_ENDPOINT = 'http:\/\/127\.0\.0\.1:9'/);
    // the working copy itself is untouched
    assert.match(fs.readFileSync(path.join(ROOT, 'js', 'user.js'), 'utf8'), /CLOUD_SYNC_ENDPOINT = 'https:\/\//);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('only the local server and CDN GETs may leave the audited browser', async () => {
  const { requestPolicy } = await tool();
  const origin = 'http://127.0.0.1:5555';
  const backend = 'https://abc123.execute-api.us-east-1.amazonaws.com/';

  assert.deepEqual(requestPolicy(backend, 'POST', origin), { allowed: false, backend: true });
  assert.deepEqual(requestPolicy(backend + '?email=x', 'GET', origin), { allowed: false, backend: true });
  assert.equal(requestPolicy(`${origin}/js/app.js`, 'GET', origin).allowed, true);
  assert.equal(requestPolicy('https://cdn.tailwindcss.com/3.4.17', 'GET', origin).allowed, true);
  assert.equal(requestPolicy('https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js', 'GET', origin).allowed, true);
  assert.equal(requestPolicy('https://cdn.jsdelivr.net/upload', 'POST', origin).allowed, false);
  assert.equal(requestPolicy('http://127.0.0.1:9/', 'POST', origin).allowed, false); // the neutralised sync URL
  assert.equal(requestPolicy('https://accounts.google.com/gsi/client', 'GET', origin).allowed, false);
  assert.equal(requestPolicy('https://generativelanguage.googleapis.com/v1beta/models/x:generateContent', 'POST', origin).allowed, false);
  assert.equal(requestPolicy('not a url', 'GET', origin).allowed, false);
});

test('every allowlist entry names a known check and says why', async () => {
  const { loadAllowlist, CATEGORIES } = await tool();
  const entries = loadAllowlist(path.join(ROOT, 'tools', 'ui-audit-allowlist.json'));
  for (const e of entries) {
    assert.ok(CATEGORIES.includes(e.category), `unknown category ${e.category}`);
    assert.ok(e.reason && e.reason.length > 20, `entry for ${e.sig || e.category} needs a real reason`);
    assert.ok(e.sig || e.text, 'an entry must target something (sig or text), not a whole category');
  }
});
