// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { FormulaSheetLogic: L } = require('../js/formula-sheet.js');
const { FORMULA_SHEET: sheet } = require('../js/formula-sheet-data.js');

const rows = L.rows(sheet);
const tableOf = id => sheet.tables.find(t => t.id === id);
const permutationOf = (a, b) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

// --- the sheet data ---

test('the sheet has a discrete and a continuous table with the five printed columns', () => {
  assert.deepEqual(sheet.tables.map(t => t.id), ['discrete', 'continuous']);
  for (const t of sheet.tables) {
    assert.equal(t.columns.length, 5, `${t.id} columns`);
    assert.equal(t.columns[0], 'Distribution');
    assert.ok(t.title, `${t.id} title`);
  }
  assert.deepEqual(tableOf('discrete').rows.map(r => r.id), ['binomial', 'poisson', 'geometric']);
  assert.deepEqual(tableOf('continuous').rows.map(r => r.id), ['uniform', 'exponential', 'normal', 'gamma']);
});

test('7 rows with unique ids, a name, a label and 4 cells each', () => {
  assert.equal(rows.length, 7);
  assert.equal(new Set(rows.map(r => r.id)).size, 7);
  for (const r of rows) {
    assert.ok(r.name && r.label.startsWith(r.name), `${r.id} name/label`);
    assert.equal(typeof r.params, 'string', `${r.id} params`);
    assert.equal(r.cells.length, 4, `${r.id} has p.m.f./p.d.f., m.g.f., mean, variance`);
    r.cells.forEach((c, i) => assert.ok(c.main && c.main.includes('\\('), `${r.id} cell ${i} has a formula`));
  }
  assert.equal(sheet.footer.length, 2);
  assert.ok(sheet.note);
});

test('every formula of the sheet renders with the bundled KaTeX', () => {
  const katex = require('../vendor/katex/katex.min.js');
  const texts = [
    sheet.note, ...sheet.footer,
    ...sheet.tables.flatMap(t => [t.title, ...t.columns]),
    ...rows.flatMap(r => [r.label, r.params, ...r.cells.flatMap(c => [c.main, c.sub])])
  ].filter(Boolean);
  const bad = [];
  let count = 0;
  for (const s of texts) {
    for (const m of s.matchAll(/\\\(([\s\S]*?)\\\)|\\\[([\s\S]*?)\\\]/g)) {
      count++;
      try { katex.renderToString(m[1] ?? m[2], { throwOnError: true, displayMode: !!m[2] }); }
      catch (e) { bad.push(`${(m[1] ?? m[2]).slice(0, 40)} -> ${e.message.slice(0, 60)}`); }
    }
  }
  assert.deepEqual(bad, []);
  assert.equal(count, 54, 'labels, parameters, column heads, 28 cells, their second lines and the footer');
});

test('TeX with < and > survives innerHTML: escaped inside math only, nothing else changes', () => {
  assert.equal(L.mathSafe('\\(0<p<1\\)'), '\\(0&lt;p&lt;1\\)');
  assert.equal(L.mathSafe('<b>x</b> \\(a<b\\) \\[c>d\\]'), '<b>x</b> \\(a&lt;b\\) \\[c&gt;d\\]', 'markup outside math stays markup');
  assert.equal(L.mathSafe('\\(\\begin{cases}1 & a<x\\end{cases}\\)'), '\\(\\begin{cases}1 &amp; a&lt;x\\end{cases}\\)');
  assert.equal(L.mathSafe('\\(a &lt; b\\)'), '\\(a &lt; b\\)', 'an entity is not escaped twice');
  assert.equal(L.mathSafe(undefined), '');

  // On the real sheet "0<p<1", "a<x<b" and "-\infty<x<+\infty" would otherwise open <p> and <x> tags
  const decode = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const texts = [sheet.note, ...sheet.footer, ...sheet.tables.flatMap(t => t.columns),
    ...rows.flatMap(r => [r.label, r.params, ...r.cells.flatMap(c => [c.main, c.sub])])].filter(Boolean);
  assert.ok(texts.some(s => s.includes('<')), 'the sheet does contain < in its TeX');
  for (const s of texts) {
    const safe = L.mathSafe(s);
    assert.ok(!safe.includes('<') && !safe.includes('>'), `no raw angle bracket left in ${s.slice(0, 30)}`);
    assert.equal(decode(safe), s, 'the browser decodes it back to the verbatim text');
  }
});

// --- shuffling ---

test('the seeded generator repeats for a seed and stays in [0, 1)', () => {
  const a = L.seeded(42);
  const b = L.seeded(42);
  const xs = Array.from({ length: 200 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 200 }, () => b()));
  assert.ok(xs.every(x => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, L.seeded(43)));
});

