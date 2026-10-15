// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { ExamFocus: X } = require('../js/exams.js');
const { MIDTERM_PREP } = require('../js/midterm-prep-data.js');
const { SELFTEST_BANK } = require('../js/selftest-data.js');

const midterm = X.byId('midterm-2');
const colloquium = X.byId('colloquium-2');

test('readiness is the weighted share of the parts', () => {
  assert.equal(X.compute(midterm, {}).percent, 0);
  const full = Object.fromEntries(midterm.parts.map(p => [p.id, [5, 5]]));
  assert.equal(X.compute(midterm, full).percent, 100);
  // problems (weight 30) half done, everything else empty → 15%
  assert.equal(X.compute(midterm, { problems: [10, 20] }).percent, 15);
  // over-full parts are capped at 100%
  assert.equal(X.compute(colloquium, { definitions: [30, 21], oral: [12, 12] }).percent, 100);
});

test('every exam weighs its parts to 100 and every part opens a real section', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  for (const exam of X.EXAMS) {
    assert.equal(exam.parts.reduce((s, p) => s + p.weight, 0), 100, exam.id);
    for (const p of exam.parts) assert.ok(html.includes(`data-tab-target="${p.tab}"`), `${exam.id}/${p.id} → ${p.tab}`);
  }
});

test('the default exam is the next one without a grade, else the latest', () => {
  const schedule = { colloquiumDate: '2026-10-14T09:00', midtermDate: '2026-10-16T08:30' };
  const day15 = new Date('2026-10-15T12:00').getTime();
  assert.equal(X.defaultExam(schedule, {}, day15).id, 'midterm-2');
  assert.equal(X.defaultExam(schedule, {}, new Date('2026-10-13T12:00').getTime()).id, 'colloquium-2');
  assert.equal(X.defaultExam(schedule, { colloquium: { grade: '9/10' } }, new Date('2026-10-13T12:00').getTime()).id, 'midterm-2');
  assert.equal(X.defaultExam(schedule, {}, new Date('2026-10-20T12:00').getTime()).id, 'midterm-2');
  assert.equal(X.defaultExam({}, {}).id, X.EXAMS[0].id);
});

test('best mock score counts finished attempts only, scaled to 50', () => {
  assert.deepEqual(X.bestMock({}), [0, 50]);
  assert.deepEqual(X.bestMock({ a: { finishedAt: 1, score: 30, total: 50 }, b: { finishedAt: 2, score: 18, total: 20 }, c: { score: 50, total: 50 } }), [45, 50]);
});

test('context counts the real banks: 28 sheet items, 69 self-tests, the oral questions', () => {
  const rs = {
    prepChecks: { 'd-pmf': { on: true, at: 1 }, 'x-bernoulli': { on: true, at: 1 }, 'c-moments': { on: false, at: 2 } },
    selfTestStats: { 'ST4-02': { solved: true }, 'ST5-03': { solved: false } },
    definitionsScores: { 1: 6, 2: 5, oral_3: 8 },
    problemsMastered: { 1: true, 2: false },
    topicTestsSolved: { 4: { solved: true } }
  };
  const ctx = X.context({ rs, prep: MIDTERM_PREP, bank: SELFTEST_BANK, problems: 23, oralIds: [1, 2, 3] });
  assert.deepEqual(ctx.checklist, [1, 28], 'Bernoulli is not on the sheet');
  assert.deepEqual(ctx.selftests, [1, 69]);
  assert.deepEqual(ctx.definitions, [1, 21]);
  assert.deepEqual(ctx.oral, [1, 3]);
  assert.deepEqual(ctx.problems, [1, 23]);
  assert.deepEqual(ctx.topicTests, [1, 12]);
});
