// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// data.js and problem-directions.js fill window.PS_DATA; evaluate both with a stand-in window
const PS = (() => {
  const window = {};
  for (const file of ['data.js', 'problem-directions.js']) {
    new Function('window', fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'))(window);
  }
  return window.PS_DATA;
})();

test('every exam problem has a direction hint', () => {
  const missing = PS.PROBLEMS_BANK.filter(p => !PS.PROBLEM_DIRECTIONS[p.id]).map(p => p.id);
  assert.deepEqual(missing, []);
});

test('every exam problem links to theory that exists (no dead ends)', () => {
  const defIds = new Set(PS.DEFINITIONS_21.map(d => d.id));
  const noteIds = new Set(PS.TOPICS_NOTES.map(t => t.id));
  for (const p of PS.PROBLEMS_BANK) {
    const theory = PS.PROBLEM_THEORY[p.id];
    assert.ok(theory, `problem ${p.id} has theory links`);
    assert.ok(theory.defs.length > 0, `problem ${p.id} names at least one definition`);
    theory.defs.forEach(id => assert.ok(defIds.has(id), `problem ${p.id}: definition ${id}`));
    assert.ok(noteIds.has(theory.notes), `problem ${p.id}: notes ${theory.notes}`);
  }
  const stale = Object.keys(PS.PROBLEM_THEORY).filter(id => !PS.PROBLEMS_BANK.some(p => String(p.id) === id));
  assert.deepEqual(stale, [], 'no links for problems that are not in the bank');
});

test('every formula in the colloquium definitions and oral questions renders with the bundled KaTeX', () => {
  const katex = require('../vendor/katex/katex.min.js');
  const strings = [];
  const walk = v => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(PS.DEFINITIONS_21);
  walk(PS.ORAL_QUESTIONS_12);
  const bad = [];
  for (const s of strings) {
    for (const m of s.matchAll(/\$\$([\s\S]+?)\$\$|\$([^$]+?)\$/g)) {
      try { katex.renderToString(m[1] ?? m[2], { throwOnError: true, displayMode: !!m[1], macros: { '\\mbox': '\\text{#1}' } }); }
      catch (e) { bad.push(`${(m[1] ?? m[2]).slice(0, 50)} → ${e.message.slice(0, 70)}`); }
    }
  }
  assert.deepEqual(bad, []);
});
