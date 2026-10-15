// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { GetReadyLogic: L } = require('../js/get-ready.js');
const { MIDTERM_PREP: prep } = require('../js/midterm-prep-data.js');
const { SELFTEST_BANK: bank } = require('../js/selftest-data.js');

const PS = (() => {
  const window = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8'))(window);
  return window.PS_DATA;
})();
const items = L.items(prep);
const allOn = (list, at = 1) => Object.fromEntries(list.map(i => [i.id, { on: true, at }]));

// --- the real checklist ---

test('the real checklist: 29 items, 28 on the sheet, Bernoulli is the only extra', () => {
  assert.equal(items.length, 29);
  assert.equal(new Set(items.map(i => i.id)).size, 29);
  assert.deepEqual(items.filter(i => L.isExtra(i)).map(i => i.id), ['x-bernoulli']);
  assert.equal(L.progress(items, {}).total, 28);
  assert.equal(L.find(prep, 'c-moments').text, 'calculate expectation, variance, and moments of a r.v.');
  assert.equal(L.find(prep, 'nope'), null);
});

test('progress never counts Bernoulli', () => {
  assert.deepEqual(L.progress(items, { 'x-bernoulli': { on: true, at: 1 } }), { ticked: 0, total: 28, done: false });
  assert.deepEqual(L.progress(items, allOn(items)), { ticked: 28, total: 28, done: true });
  const sheetOnly = allOn(items.filter(i => !L.isExtra(i)));
  assert.deepEqual(L.progress(items, sheetOnly), { ticked: 28, total: 28, done: true });
  const distributions = prep.groups.find(g => g.id === 'distributions').items;
  assert.deepEqual(L.progress(distributions, allOn(distributions)), { ticked: 6, total: 6, done: true });
});

test('progress counts only items ticked on, ignoring unticks and unknown ids', () => {
  const checks = {
    'd-pmf': { on: true, at: 5 },
    'd-cdf': { on: false, at: 9 },
    'old-item': { on: true, at: 3 },
    'd-pdf': true // malformed: not { on: true }
  };
  assert.deepEqual(L.progress(items, checks), { ticked: 1, total: 28, done: false });
  assert.equal(L.progress([], {}).done, false); // an empty list is never "done"
});

test('a tick or untick is a new object with its time (latest wins in the cloud merge)', () => {
  const before = { 'd-pmf': { on: true, at: 1 } };
  const after = L.toggle(before, 'd-pmf', false, 42);
  assert.deepEqual(after, { 'd-pmf': { on: false, at: 42 } });
  assert.deepEqual(before, { 'd-pmf': { on: true, at: 1 } }, 'input untouched');
  assert.deepEqual(L.toggle(undefined, 'x', 1, 7), { x: { on: true, at: 7 } });
  assert.ok(L.toggle({}, 'x', true).x.at > 0, 'defaults to now');
});

test('"only what I haven\'t ticked" hides ticked items, except those just ticked in that view', () => {
  const list = items.slice(0, 4);
  const checks = { [list[0].id]: { on: true, at: 1 }, [list[1].id]: { on: false, at: 2 } };
  assert.equal(L.visible(list, checks).length, 4);
  assert.deepEqual(L.visible(list, checks, { onlyUnticked: true }).map(i => i.id), list.slice(1).map(i => i.id));
  assert.equal(L.visible(list, checks, { onlyUnticked: true, keep: [list[0].id] }).length, 4);
  assert.deepEqual(L.visible(list, allOn(list), { onlyUnticked: true }), []);
});

// --- exact text: HTML with TeX is shown as written ---

