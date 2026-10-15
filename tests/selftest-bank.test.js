// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { SelfTestLogic: L } = require('../js/selftest-bank.js');
const { SELFTEST_BANK: bank } = require('../js/selftest-data.js');

const byId = id => bank.tasks.find(t => t.id === id);

function seeded(seed) {
  return () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
}

// --- bank integrity ---

test('the bank has 69 unique tasks across topics 4, 5, 6 and the numeric duplicate is gone', () => {
  assert.equal(bank.tasks.length, 69);
  assert.equal(new Set(bank.tasks.map(t => t.id)).size, 69);
  assert.deepEqual([...new Set(bank.tasks.map(t => t.topic))].sort(), [4, 5, 6]);
  assert.equal(byId('ST5-13'), undefined);
  assert.equal(byId('ST5-11').alsoAskedAs, 'numeric');
});

test('no two tasks share the same question and answer set', () => {
  const sig = t => JSON.stringify([t.question, (t.options || []).map(o => o.text).sort(), t.stems, t.gaps, t.answer]);
  assert.equal(new Set(bank.tasks.map(sig)).size, bank.tasks.length);
});

test('every task has a known type, a difficulty, an explanation and a gradable answer', () => {
  const types = new Set(bank.types.map(t => t.id));
  for (const t of bank.tasks) {
    assert.ok(types.has(t.type), `${t.id} type`);
    assert.ok(L.DIFFICULTIES.includes(t.difficulty), `${t.id} difficulty`);
    assert.ok(t.explanation && t.question, `${t.id} text`);
    if (t.format === 'single') assert.equal(t.options.filter(o => o.correct).length, 1, `${t.id} single`);
    if (t.format === 'multi') assert.ok(t.options.some(o => o.correct), `${t.id} multi`);
    if (t.format === 'tf') assert.equal(typeof t.answer, 'boolean');
    if (t.format === 'numeric') assert.ok(Number.isFinite(L.parseNumber(t.answer)), `${t.id} numeric`);
    if (t.format === 'match') t.answer.forEach(a => assert.ok(t.choices.includes(a), `${t.id} match`));
    if (t.format === 'gaps') t.answer.forEach((a, i) => assert.ok(t.gaps[i].includes(a), `${t.id} gap`));
  }
});

test('every type is used, and its topics list matches its tasks', () => {
  for (const type of bank.types) {
    const tasks = bank.tasks.filter(t => t.type === type.id);
    assert.ok(tasks.length > 0, type.id);
    assert.deepEqual(type.topics, [...new Set(tasks.map(t => t.topic))].sort());
  }
});

// --- filtering & picking ---

test('filters combine topic, type, difficulty and "only unsolved"', () => {
  assert.equal(L.filter(bank.tasks, { topic: 4 }).length, 30);
  assert.equal(L.filter(bank.tasks, { topic: '5' }).length, 19, 'topic from a data-attribute string');
  const typed = L.filter(bank.tasks, { type: 'match-formula' });
  assert.deepEqual(typed.map(t => t.id).sort(), ['ST4-19', 'ST6-02']);
  assert.deepEqual(L.filter(bank.tasks, { topic: 6, type: 'match-formula' }).map(t => t.id), ['ST6-02']);
  const hard = L.filter(bank.tasks, { difficulty: 'hard' });
  assert.ok(hard.length > 0 && hard.every(t => t.difficulty === 'hard'));
  const stats = { 'ST4-19': { solved: true } };
  assert.deepEqual(L.filter(bank.tasks, { type: 'match-formula', onlyUnsolved: true }, stats).map(t => t.id), ['ST6-02']);
});

test('pick returns n distinct tasks, capped at the pool, without mutating it', () => {
  const pool = L.filter(bank.tasks, { topic: 5 });
  const copy = pool.slice();
  const got = L.pick(pool, 7, seeded(1));
  assert.equal(got.length, 7);
  assert.equal(new Set(got.map(t => t.id)).size, 7);
  assert.deepEqual(pool, copy);
  assert.equal(L.pick(pool, 999).length, pool.length);
  assert.equal(L.pick(pool, 0).length, 0);
});

