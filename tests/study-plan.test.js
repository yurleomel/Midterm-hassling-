// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { StudyPlan: P } = require('../js/study-plan.js');

// js/data.js assigns window.PS_DATA; evaluate it with a stand-in window
const PS = (() => {
  const window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'))(window);
  return window.PS_DATA;
})();
const DAYS = PS.SCHEDULE_DAYS;
// Sections a link can open: the tab panels of index.html (#tab-<name>)
const sections = new Set([...fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8').matchAll(/id="tab-([a-z]+)"/g)].map(m => m[1]));
const TASKS = DAYS.flatMap(d => d.tasks);
const task = id => TASKS.find(t => t.id === id);

test('id lists from the schedule targets', () => {
  assert.deepEqual(P.parseIdList('1-6'), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(P.parseIdList('1,2,7'), [1, 2, 7]);
  assert.deepEqual(P.parseIdList('7-11,17-19,21'), [7, 8, 9, 10, 11, 17, 18, 19, 21]);
  assert.deepEqual(P.parseIdList('12-16,20'), [12, 13, 14, 15, 16, 20]);
  assert.deepEqual(P.parseIdList(''), []);
});

test('every plan link points at something that exists (no dead ends)', () => {
  const defIds = new Set(PS.DEFINITIONS_21.map(d => d.id));
  const probIds = new Set(PS.PROBLEMS_BANK.map(p => p.id));
  const topicIds = new Set(PS.TOPICS_LIST.map(t => t.id));
  const noteIds = new Set(PS.TOPICS_NOTES.map(t => t.id));
  for (const t of TASKS) {
    const link = P.linkFor(t);
    assert.notEqual(link.kind, 'manual', `${t.id} has no destination`);
    if (link.kind === 'definitions') link.ids.forEach(id => assert.ok(defIds.has(id), `${t.id}: definition ${id}`));
    if (link.kind === 'problems') link.ids.forEach(id => assert.ok(probIds.has(id), `${t.id}: problem ${id}`));
    if (link.kind === 'quiz') link.topics.forEach(id => assert.ok(topicIds.has(id), `${t.id}: topic test ${id}`));
    if (link.kind === 'topic') assert.ok(noteIds.has(link.topic), `${t.id}: notes ${link.topic}`);
    if (link.kind === 'mock') assert.ok(sections.has('mock'), `${t.id}: the Mock midterm section`);
    assert.ok(P.linkLabel(link), `${t.id} has a label`);
  }
});

test('the full midterm simulation opens the Mock midterm and ticks off with a finished attempt', () => {
  const t = task('d5-t4');
  assert.deepEqual(P.linkFor(t), { kind: 'mock' });
  assert.equal(P.linkLabel(P.linkFor(t)), 'Mock midterm');
  assert.equal(P.isManual(P.linkFor(t)), false, 'it checks itself off from the saved attempts');
  assert.deepEqual(P.status(t, {}), { done: false, have: null, need: null });
  assert.equal(P.status(t, { mockFinished: 0 }).done, false);
  assert.equal(P.status(t, { mockFinished: 1 }).done, true);
});

test('contextFromApp counts the finished mock attempts of the readiness state', () => {
  global.window = global.window || {};
  const ctx = P.contextFromApp({ mockAttempts: { a: { finishedAt: 5, score: 30 }, b: { startedAt: 1 }, c: null } });
  assert.equal(ctx.mockFinished, 1);
  assert.equal(P.contextFromApp({}).mockFinished, 0);
});

test('targets from the data become the right links', () => {
  assert.deepEqual(P.linkFor(task('d1-t1')), { kind: 'definitions', ids: [1, 2, 3, 4, 5, 6] });
  assert.deepEqual(P.linkFor(task('d1-t3')), { kind: 'problems', ids: [1, 2, 7] });
  assert.deepEqual(P.linkFor(task('d1-t4')), { kind: 'quiz', topics: [1, 2, 3] });
  assert.deepEqual(P.linkFor(task('d1-t5')), { kind: 'pomodoro', sessions: 3 });
  assert.deepEqual(P.linkFor(task('d2-t6')), { kind: 'pomodoro', sessions: 4 });
  assert.equal(P.linkLabel(P.linkFor(task('d1-t1'))), 'Definitions 1–6');
  assert.equal(P.linkLabel(P.linkFor(task('d1-t3'))), 'Problems 1, 2, 7');
});

test('task status follows real results', () => {
  const ctx = { defScores: { 1: 8, 2: 6, 3: 5 }, problemsMastered: { 1: true, 7: true }, topicTests: { 1: { solved: true } }, planChecks: {} };
  assert.deepEqual(P.status(task('d1-t1'), ctx), { done: false, have: 2, need: 6 });
  assert.deepEqual(P.status(task('d1-t3'), ctx), { done: false, have: 2, need: 3 });
  assert.equal(P.status(task('d1-t3'), { ...ctx, problemsMastered: { 1: true, 2: true, 7: true } }).done, true);
  assert.deepEqual(P.status(task('d1-t4'), ctx), { done: false, have: 1, need: 3 });
  assert.equal(P.status(task('d1-t2'), ctx).done, false, 'CDF definition scored 5 < 6');
});

test('pomodoro tasks count the sessions of that plan day only', () => {
  const ctx = { pomodoroByDate: { '2026-10-11': 2, '2026-10-12': 5 } };
  assert.deepEqual(P.status(task('d1-t5'), ctx, '2026-10-11'), { done: false, have: 2, need: 3 });
  assert.deepEqual(P.status(task('d2-t6'), ctx, '2026-10-12'), { done: true, have: 4, need: 4 });
});

test('manual, exam and mistakes tasks', () => {
  const t = task('d3-t5'); // colloquium mock → exam ticket, ticked by hand
  assert.equal(P.isManual(P.linkFor(t)), true);
  assert.equal(P.status(t, { planChecks: {} }).done, false);
  assert.equal(P.status(t, { planChecks: { 'd3-t5': true } }).done, true);
  assert.equal(P.status(task('d4-t2'), { grades: { colloquium: { grade: '24/25' } } }).done, true);
  assert.equal(P.status(task('d6-t3'), { grades: {} }).done, false);
  assert.deepEqual(P.status(task('d5-t5'), { mistakesCount: 3 }), { done: false, have: null, need: null, left: 3 });
  assert.equal(P.status(task('d5-t5'), { mistakesCount: 0 }).done, true);
});

test('a day is done only when every task is', () => {
  const day1 = DAYS[0];
  const all = {
    defScores: Object.fromEntries([1, 2, 3, 4, 5, 6].map(i => [i, 7])),
    problemsMastered: { 1: true, 2: true, 7: true },
    topicTests: { 1: { solved: true }, 2: { solved: true }, 3: { solved: true } },
    pomodoroByDate: { '2026-10-11': 3 }
  };
  assert.equal(P.dayDone(day1, all, '2026-10-11'), true);
  assert.equal(P.dayDone(day1, { ...all, pomodoroByDate: {} }, '2026-10-11'), false);
});

test('day dates count back from the midterm, across month ends', () => {
  const nums = DAYS.map(d => d.day);
  const dates = P.dayDates('2026-10-16T08:30', nums);
  assert.equal(dates[6], '2026-10-16');
  assert.equal(dates[1], '2026-10-11');
  const nov = P.dayDates('2026-11-02T08:30', nums);
  assert.equal(nov[1], '2026-10-28');
  assert.deepEqual(P.dayDates('not a date', nums), {});
});

test('the plan opens on today, else the next day, else the last one', () => {
  const dates = P.dayDates('2026-10-16T08:30', DAYS.map(d => d.day));
  const during = P.timeline(dates, '2026-10-15');
  assert.equal(during.focus, 5);
  assert.equal(during.state[5], 'today');
  assert.equal(during.state[4], 'past');
  assert.equal(during.state[6], 'upcoming');
  assert.equal(P.timeline(dates, '2026-10-01').focus, 1);
  assert.equal(P.timeline(dates, '2026-12-01').focus, 6);
});