test('shuffle returns a permutation and leaves its input alone', () => {
  const items = ['a', 'b', 'c', 'd', 'e'];
  const out = L.shuffle(items, L.seeded(1));
  assert.ok(permutationOf(out, items));
  assert.deepEqual(items, ['a', 'b', 'c', 'd', 'e']);
});

test('rows are shuffled within their own table, never in the printed order, never as last time', () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rand = L.seeded(seed);
    const first = L.shuffleRows(sheet, rand);
    const second = L.shuffleRows(sheet, rand, first);
    for (const t of sheet.tables) {
      const printed = t.rows.map(r => r.id);
      for (const order of [first, second]) {
        assert.ok(permutationOf(order[t.id], printed), `seed ${seed}: ${t.id} keeps its own rows`);
        assert.notDeepEqual(order[t.id], printed, `seed ${seed}: ${t.id} is not the exam order`);
      }
      assert.notDeepEqual(second[t.id], first[t.id], `seed ${seed}: shuffle again changes ${t.id}`);
    }
  }
  assert.deepEqual(L.shuffleRows(sheet, L.seeded(9)), L.shuffleRows(sheet, L.seeded(9)), 'same seed, same order');
});

test('tiny tables: two rows swap, one row stays', () => {
  const tiny = { tables: [{ id: 'two', rows: [{ id: 'a' }, { id: 'b' }] }, { id: 'one', rows: [{ id: 'z' }] }] };
  for (let seed = 1; seed <= 20; seed++) {
    const order = L.shuffleRows(tiny, L.seeded(seed), { two: ['b', 'a'] });
    assert.deepEqual(order.two, ['b', 'a']);
    assert.deepEqual(order.one, ['z']);
  }
});

// --- level 1: name the rows ---

test('grading the rows: right picks count, wrong and empty ones do not', () => {
  const all = Object.fromEntries(rows.map(r => [r.id, r.id]));
  assert.deepEqual({ correct: L.gradeRows(sheet, all).correct, total: L.gradeRows(sheet, all).total }, { correct: 7, total: 7 });

  const g = L.gradeRows(sheet, { binomial: 'binomial', poisson: 'geometric', exponential: 'gamma', gamma: '' });
  assert.equal(g.correct, 1);
  assert.equal(g.total, 7);
  assert.deepEqual(g.results.binomial, { picked: 'binomial', correct: true });
  assert.deepEqual(g.results.poisson, { picked: 'geometric', correct: false });
  assert.deepEqual(g.results.gamma, { picked: null, correct: false }, 'an empty select is not an answer');
  assert.deepEqual(g.results.normal, { picked: null, correct: false });
  assert.equal(L.gradeRows(sheet).correct, 0);
});

// --- level 2: one cell at a time ---

test('the cell pool is every formula cell: 7 rows x 4 columns, unique keys', () => {
  const cells = L.cells(sheet);
  assert.equal(cells.length, 28);
  assert.equal(new Set(cells.map(c => c.key)).size, 28);
  assert.ok(cells.every(c => [0, 1, 2, 3].includes(c.col) && c.main));
  const geometricMgf = cells.find(c => c.key === 'geometric:1');
  assert.equal(geometricMgf.tableId, 'discrete');
  assert.equal(geometricMgf.sub, '\\(t<-\\log(1-p)\\)');
});

test('a cell is graded on its distribution and its column', () => {
  const cell = L.cells(sheet).find(c => c.key === 'exponential:1'); // lambda / (lambda - t)
  assert.deepEqual(L.answersFor(sheet, cell), [{ rowId: 'exponential', col: 1 }], 'not the gamma m.g.f., which has the power s');
  assert.deepEqual(L.gradeCell(sheet, cell, { rowId: 'exponential', col: 1 }), { correct: true, rowOk: true, colOk: true, answers: [{ rowId: 'exponential', col: 1 }] });
  const wrongRow = L.gradeCell(sheet, cell, { rowId: 'gamma', col: 1 });
  assert.equal(wrongRow.correct, false);
  assert.equal(wrongRow.rowOk, false);
  assert.equal(wrongRow.colOk, true);
  const wrongCol = L.gradeCell(sheet, cell, { rowId: 'exponential', col: 2 });
  assert.deepEqual([wrongCol.correct, wrongCol.rowOk, wrongCol.colOk], [false, true, false]);
  assert.equal(L.gradeCell(sheet, cell).correct, false, 'no pick is wrong');
});