test('option order is a permutation for choice tasks and untouched otherwise', () => {
  const t = byId('ST4-03');
  for (let s = 1; s < 20; s++) assert.deepEqual(L.optionOrder(t, seeded(s)).slice().sort(), [0, 1, 2, 3]);
  assert.deepEqual(L.optionOrder(byId('ST4-05')), []);
});

// --- grading, one case per format ---

test('single choice: only the correct option counts', () => {
  const t = byId('ST4-03'); // "none of suggested"
  const right = t.options.findIndex(o => o.correct);
  assert.deepEqual(L.grade(t, right), { correct: true, score: 1 });
  assert.equal(L.grade(t, (right + 1) % 4).correct, false);
});

test('multi select: all and only the correct options; partial score = (right − wrong) / all right', () => {
  const t = byId('ST4-02'); // three correct, "independent" is wrong
  const right = t.options.map((o, i) => (o.correct ? i : -1)).filter(i => i >= 0);
  const wrong = t.options.findIndex(o => !o.correct);
  assert.equal(L.grade(t, right).correct, true);
  const partial = L.grade(t, right.slice(0, 2));
  assert.equal(partial.correct, false);
  assert.ok(Math.abs(partial.score - 2 / 3) < 1e-9);
  assert.ok(Math.abs(L.grade(t, [...right.slice(0, 2), wrong]).score - 1 / 3) < 1e-9);
  assert.equal(L.grade(t, [wrong]).score, 0);
});

test('true / false', () => {
  const t = byId('ST4-16'); // same pmf => equal r.v.'s: false
  assert.equal(L.grade(t, false).correct, true);
  assert.equal(L.grade(t, true).correct, false);
});

test('numeric answers accept decimals, commas and fractions', () => {
  const t = byId('ST4-06'); // 0.5
  for (const ok of ['0.5', '0,5', '1/2', ' .5 ']) assert.equal(L.grade(t, ok).correct, true, ok);
  for (const bad of ['0.6', 'half', '', '1/0.3']) assert.equal(L.grade(t, bad).correct, false, bad);
  assert.equal(L.grade(byId('ST5-15'), '51').correct, true);
});

test('match and gap-select are graded per slot', () => {
  const m = byId('ST6-02');
  assert.equal(L.grade(m, m.answer).correct, true);
  const oneOff = [...m.answer];
  oneOff[0] = m.choices.find(c => c !== m.answer[0]);
  assert.deepEqual(L.grade(m, oneOff), { correct: false, score: 2 / 3 });
  const g = byId('ST4-28');
  assert.equal(L.grade(g, ['function', 'from the sample space Ω', 'into the real line R']).correct, true);
  assert.equal(L.grade(g, ['function', null, null]).score, 1 / 3);
});

test('the check button needs a complete response', () => {
  assert.equal(L.isAnswered(byId('ST4-02'), []), false);
  assert.equal(L.isAnswered(byId('ST4-02'), [0]), true);
  assert.equal(L.isAnswered(byId('ST4-06'), '  '), false);
  assert.equal(L.isAnswered(byId('ST4-16'), false), true, 'false is an answer, not an empty response');
  assert.equal(L.isAnswered(byId('ST6-02'), ['x', null, 'y']), false);
  assert.equal(L.isAnswered(byId('ST4-03'), 0), true, 'option index 0 is an answer');
});

// --- progress ---

test('recordResult keeps solved once a task was answered correctly and does not mutate', () => {
  const s0 = {};
  const s1 = L.recordResult(s0, 'ST4-01', false, 1);
  const s2 = L.recordResult(s1, 'ST4-01', true, 2);
  const s3 = L.recordResult(s2, 'ST4-01', false, 3);
  assert.deepEqual(s0, {});
  assert.deepEqual(s3['ST4-01'], { attempts: 3, correct: 1, solved: true, lastCorrect: false, lastAt: 3 });
});

test('summarize groups results by task type', () => {
  const r = [
    { task: byId('ST4-03'), correct: true },
    { task: byId('ST4-04'), correct: false },
    { task: byId('ST5-02'), correct: true }
  ];
  assert.deepEqual(L.summarize(r), {
    total: 3,
    correct: 2,
    byType: { 'recognize-from-experiment': { total: 2, correct: 1 }, 'variance-covariance': { total: 1, correct: 1 } }
  });
});