test('safeHtml keeps the formatting tags and turns a "<" inside a formula into an entity', () => {
  assert.equal(L.safeHtml('\\(\\mathsf P(a<X\\le b)\\)'), '\\(\\mathsf P(a&lt;X\\le b)\\)');
  assert.equal(L.safeHtml('on \\(0<x<y\\)'), 'on \\(0&lt;x&lt;y\\)');
  assert.equal(L.safeHtml('<b>Poisson</b> rv<br>• <i>Footnote:</i>'), '<b>Poisson</b> rv<br>• <i>Footnote:</i>');
  assert.equal(L.safeHtml('\\[\\begin{cases}1&x>1\\\\0&\\text{else}\\end{cases}\\]'), '\\[\\begin{cases}1&amp;x&gt;1\\\\0&amp;\\text{else}\\end{cases}\\]');
  assert.equal(L.safeHtml('a <x and b'), 'a &lt;x and b', 'a stray "<" outside formulas is text');
  assert.equal(L.safeHtml('x&nbsp; & y'), 'x&nbsp; &amp; y');
  assert.equal(L.safeHtml('\\(x<b and y>c\\)'), '\\(x&lt;b and y&gt;c\\)', 'no fake tag inside a formula');
  assert.equal(L.safeHtml(undefined), '');
});

test('every text of the real checklist is safe to insert: no "<" opens anything but a formatting tag', () => {
  const tag = new RegExp(`^<\\/?(?:${L.ALLOWED_TAGS.join('|')})(?:\\s[^<>]*)?\\/?>`, 'i');
  const texts = [prep.source.typos, ...prep.groups.map(g => g.title)];
  for (const i of items) texts.push(i.text, i.typo || '', ...i.tips, ...i.quotes.map(q => q.text), ...i.lectureExamples.map(q => q.text));
  for (const t of texts) {
    const out = L.safeHtml(t);
    for (const m of out.matchAll(/</g)) assert.ok(tag.test(out.slice(m.index)), `unsafe "<" in: ${out.slice(m.index, m.index + 40)}`);
    for (const m of out.matchAll(L.MATH_RE)) assert.ok(!/[<>]/.test(m[0]), `raw < or > left in a formula: ${m[0]}`);
    // nothing reworded: decoding the entities gives the source back
    const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    assert.equal(decode(out), decode(t));
  }
});

test('our editorial marks inside quotes are styled as ours, their text unchanged', () => {
  const sic = L.markEditorial('may posses (sic: possess) the same; \\(\\sum_{k\\ge0}\\) (sic: \\(k\\ge1\\)) since');
  assert.match(sic, /<span class="gr-ed" title="Our correction: not on the slide">\(sic: possess\)<\/span>/);
  assert.match(sic, /<span class="gr-ed" title="[^"]*">\(sic: \\\(k\\ge1\\\)\)<\/span>/);
  const ptr = L.markEditorial('analogue (L6 p13): \\(\\mathsf E(g(X))\\), L5 p30; directly via pmf: L4 p33–34, p40)');
  assert.match(ptr, /\(<span class="gr-ed" title="Our pointer to Lecture 6, slide 13: not on this slide">L6 p13<\/span>\):/);
  assert.match(ptr, />L5 p30<\/span>;/);
  assert.match(ptr, /title="Our pointer to Lecture 4, slide 33–34, 40: not on this slide">L4 p33–34, p40<\/span>/);
  assert.equal(L.markEditorial('\\(L5 p30\\) and p.m.f.'), '\\(L5 p30\\) and p.m.f.', 'never inside a formula');
  assert.equal(L.markEditorial('plain text, p.m.f. and Lecture 5'), 'plain text, p.m.f. and Lecture 5');
  // the visible text stays exactly the source text
  const strip = s => s.replace(/<span class="gr-ed" title="[^"]*">|<\/span>/g, '');
  for (const q of items.flatMap(i => [...i.quotes, ...i.lectureExamples])) {
    assert.equal(strip(L.markEditorial(q.text)), q.text);
    for (const m of q.text.matchAll(/\(sic\b/g)) assert.ok(L.markEditorial(q.text).includes(`gr-ed" title="Our correction: not on the slide">(sic`), `${q.lecture} p${q.page} sic marked`);
  }
});

// --- previews, citations, practice ---

test('an excerpt cuts at a word and never inside a formula', () => {
  assert.equal(L.excerpt('Short \\(X\\) question'), 'Short \\(X\\) question');
  const long = 'A fair coin is tossed \\(9\\) times. Denote by \\(X\\) the total number of Heads and by \\(Y\\) the total number of Tails. Choose all correct statements about \\(X+Y\\):';
  const ex = L.excerpt(long, 80);
  assert.ok(ex.endsWith('…'));
  assert.ok(ex.length <= 81);
  assert.ok(long.startsWith(ex.slice(0, -1)), 'a prefix of the question');
  assert.equal(L.excerpt('Gaps: [[1]] and [[2]] here'), 'Gaps: … and … here');
  assert.equal(L.excerpt('Show \\[\\int f = 1\\] now'), 'Show \\(\\int f = 1\\) now');
  assert.equal(L.excerpt('\\(' + 'x+'.repeat(100) + 'x\\) tail', 20), '\\(' + 'x+'.repeat(100) + 'x\\)…', 'a long first formula is kept whole');
  for (const t of bank.tasks) {
    const e = L.excerpt(t.question);
    assert.equal((e.match(/\\\(/g) || []).length, (e.match(/\\\)/g) || []).length, `${t.id}: balanced formulas`);
    assert.ok(e.length <= 160 + 1 || /\\\)…$/.test(e), `${t.id}: short`);
  }
});

