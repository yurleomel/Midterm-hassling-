// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { MockMidtermLogic: M } = require('../js/mock-midterm.js');
const { SELFTEST_BANK: bank } = require('../js/selftest-data.js');
const { MIDTERM_PREP: prep } = require('../js/midterm-prep-data.js');
const { PAPER_2017 } = require('./fixtures/midterm-paper-2017.js');

// data.js and problem-directions.js fill window.PS_DATA; evaluate both with a stand-in window
const PS = (() => {
  const window = {};
  for (const file of ['data.js', 'problem-directions.js']) {
    new Function('window', fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'))(window);
  }
  return window.PS_DATA;
})();
const DATA = { bank, problems: PS.PROBLEMS_BANK, defs: PS.DEFINITIONS_21, prep, theory: PS.PROBLEM_THEORY };
const SLOT_IDS = M.SLOTS.flatMap(s => s.ids);
const bankProblem = id => PS.PROBLEMS_BANK.find(p => p.id === id);
const taskById = id => bank.tasks.find(t => t.id === id);
const seeds = Array.from({ length: 300 }, (_, i) => 1000 + i * 7919);

// --- points and parsing ---

test('10 points split over the parts: equal integer shares, the remainder to the last part', () => {
  assert.deepEqual(M.splitPoints(10, 1), [10]);
  assert.deepEqual(M.splitPoints(10, 2), [5, 5]);
  assert.deepEqual(M.splitPoints(10, 3), [3, 3, 4]);
  assert.deepEqual(M.splitPoints(10, 4), [2, 2, 2, 4]);
  assert.deepEqual(M.splitPoints(10, 6), [1, 1, 1, 1, 1, 5]);
  assert.deepEqual(M.splitPoints(10, 0), [10]);
});

test('every slot problem splits into its parts (a), (b), … and every part has its own worked solution', () => {
  for (const id of SLOT_IDS) {
    const p = bankProblem(id);
    assert.ok(p, `problem ${id} is in the bank`);
    const { intro, parts } = M.parseParts(p.statement);
    assert.ok(intro.length > 20, `problem ${id} has a preamble`);
    assert.ok(parts.length >= 2, `problem ${id} has parts`);
    assert.deepEqual(parts.map(x => x.label), 'abcdefgh'.slice(0, parts.length).split(''), `problem ${id}: consecutive labels`);
    parts.forEach(x => assert.ok(x.text.length > 5, `problem ${id} (${x.label}) has text`));
    const sol = M.parseSolution(p.solution);
    for (const x of parts) assert.ok(sol.parts[x.label]?.body.length > 10, `problem ${id}: solution of (${x.label})`);
  }
});

test('parsing keeps multi-line parts and the setup before part (a)', () => {
  const { intro, parts } = M.parseParts('Setup line.\n(a) First;\nmore of the first\n(b) Second.');
  assert.equal(intro, 'Setup line.');
  assert.deepEqual(parts, [{ label: 'a', text: 'First;\nmore of the first' }, { label: 'b', text: 'Second.' }]);
  const sol = M.parseSolution('Let $X$ be.\n\n**(a) Value of $a$:**\nbody a\n**(b) Rest:** inline b\nmore');
  assert.equal(sol.intro, 'Let $X$ be.');
  assert.deepEqual(sol.parts.a, { title: 'Value of $a$', body: 'body a' });
  assert.deepEqual(sol.parts.b, { title: 'Rest', body: 'inline b\nmore' });
});

test('bank markdown becomes safe HTML: escaped text, bold, lists, tables, TeX left for KaTeX', () => {
  const html = M.mdToHtml('If $X < Y$ then **this** & that\n- one\n- two\n\n1. first\n$$f(x)=\\begin{cases} a, & x<1 \\end{cases}$$');
  assert.match(html, /\$X &lt; Y\$/);
  assert.match(html, /<strong>this<\/strong> &amp; that/);
  assert.match(html, /<ul class="mm-list"><li>one<\/li><li>two<\/li><\/ul>/);
  assert.match(html, /<ol class="mm-list"><li>first<\/li><\/ol>/);
  assert.match(html, /<p>\$\$f\(x\)=\\begin\{cases\} a, &amp; x&lt;1 \\end\{cases\}\$\$<\/p>/);
  assert.ok(!/<(?!\/?(p|strong|ul|ol|li)\b)/.test(html), 'no other tags');

  const table = M.mdToHtml(bankProblem(18).statement);
  assert.match(table, /<table class="mm-table">/);
  assert.equal((table.match(/<tr>/g) || []).length, 4, 'a header row and three rows of the joint table');
  assert.deepEqual(M.tableCells('| $|x|$ | **$1/8$** |'), ['$|x|$', '**$1/8$**'], 'pipes inside TeX stay in their cell');
});

// --- definitions: lecture wording ---

test('every definition has a prompt; lecture references resolve to exactly one Definition quote', () => {
  const items = prep.groups.flatMap(g => g.items);
  for (const d of PS.DEFINITIONS_21) assert.ok(M.DEF_PROMPTS[d.id], `prompt for definition ${d.id}`);
  for (const [id, ref] of Object.entries(M.DEF_REFS)) {
    const item = items.find(i => i.id === ref.item);
    assert.ok(item, `definition ${id}: checklist item ${ref.item}`);
    const hits = item.quotes.filter(q => q.kind === 'Definition' && q.lecture === ref.lecture && q.page === ref.page && (!ref.has || q.text.includes(ref.has)));
    assert.equal(hits.length, 1, `definition ${id}: one matching quote`);
  }
});

test('a definition reference is the lecturer’s quote with its citation, else the labelled colloquium card', () => {
  const quote = M.defReference(7, DATA);
  assert.equal(quote.kind, 'lecture');
  assert.match(quote.text, /<b>continuous<\/b>/);
  assert.equal(M.citation(quote), 'Lecture 6 · slide 6');
  assert.equal(M.citation({ lecture: 'L4', page: 19 }), 'Lecture 4 · slide 19');
  assert.equal(M.defReference(1, DATA).text.includes('is <b>discrete</b>'), true, 'the discrete-r.v. quote, not the r.v. one');

  const card = M.defReference(18, DATA);
  assert.equal(card.kind, 'colloquium');
  assert.equal(card.defId, 18);
  assert.match(card.text, /\$\$f_Y\(y\)/);
  assert.equal(M.defReference(99, DATA), null);
});

// --- assembling a new mock ---

test('a new mock is reproducible from its seed', () => {
  assert.deepEqual(M.pickMock(42, DATA), M.pickMock(42, DATA));
  const distinct = new Set(seeds.slice(0, 20).map(s => JSON.stringify(M.pickMock(s, DATA))));
  assert.ok(distinct.size > 15, 'different seeds give different papers');
});

test('problem 1: five self-test tasks of different types, gradable formats, a T/F item last, topics 4–6 covered', () => {
  for (const seed of seeds) {
    const picks = M.pickMock(seed, DATA);
    const tasks = picks.choice.map(c => taskById(c.id));
    assert.equal(tasks.length, 5);
    assert.equal(new Set(tasks.map(t => t.type)).size, 5, `seed ${seed}: five types`);
    tasks.forEach(t => assert.ok(M.CHOICE_FORMATS.includes(t.format), `seed ${seed}: ${t.id} is ${t.format}`));
    assert.ok(tasks.some(t => t.format === 'tf'), `seed ${seed}: a T/F item`);
    const firstTf = tasks.findIndex(t => t.format === 'tf');
    assert.ok(tasks.slice(firstTf).every(t => t.format === 'tf'), `seed ${seed}: T/F items last`);
    assert.deepEqual([...new Set(tasks.map(t => t.topic))].sort(), [4, 5, 6], `seed ${seed}: every topic`);
    picks.choice.forEach((c, i) => {
      assert.deepEqual([...c.order].sort((a, b) => a - b), (tasks[i].options || []).map((_, k) => k), `seed ${seed}: option order is a permutation`);
    });
  }
});

test('problem 2: five different definitions in course order; problems 3–6: one per block, never the 2017 paper', () => {
  const seen = new Set();
  for (const seed of seeds) {
    const { defs, problems } = M.pickMock(seed, DATA);
    assert.equal(defs.length, 5);
    assert.equal(new Set(defs).size, 5);
    assert.deepEqual(defs, [...defs].sort((a, b) => a - b));
    defs.forEach(id => assert.ok(id >= 1 && id <= 21));
    assert.equal(problems.length, 4);
    problems.forEach((id, i) => {
      assert.ok(M.SLOTS[i].ids.includes(id), `seed ${seed}: problem ${id} belongs to block ${M.SLOTS[i].id}`);
      assert.ok(!M.PAPER_2017_PROBLEMS.includes(id));
      seen.add(id);
    });
  }
  assert.deepEqual([...seen].sort((a, b) => a - b), [...SLOT_IDS].sort((a, b) => a - b), 'every slot problem comes up');
});

test('the assembled paper has the real format: 6 problems, 5 + 5 + 4 × 10 = 50 points, parts adding up', () => {
  for (const seed of seeds.slice(0, 40)) {
    const paper = M.paperFromPicks(M.pickMock(seed, DATA), DATA);
    assert.deepEqual(paper.problems.map(p => p.n), [1, 2, 3, 4, 5, 6]);
    assert.deepEqual(paper.problems.map(p => p.points), [5, 5, 10, 10, 10, 10]);
    assert.equal(M.totals(paper).total, 50);
    for (const p of paper.problems.slice(2)) {
      assert.equal(p.parts.reduce((s, x) => s + x.points, 0), 10, `seed ${seed}: problem ${p.bankId}`);
      p.parts.forEach(x => assert.ok(x.solution.length > 0, `seed ${seed}: solution of ${p.bankId}(${x.label})`));
      assert.ok(p.defs.length > 0 && p.notes.length === 1, `seed ${seed}: theory links of ${p.bankId}`);
    }
    for (const it of paper.problems[1].items) {
      assert.ok(it.prompt && it.reference, `seed ${seed}: definition ${it.defs[0]} has a prompt and a reference`);
    }
    for (const it of paper.problems[0].items) assert.ok(it.task && it.defs.length > 0);
  }
});

test('a stored mock rebuilds exactly, and unknown ids are skipped instead of breaking the review', () => {
  const picks = M.pickMock(7, DATA);
  assert.deepEqual(M.paperFromPicks(picks, DATA), M.paperFromPicks(JSON.parse(JSON.stringify(picks)), DATA));
  const broken = M.paperFromPicks({ ...picks, choice: [...picks.choice, { id: 'ST9-99', order: [] }], problems: [...picks.problems, 999] }, DATA);
  assert.equal(broken.problems[0].items.length, 5);
  assert.equal(broken.problems.length, 6);
});

// --- grading ---

const p1 = PAPER_2017.problems[0];
const item = id => p1.items.find(i => i.id === id);

test('problem 1 of the paper: options, "(d) your variant" checked by the student, true/false', () => {
  assert.deepEqual(M.gradeChoice(item('1.1'), { pick: 2 }), { status: 'right', points: 1 });
  assert.deepEqual(M.gradeChoice(item('1.1'), { pick: 0 }), { status: 'wrong', points: 0 });
  assert.deepEqual(M.gradeChoice(item('1.1'), {}), { status: 'blank', points: 0 });
  assert.deepEqual(M.gradeChoice(item('1.1'), { pick: 'other', other: '' }), { status: 'blank', points: 0 }, 'an empty variant is no answer');
  assert.deepEqual(M.gradeChoice(item('1.1'), { pick: 'other', other: '5' }), { status: 'wrong', points: 0 });
  // 1.3: the right answer is not among (a)–(c)
  assert.deepEqual(M.gradeChoice(item('1.3'), { pick: 2 }), { status: 'wrong', points: 0 });
  assert.deepEqual(M.gradeChoice(item('1.3'), { pick: 'other', other: 'N(0, 1/4)' }), { status: 'check', points: 0 });
  assert.equal(M.gradeChoice(item('1.3'), { pick: 'other', other: 'N(0, 1/4)' }, 1).points, 1);
  assert.equal(M.gradeChoice(item('1.3'), { pick: 'other', other: 'N(0, 1/2)' }, 0).status, 'wrong');
  assert.deepEqual(M.gradeChoice(item('1.4'), { pick: false }), { status: 'right', points: 1 });
  assert.deepEqual(M.gradeChoice(item('1.4'), { pick: true }), { status: 'wrong', points: 0 });
});

test('problem 1 of a new mock is graded by the self-test rules, partial credit in half points', () => {
  const single = { id: '1.1', points: 1, task: bank.tasks.find(t => t.format === 'single') };
  const right = single.task.options.findIndex(o => o.correct);
  assert.equal(M.gradeChoice(single, { pick: right }).status, 'right');
  assert.equal(M.gradeChoice(single, { pick: (right + 1) % single.task.options.length }).points, 0);
  const multi = { id: '1.2', points: 1, task: bank.tasks.find(t => t.format === 'multi' && t.options.filter(o => o.correct).length === 2) };
  const [r1, r2] = multi.task.options.map((o, i) => (o.correct ? i : -1)).filter(i => i >= 0);
  assert.deepEqual(M.gradeChoice(multi, { pick: [r1, r2] }), { status: 'right', points: 1 });
  assert.deepEqual(M.gradeChoice(multi, { pick: [r1] }), { status: 'partial', points: 0.5 });
  assert.deepEqual(M.gradeChoice(multi, { pick: [] }), { status: 'blank', points: 0 });
  const numeric = { id: '1.3', points: 1, task: bank.tasks.find(t => t.format === 'numeric') };
  assert.equal(M.gradeChoice(numeric, { pick: String(numeric.task.answer) }).status, 'right');
  assert.equal(M.gradeChoice(numeric, { pick: '  ' }).status, 'blank');
  const tf = { id: '1.4', points: 1, task: bank.tasks.find(t => t.format === 'tf') };
  assert.equal(M.gradeChoice(tf, { pick: tf.task.answer }).status, 'right');
});

test('totals: auto-graded problem 1, self-grades in half points, pending grades counted', () => {
  const answers = { choice: { '1.1': { pick: 2 }, '1.2': { pick: 0 }, '1.3': { pick: 'other', other: 'N(0,1/4)' }, '1.4': { pick: false } }, defs: {}, notes: {}, done: {} };
  const empty = M.totals(PAPER_2017, answers, {});
  assert.equal(empty.total, 50);
  assert.equal(empty.score, 2);
  assert.equal(empty.perProblem[0].pending, 1, 'the (d) variant waits for a check');
  assert.equal(empty.pending, 1 + 5 + 4 + 4 + 3 + 4);

  const marks = { '1.3': 1, '2.1': 1, '2.2': 0.5, '2.3': 0, '2.4': 1, '2.5': 1, '3a': 3, '3b': 2.5, '3c': 2, '3d': 2, '4a': 2, '4b': 2, '4c': 1.5, '4d': 0,
    '5a': 3, '5b': 3, '5c': 4, '6a': 2, '6b': 9, '6c': -1, '6d': 1.2 };
  const t = M.totals(PAPER_2017, answers, marks);
  assert.equal(t.pending, 0);
  assert.deepEqual(t.perProblem.map(r => r.got), [3, 3.5, 9.5, 5.5, 10, 7], 'marks are clamped to 0…max in half points');
  assert.equal(t.score, 38.5);
  assert.equal(t.percent, 77);
  assert.equal(M.formatPoints(38.5), '38.5');
  assert.equal(M.formatPoints(9), '9');
  assert.equal(M.clampMark(1.3, 2), 1.5);
  assert.equal(M.clampMark('x', 2), 0);
});

test('weak spots: fully graded problems under 50%, with the theory to review', () => {
  const marks = { '2.1': 0, '2.2': 0, '2.3': 1, '2.4': 0, '2.5': 0, '4a': 1, '4b': 0, '4c': 0, '4d': 0, '6a': 2 };
  const t = M.totals(PAPER_2017, { choice: {} }, marks);
  const weak = M.weakSpots(PAPER_2017, t, PS.PROBLEM_THEORY);
  assert.deepEqual(weak.map(w => w.n), [1, 2, 4], 'problem 6 is only partly graded, so it is not judged yet');
  assert.deepEqual(weak.find(w => w.n === 4).defs, [6, 20, 19, 17]);
  assert.deepEqual(weak.find(w => w.n === 4).notes, ['topic-6']);
  assert.deepEqual(weak.find(w => w.n === 2).defs, [7, 15, 16, 12, 10, 3]);
  // a bank problem without links of its own uses the problem bank's
  assert.deepEqual(M.theoryOf({ kind: 'written', bankId: 19, defs: [], notes: [] }, PS.PROBLEM_THEORY), { defs: [11, 18], notes: ['topic-9'] });
});

test('answered markers for the problem chips', () => {
  const answers = { choice: { '1.1': { pick: 2 }, '1.3': { pick: 'other', other: ' ' } }, defs: { '2.1': 'F is differentiable', '2.2': '  ' }, notes: { 4: 'a = 3' }, done: { 3: true } };
  assert.deepEqual(M.progress(PAPER_2017.problems[0], answers), { done: 1, total: 5 });
  assert.deepEqual(M.progress(PAPER_2017.problems[1], answers), { done: 1, total: 5 });
  assert.deepEqual(M.progress(PAPER_2017.problems[2], answers), { done: 1, total: 1 });
  assert.deepEqual(M.progress(PAPER_2017.problems[3], answers), { done: 1, total: 1 });
  assert.deepEqual(M.progress(PAPER_2017.problems[4], answers), { done: 0, total: 1 });
});

// --- timer ---

test('timer: time left from startedAt, clock format, stages', () => {
  const s = { startedAt: 1_000_000, durationMin: 80 };
  assert.equal(M.endsAt(s), 1_000_000 + 80 * 60000);
  assert.equal(M.timeLeft(s, 1_000_000), 80 * 60000);
  assert.equal(M.timeLeft(s, 1_000_000 + 81 * 60000), 0);
  assert.equal(M.formatClock(80 * 60000), '1:20:00');
  assert.equal(M.formatClock(59 * 60000 + 59000), '59:59');
  assert.equal(M.formatClock(9 * 60000 + 4500), '9:05', 'seconds round up');
  assert.equal(M.formatClock(0), '0:00');
  assert.equal(M.stage(11 * 60000), 'calm');
  assert.equal(M.stage(10 * 60000), 'soon');
  assert.equal(M.stage(60000), 'last');
});

test('timer warnings come once each, at 10 minutes and at 1 minute', () => {
  assert.equal(M.dueWarning(11 * 60000, []), null);
  assert.deepEqual(M.dueWarning(10 * 60000 - 1, []), { minutes: 10, warned: [10] });
  assert.equal(M.dueWarning(5 * 60000, [10]), null);
  assert.deepEqual(M.dueWarning(59000, [10]), { minutes: 1, warned: [10, 1] });
  assert.deepEqual(M.dueWarning(30000, []), { minutes: 1, warned: [10, 1] }, 'reopened in the last minute: only the urgent one');
  assert.equal(M.dueWarning(30000, [10, 1]), null);
});

test('time used is capped at the duration (a paper handed in after the end counts as on time)', () => {
  const s = { startedAt: 0, durationMin: 60 };
  assert.equal(M.usedMs(s, 42 * 60000), 42 * 60000);
  assert.equal(M.usedMs(s, 3 * 3600000), 60 * 60000);
});

// --- sessions and attempts ---

test('a session survives a round trip through localStorage; anything malformed is refused', () => {
  const s = M.newSession({ paper: '2017', title: PAPER_2017.title, durationMin: 80, now: 1_700_000_000_000, rand: () => 0.5 });
  assert.match(s.id, /^mm-[0-9a-z]+$/);
  assert.equal(s.phase, 'exam');
  assert.ok(M.validSession(JSON.parse(JSON.stringify(s))));
  assert.ok(!M.validSession(null));
  assert.ok(!M.validSession({ ...s, durationMin: 75 }));
  assert.ok(!M.validSession({ ...s, phase: 'done' }));
  assert.ok(!M.validSession({ ...s, paper: 'new' }), 'a new mock needs its picks');
  assert.ok(M.validSession({ ...s, paper: 'new', picks: M.pickMock(1, DATA) }));
});

test('the saved attempt holds what the history and a read-only review need', () => {
  const picks = M.pickMock(5, DATA);
  const paper = M.paperFromPicks(picks, DATA);
  const s = { ...M.newSession({ paper: 'new', title: paper.title, durationMin: 60, picks, now: 0 }), phase: 'review', finishedAt: 50 * 60000 };
  s.marks = { '2.1': 1 };
  const rec = M.attemptRecord(s, paper, M.totals(paper, s.answers, s.marks));
  assert.deepEqual(Object.keys(rec).sort(), ['answers', 'durationMin', 'finishedAt', 'id', 'marks', 'paper', 'perProblem', 'picks', 'score', 'startedAt', 'timedOut', 'title', 'total', 'usedMs'].sort());
  assert.equal(rec.score, 1);
  assert.equal(rec.total, 50);
  assert.equal(rec.usedMs, 50 * 60000);
  assert.deepEqual(rec.picks, picks);
  assert.equal(rec.perProblem.length, 6);
  const old = M.attemptRecord({ ...s, paper: '2017', picks: undefined }, PAPER_2017, M.totals(PAPER_2017, {}, {}));
  assert.ok(!('picks' in old), 'the 2017 paper needs no picks');
});

test('history: newest first, malformed entries ignored, best share of points highlighted', () => {
  const attempts = {
    a: { id: 'a', finishedAt: 100, score: 30, total: 50 },
    b: { id: 'b', finishedAt: 300, score: 41.5, total: 50 },
    c: { id: 'c', finishedAt: 200, score: 41.5, total: 50 },
    d: { id: 'd', startedAt: 5 },
    e: null
  };
  assert.deepEqual(M.history(attempts).map(a => a.id), ['b', 'c', 'a']);
  assert.equal(M.bestId(attempts), 'c', 'a tie goes to the earlier attempt');
  assert.equal(M.bestId({}), null);
});

// --- the paper data (fixture now, js/midterm-papers.js once transcribed) ---

test('the 2017 paper fixture follows the schema the section reads', () => {
  const p = PAPER_2017;
  assert.equal(p.totalPoints, 50);
  assert.deepEqual(p.problems.map(x => [x.n, x.points, x.kind]), [[1, 5, 'choice'], [2, 5, 'definitions'], [3, 10, 'written'], [4, 10, 'written'], [5, 10, 'written'], [6, 10, 'written']]);
  for (const x of p.problems) {
    const parts = x.items || x.parts;
    assert.equal(parts.reduce((s, y) => s + y.points, 0), x.points, `problem ${x.n} parts add up`);
  }
  for (const it of p.problems[0].items) {
    assert.ok(it.prompt && it.solution);
    if (it.tf) assert.equal(typeof it.answer, 'boolean');
    else assert.ok(it.answer === 'other' ? it.otherAnswer : Number.isInteger(it.answer) && it.answer < it.options.length);
  }
  for (const it of p.problems[1].items) assert.ok(it.reference.text && it.reference.lecture && it.reference.page && it.defs.length);
  for (const x of p.problems.slice(2)) {
    assert.ok(x.statement && x.parts.every(y => y.label && y.text && y.solution));
    assert.ok(PS.PROBLEMS_BANK.some(b => b.id === x.bankId), `problem ${x.n}: bank problem ${x.bankId}`);
  }
});
