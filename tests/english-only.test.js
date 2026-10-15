// Run with: node --test tests/*.test.js
// The site is English-only: no Cyrillic may reach the UI. Ukrainian names kept in js/data.js
// (nameUa / titleUa) are data that the UI does not display.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CYRILLIC = /[Ѐ-ӿ]/;
const ALLOWED_DATA_KEYS = /"(nameUa|titleUa)":/;

function offenders(file, allowLine = () => false) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => CYRILLIC.test(line) && !allowLine(line))
    .map(({ line, n }) => `${file}:${n}: ${line.trim().slice(0, 90)}`);
}

test('no Cyrillic in the UI (index.html, css, js) — the site is English-only', () => {
  const files = ['index.html', 'css/style.css', ...fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js')).map(f => `js/${f}`)];
  const bad = files.flatMap(f => offenders(f, f === 'js/data.js' ? line => ALLOWED_DATA_KEYS.test(line) : undefined));
  assert.deepEqual(bad, []);
});