test('the Poisson mean and variance are the same formula, so either column counts', () => {
  const mean = L.cells(sheet).find(c => c.key === 'poisson:2');
  const expected = [{ rowId: 'poisson', col: 2 }, { rowId: 'poisson', col: 3 }];
  assert.deepEqual(L.answersFor(sheet, mean), expected);
  assert.equal(L.gradeCell(sheet, mean, { rowId: 'poisson', col: 3 }).correct, true);
  assert.equal(L.gradeCell(sheet, mean, { rowId: 'poisson', col: 1 }).correct, false);
  const dupes = L.cells(sheet).filter(c => L.answersFor(sheet, c).length > 1).map(c => c.key);
  assert.deepEqual(dupes, ['poisson:2', 'poisson:3'], 'no other formula repeats on the sheet');
});

test('cells come in shuffled passes: every cell once per pass, no immediate repeat', () => {
  const rand = L.seeded(5);
  let deck = [];
  let prev = null;
  const shown = [];
  for (let i = 0; i < 28 * 4; i++) {
    const { cell, deck: rest } = L.drawCell(sheet, deck, rand, prev);
    assert.notEqual(cell.key, prev, `draw ${i} repeats the cell on screen`);
    shown.push(cell.key);
    deck = rest;
    prev = cell.key;
  }
  for (let pass = 0; pass < 4; pass++) {
    assert.equal(new Set(shown.slice(pass * 28, pass * 28 + 28)).size, 28, `pass ${pass} shows every cell once`);
  }
  assert.equal(L.drawCell(sheet, ['nope:9'], rand).cell.key.includes(':'), true, 'unknown keys in a deck are dropped');
});

test('the streak grows on a right answer and resets on a wrong one', () => {
  assert.equal(L.nextStreak(0, true), 1);
  assert.equal(L.nextStreak(4, true), 5);
  assert.equal(L.nextStreak(4, false), 0);
  assert.equal(L.nextStreak(undefined, true), 1);
});

// --- best results, modes and routes ---

test('best results: cleaned from storage, raised only by a better result', () => {
  assert.deepEqual(L.sanitizeBest(null), { rows: 0, cells: 0 });
  assert.deepEqual(L.sanitizeBest({ rows: '5', cells: -3, extra: 1 }), { rows: 5, cells: 0 });
  assert.deepEqual(L.sanitizeBest({ rows: 'x', cells: 2.7 }), { rows: 0, cells: 2 });
  const best = { rows: 5, cells: 3 };
  assert.deepEqual(L.updateBest(best, 'rows', 6), { best: { rows: 6, cells: 3 }, improved: true });
  assert.deepEqual(L.updateBest(best, 'rows', 5), { best, improved: false });
  assert.deepEqual(L.updateBest(best, 'cells', 2), { best, improved: false });
  assert.deepEqual(L.updateBest(best, 'nope', 99), { best, improved: false });
  assert.deepEqual(best, { rows: 5, cells: 3 }, 'not mutated');
});

test('modes and deep links: #/formulas/sheet, sheet-exam, sheet-drill', () => {
  assert.equal(L.normalizeMode('exam'), 'exam');
  assert.equal(L.normalizeMode('bogus'), 'study');
  assert.equal(L.normalizeMode(undefined), 'study');
  assert.equal(L.normalizeLevel('cells'), 'cells');
  assert.equal(L.normalizeLevel('x'), 'rows');
  assert.equal(L.routeFor('study'), 'formulas/sheet');
  assert.equal(L.routeFor('exam'), 'formulas/sheet-exam');
  assert.equal(L.routeFor('drill'), 'formulas/sheet-drill');
  for (const mode of L.MODES) assert.equal(L.modeForRoute(L.routeFor(mode).split('/')[1]), mode);
  assert.equal(L.modeForRoute('sheet-nope'), null);
  assert.equal(L.modeForRoute(''), null);
  assert.equal(L.modeForRoute(null), null);
});

test('the browser build exposes window.formulaSheet.open/close (other sections call them)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../js/formula-sheet.js'), 'utf8');
  const listeners = [];
  const window = { FORMULA_SHEET: sheet, addEventListener: (type, fn) => listeners.push(type) };
  const storage = { getItem: () => JSON.stringify({ best: { rows: 4, cells: 'x' } }), setItem() {} };
  new Function('window', 'localStorage', 'module', src)(window, storage, undefined);
  assert.equal(typeof window.formulaSheet.open, 'function');
  assert.equal(typeof window.formulaSheet.close, 'function');
  assert.equal(typeof window.formulaSheet.openRoute, 'function');
  assert.equal(window.formulaSheet.isOpen, false, 'closed until someone opens it');
  assert.deepEqual(window.formulaSheet.best, { rows: 4, cells: 0 }, 'best results read back from storage');
  assert.deepEqual(listeners, ['popstate'], 'back/forward can close the dialog');
});