// --- progress & gamification ---

test('a topic counts towards readiness once 80% of its tasks are solved', () => {
  const t5 = bank.tasks.filter(t => t.topic === 5);
  const need = Math.ceil(t5.length * L.TOPIC_PASS_SHARE);
  const statsFor = n => Object.fromEntries(t5.slice(0, n).map(t => [t.id, { solved: true }]));
  const row = stats => L.topicProgress(bank.tasks, bank.topics, stats).find(p => p.topic === 5);
  assert.equal(row(statsFor(need - 1)).passed, false);
  assert.deepEqual(row(statsFor(need)), { topic: 5, total: t5.length, solved: need, need, passed: true });
  assert.deepEqual(L.topicProgress(bank.tasks, bank.topics, {}).map(p => p.passed), [false, false, false]);
  assert.equal(L.topicProgress([], [{ id: 7 }], {})[0].passed, false, 'an empty topic never counts');
});

test('wrong answers alone never make a topic count', () => {
  const stats = Object.fromEntries(bank.tasks.map(t => [t.id, { attempts: 3, correct: 0, solved: false }]));
  assert.ok(L.topicProgress(bank.tasks, bank.topics, stats).every(p => !p.passed && p.solved === 0));
});

test('mergeStats keeps the best of local and cloud progress per task', () => {
  const local = { a: { attempts: 2, correct: 0, solved: false, lastCorrect: false, lastAt: 5 }, b: { attempts: 1, correct: 1, solved: true, lastCorrect: true, lastAt: 1 } };
  const cloud = { a: { attempts: 1, correct: 1, solved: true, lastCorrect: true, lastAt: 9 }, c: { attempts: 1, correct: 0, solved: false, lastCorrect: false, lastAt: 2 } };
  const m = L.mergeStats(local, cloud);
  assert.deepEqual(m.a, { attempts: 2, correct: 1, solved: true, lastCorrect: true, lastAt: 9 });
  assert.deepEqual(m.b, local.b);
  assert.deepEqual(m.c, cloud.c);
  assert.deepEqual(L.mergeStats(undefined, undefined), {});
  assert.equal(local.a.solved, false, 'inputs are not mutated');
});

test('every formula in the bank renders with the bundled KaTeX (with the app\'s \\mbox macro)', () => {
  const katex = require('../vendor/katex/katex.min.js');
  const macros = { '\\mbox': '\\text{#1}' };
  const texts = bank.tasks.flatMap(t => [t.question, t.hint, ...(t.options || []).map(o => o.text), ...(t.stems || []), ...(t.choices || [])]).filter(Boolean);
  const bad = [];
  for (const s of texts) {
    for (const m of s.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)) {
      try { katex.renderToString(m[1] ?? m[2], { throwOnError: true, displayMode: !!m[2], macros: { ...macros } }); }
      catch (e) { bad.push(`${(m[1] ?? m[2]).slice(0, 40)} → ${e.message.slice(0, 60)}`); }
    }
  }
  assert.deepEqual(bad, []);
});

test('no explanation promises partial credit for a single-choice task', () => {
  const offenders = bank.tasks.filter(t => t.format === 'single' && /partial credit/i.test(t.explanation)).map(t => t.id);
  assert.deepEqual(offenders, []);
});

test('every task type links to colloquium definitions that exist', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'))(window);
  const defIds = new Set(window.PS_DATA.DEFINITIONS_21.map(d => d.id));
  for (const type of bank.types) {
    assert.ok(Array.isArray(type.defs) && type.defs.length > 0, `${type.id} has definitions`);
    type.defs.forEach(id => assert.ok(defIds.has(id), `${type.id}: definition ${id}`));
  }
});

test('every task type explains itself: a short chip label and an "about" text for the type window', () => {
  for (const type of bank.types) {
    assert.ok(type.label && type.label.length <= 34, `${type.id}: label "${type.label}" fits a chip`);
    assert.ok(typeof type.about === 'string' && type.about.length >= 40, `${type.id}: has an "about" text`);
  }
});