test('citations read "Lecture 4 · slide 10" and carry the lecture title', () => {
  assert.deepEqual(L.citation(prep.lectures, { lecture: 'L4', page: 10 }),
    { label: 'Lecture 4 · slide 10', title: 'Lecture 4. Discrete random variables (Autumn 2026)' });
  assert.equal(L.citation(prep.lectures, { lecture: 'L6', page: 8 }).title, prep.lectures.L6);
  assert.deepEqual(L.citation({}, { lecture: 'X1' }), { label: 'X1', title: 'X1' });
  for (const q of items.flatMap(i => [...i.quotes, ...i.lectureExamples])) {
    assert.ok(prep.lectures[q.lecture], `${q.lecture} has a title`);
  }
});

test('practice entries resolve against the real banks; anything that would lead nowhere is dropped', () => {
  const banks = { tasks: bank.tasks, problems: PS.PROBLEMS_BANK };
  const st = L.practice({ kind: 'selftest', id: 'ST4-02' }, banks);
  assert.equal(st.label, 'LMS self-test ST4-02 · Topic 4');
  assert.ok(st.text.startsWith('A fair coin is tossed'));
  const pr = L.practice({ kind: 'problem', id: 7 }, banks);
  assert.equal(pr.title, 'Problem 7: Coin Tosses & First Head Position');
  assert.equal(pr.id, 7);
  assert.deepEqual(L.practice({ kind: 'source', source: 'ps5-2025', sourceTitle: 'Problem set 5 (seminar 5, 2025)', label: 'Problem 2 (a)–(c)', text: 'Let \\(X\\)…' }, banks),
    { kind: 'source', label: 'Problem set 5 (seminar 5, 2025) · Problem 2 (a)–(c)', html: 'Let \\(X\\)…' });
  assert.equal(L.practice({ kind: 'midterm2017', problem: 4, part: 'b' }, banks).label, 'Practice midterm 2017 · Problem 4 (b)');
  assert.equal(L.practice({ kind: 'midterm2017', problem: 2 }, banks).label, 'Practice midterm 2017 · Problem 2');
  assert.equal(L.practice({ kind: 'selftest', id: 'ST9-99' }, banks), null);
  assert.equal(L.practice({ kind: 'problem', id: 999 }, banks), null);
  assert.equal(L.practice({ kind: 'source', text: 'no title' }, banks), null);
  assert.equal(L.practice({ kind: 'midterm2017', problem: 'x' }, banks), null);
  assert.equal(L.practice({ kind: 'video', id: 1 }, banks), null);
  // whatever the data team has filled in so far resolves (the data test guards the ids)
  for (const i of items) for (const e of i.practice) assert.ok(L.practice(e, banks), `${i.id}: ${JSON.stringify(e)}`);
});

test('the counts under an item', () => {
  assert.deepEqual(L.metaParts({ quotes: 5, examples: 1, practice: 2, notes: 1 }), ['5 quotes', '1 example', '2 practice', 'our note']);
  assert.deepEqual(L.metaParts({ quotes: 1, examples: 3, notes: 2 }), ['1 quote', '3 examples', 'our notes']);
  assert.deepEqual(L.metaParts({}), []);
});
