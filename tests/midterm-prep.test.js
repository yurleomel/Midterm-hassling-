// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MIDTERM_PREP: prep } = require('../js/midterm-prep-data.js');
const { MIDTERM_PAPERS: papers } = require('../js/midterm-papers.js');
const { SELFTEST_BANK: bank } = require('../js/selftest-data.js');

const PS = (() => {
  const window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'))(window);
  return window.PS_DATA;
})();
const items = prep.groups.flatMap(g => g.items);

test('the checklist has its four groups and 29 items with unique ids', () => {
  assert.deepEqual(prep.groups.map(g => g.id), ['definitions', 'distributions', 'notions', 'ican']);
  assert.equal(items.length, 29);
  assert.equal(new Set(items.map(i => i.id)).size, items.length);
});

test('every item quotes the lectures with a lecture and a page', () => {
  for (const item of items.filter(i => i.id !== 'c-problems')) {
    assert.ok(item.quotes.length + item.lectureExamples.length > 0, `${item.id} has lecture material`);
  }
  for (const q of items.flatMap(i => [...i.quotes, ...i.lectureExamples])) {
    assert.ok(['L4', 'L5', 'L6'].includes(q.lecture), `lecture ${q.lecture}`);
    assert.ok(Number.isInteger(q.page) && q.page > 0, `page ${q.page}`);
    assert.ok(q.text.trim().length > 0);
  }
});

test('practice examples and links point at things that exist (no dead ends)', () => {
  const tasks = new Set(bank.tasks.map(t => t.id));
  const problems = new Set(PS.PROBLEMS_BANK.map(p => p.id));
  const defs = new Set(PS.DEFINITIONS_21.map(d => d.id));
  const notes = new Set(PS.TOPICS_NOTES.map(t => t.id));
  for (const item of items) {
    for (const ex of item.practice) {
      if (ex.kind === 'selftest') assert.ok(tasks.has(ex.id), `${item.id}: self-test ${ex.id}`);
      if (ex.kind === 'problem') assert.ok(problems.has(ex.id), `${item.id}: problem ${ex.id}`);
      if (ex.kind === 'source') assert.ok(ex.text && ex.sourceTitle, `${item.id}: source quote has text and title`);
      if (ex.kind === 'midterm2017') assert.ok(papers['2017']?.problems.some(p => p.n === ex.problem), `${item.id}: 2017 problem ${ex.problem}`);
    }
    item.defs.forEach(d => assert.ok(defs.has(d), `${item.id}: definition ${d}`));
    item.notes.forEach(n => assert.ok(notes.has(n), `${item.id}: notes ${n}`));
  }
});

test('practice papers: the points of the parts add up to each problem and the total', () => {
  for (const paper of Object.values(papers)) {
    assert.equal(paper.problems.reduce((s, p) => s + p.points, 0), paper.totalPoints, `${paper.id} total`);
    for (const p of paper.problems) {
      const parts = p.items || p.parts || [];
      assert.equal(parts.reduce((s, x) => s + x.points, 0), p.points, `${paper.id} problem ${p.n}`);
    }
  }
});

test('every formula in the checklist and the papers renders with the bundled KaTeX', () => {
  const katex = require('../vendor/katex/katex.min.js');
  const strings = [];
  const walk = v => {
    if (typeof v === 'string') strings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(prep);
  walk(papers);
  const bad = [];
  let count = 0;
  for (const s of strings) {
    for (const m of s.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)) {
      count++;
      try { katex.renderToString(m[1] ?? m[2], { throwOnError: true, displayMode: !!m[2], macros: { '\\mbox': '\\text{#1}' } }); }
      catch (e) { bad.push(`${(m[1] ?? m[2]).slice(0, 50)} → ${e.message.slice(0, 70)}`); }
    }
  }
  assert.ok(count > 500, `${count} formulas found`);
  assert.deepEqual(bad, []);
});
