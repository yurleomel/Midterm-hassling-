// ========================================================
// Exam formula sheet: the table of distributions handed out at Midterm 2 (data: js/formula-sheet-data.js).
// At the exam it comes WITHOUT the distribution names, so this dialog trains recognising every row:
//   study  the sheet as printed, with the labels;
//   exam   exactly as handed out: the Distribution column is empty (option: hide the column headers too);
//   drill  level 1 "Name the rows": rows shuffled within each table, pick every name, check;
//          level 2 "One cell at a time": one formula, pick its distribution and its column, keep a streak.
// Best results stay in this browser (localStorage), not in the synced readiness state.
//
// Public API (other sections call it, also before the app has initialised):
//   window.formulaSheet.open({ mode: 'study' | 'exam' | 'drill', level?: 'rows' | 'cells', hideHeaders?: bool,
//                              locked?: bool, opener?: Element })
//     locked: hides the view switch and "Show the names", e.g. for the sheet on the mock midterm exam screen
//   window.formulaSheet.close()
// Deep links: #/formulas/sheet (study) · #/formulas/sheet-exam · #/formulas/sheet-drill
// ========================================================

// Pure logic: DOM-free so it can be unit-tested with `node --test`.
const FormulaSheetLogic = {
  MODES: ['study', 'exam', 'drill'],
  LEVELS: ['rows', 'cells'],
  // The four formula columns of both tables (cell index 0-3); the Distribution column is the row label
  COLUMNS: ['P.m.f. / p.d.f.', 'M.g.f.', 'Mean', 'Variance'],
  ROUTES: { study: 'sheet', exam: 'sheet-exam', drill: 'sheet-drill' },

  normalizeMode(mode) {
    return this.MODES.includes(mode) ? mode : 'study';
  },

  normalizeLevel(level) {
    return this.LEVELS.includes(level) ? level : 'rows';
  },

  routeFor(mode) {
    return `formulas/${this.ROUTES[this.normalizeMode(mode)]}`;
  },

  // 'sheet' -> 'study', 'sheet-drill' -> 'drill'; anything else -> null
  modeForRoute(segment) {
    return this.MODES.find(m => this.ROUTES[m] === segment) || null;
  },

  // The data is HTML with TeX in \( \) / \[ \]. TeX such as 0<p<1 has to reach KaTeX as text: inserted as raw
  // HTML, the browser reads "<p" as a tag and swallows the rest of the formula. So inside math only, escape
  // < and > and every & that is not already an entity.
  mathSafe(html) {
    return String(html ?? '').replace(/\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/g, math => math
      .replace(/&(?![a-z]+;|#\d+;|#x[0-9a-f]+;)/gi, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;'));
  },

  // Every row of both tables in printed order, with the id of its table
  rows(sheet) {
    return (sheet?.tables || []).flatMap(t => t.rows.map(r => ({ ...r, tableId: t.id })));
  },

  // Deterministic PRNG (mulberry32): the same seed gives the same shuffles (tests, audits)
  seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  shuffle(items, rand = Math.random) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // A new row order for each table, { tableId: [rowId, ...] }. It is never the printed order (the one you
  // see at the exam) and, from three rows up, never the order of `previous`, so "Shuffle again" always
  // changes something.
  shuffleRows(sheet, rand = Math.random, previous = null) {
    const order = {};
    const key = ids => ids.join('|');
    for (const table of sheet?.tables || []) {
      const ids = table.rows.map(r => r.id);
      const avoid = new Set([key(ids)]);
      if (ids.length > 2 && previous?.[table.id]) avoid.add(key(previous[table.id]));
      let next = this.shuffle(ids, rand);
      for (let i = 0; i < 40 && ids.length > 1 && avoid.has(key(next)); i++) next = this.shuffle(ids, rand);
      // Deterministic fallback: the rotations of the printed order are all different from it
      for (let k = 1; k < ids.length && avoid.has(key(next)); k++) next = [...ids.slice(k), ...ids.slice(0, k)];
      order[table.id] = next;
    }
    return order;
  },

  // answers: { rowId: picked rowId | null } -> { results: { rowId: { picked, correct } }, correct, total }
  // A row left unanswered counts as wrong.
  gradeRows(sheet, answers = {}) {
    const results = {};
    let correct = 0;
    for (const row of this.rows(sheet)) {
      const picked = answers[row.id] || null;
      const ok = picked === row.id;
      if (ok) correct++;
      results[row.id] = { picked, correct: ok };
    }
    return { results, correct, total: Object.keys(results).length };
  },

  // Every formula cell of the sheet: 7 rows x 4 columns
  cells(sheet) {
    return this.rows(sheet).flatMap(row => row.cells.map((cell, col) => ({
      key: `${row.id}:${col}`, rowId: row.id, tableId: row.tableId, col, main: cell.main, sub: cell.sub || ''
    })));
  },

  sameFormula(a, b) {
    return a.main === b.main && (a.sub || '') === (b.sub || '');
  },

  // Every place on the sheet that shows exactly this formula. Usually one, but the Poisson mean and
  // variance are both \(\lambda\), so the cell drill must accept either column there.
  answersFor(sheet, cell) {
    return this.cells(sheet).filter(c => this.sameFormula(c, cell)).map(c => ({ rowId: c.rowId, col: c.col }));
  },

  // pick: { rowId, col } -> { correct, rowOk, colOk, answers }
  gradeCell(sheet, cell, pick = {}) {
    const answers = this.answersFor(sheet, cell);
    return {
      correct: answers.some(a => a.rowId === pick.rowId && a.col === pick.col),
      rowOk: answers.some(a => a.rowId === pick.rowId),
      colOk: answers.some(a => a.col === pick.col),
      answers
    };
  },

  // The next cell of a shuffled pass through all of them: no repeats until every cell was shown,
  // and a new pass never starts with the cell that was just on screen.
  drawCell(sheet, deck = [], rand = Math.random, previousKey = null) {
    const pool = this.cells(sheet);
    const known = new Set(pool.map(c => c.key));
    let next = (deck || []).filter(k => known.has(k));
    if (!next.length) next = this.shuffle(pool.map(c => c.key), rand);
    if (next[0] === previousKey && next.length > 1) next = [...next.slice(1), next[0]];
    const [key, ...rest] = next;
    return { cell: pool.find(c => c.key === key) || null, deck: rest };
  },

  nextStreak(streak, correct) {
    return correct ? (streak || 0) + 1 : 0;
  },

  // Best result per level: rows = most rows named right in one round, cells = longest streak
  sanitizeBest(raw) {
    const n = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
    return { rows: n(raw?.rows), cells: n(raw?.cells) };
  },

  updateBest(best, level, value) {
    const current = this.sanitizeBest(best);
    if (!this.LEVELS.includes(level) || !(value > current[level])) return { best: current, improved: false };
    return { best: { ...current, [level]: Math.floor(value) }, improved: true };
  }
};

class FormulaSheet {
  constructor(sheet) {
    this.sheet = sheet || null;
    this.mode = 'study';
    this.level = 'rows';
    this.hideHeaders = false;
    this.locked = false;   // opened by the mock midterm: no way to the labelled sheet
    this.rand = Math.random;
    // level 1: name the rows
    this.order = null;     // { tableId: [rowId, ...] }, shuffled within each table
    this.answers = {};     // rowId -> picked rowId
    this.graded = null;    // gradeRows() result once checked, plus newBest
    // level 2: one cell at a time
    this.cell = null;
    this.deck = [];
    this.pick = { rowId: null, col: null };
    this.cellGraded = null; // gradeCell() result once checked, plus newBest
    this.streak = 0;
    this.notice = '';
    this.best = this.loadBest();
    this.opener = null;
    this.root = null;      // the dialog, built on the first open()
    this.onKey = e => this.handleKey(e);
    // Back/forward away from a sheet address closes the dialog
    this.onPopState = () => {
      if (this.isOpen && !FormulaSheetLogic.modeForRoute(this.routeSegment())) this.close({ restoreFocus: false });
    };
  }

  // --- helpers ---
  static icon(name, cls = '') {
    return typeof window !== 'undefined' && typeof window.icon === 'function' ? window.icon(name, cls) : '';
  }

  static esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Sheet text (HTML with TeX) ready for innerHTML
  static tex(s) {
    return FormulaSheetLogic.mathSafe(s);
  }

  get rows() {
    return FormulaSheetLogic.rows(this.sheet);
  }

  rowById(id) {
    return this.rows.find(r => r.id === id) || null;
  }

  // "the m.g.f. of the Exponential E(lambda)": columns read as words, p.m.f. or p.d.f. by table
  columnWord(rowId, col) {
    if (col === 0) return this.rowById(rowId)?.tableId === 'discrete' ? 'p.m.f.' : 'p.d.f.';
    return ['', 'm.g.f.', 'mean', 'variance'][col];
  }

  renderMath(el, tries = 0) {
    if (!el) return;
    if (typeof window.renderMathInElement === 'function') {
      try {
        window.renderMathInElement(el, {
          delimiters: [{ left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }],
          throwOnError: false
        });
      } catch (e) {
        console.warn('KaTeX render notice:', e);
      }
    } else if (tries < 50) {
      setTimeout(() => this.renderMath(el, tries + 1), 100); // KaTeX still loading (CDN fallback)
    }
  }

  // --- persistence: best result per level, this browser only ---
  loadBest() {
    try {
      return FormulaSheetLogic.sanitizeBest(JSON.parse(localStorage.getItem(FormulaSheet.STORE) || 'null')?.best);
    } catch (e) {
      return FormulaSheetLogic.sanitizeBest(null);
    }
  }

  saveBest() {
    try {
      localStorage.setItem(FormulaSheet.STORE, JSON.stringify({ best: this.best }));
    } catch (e) { /* storage blocked (private window): the best result lasts for this visit */ }
  }

  // Saves a better result. Returns true only when it beats an earlier one: a first result is no record.
  recordBest(level, value) {
    const before = this.best[level];
    const { best, improved } = FormulaSheetLogic.updateBest(this.best, level, value);
    if (!improved) return false;
    this.best = best;
    this.saveBest();
    this.updateCardBest();
    return before > 0;
  }

  // --- the card on the Formulas tab (#formula-sheet-card) ---
  init() {
    this.renderCard();
  }

  renderCard() {
    const host = document.getElementById('formula-sheet-card');
    if (!host) return;
    const I = FormulaSheet.icon;
    const total = this.rows.length;
    const button = (mode, iconName, label, primary = false) =>
      `<button type="button" data-fs-open="${mode}" class="${primary ? FormulaSheet.PRIMARY : FormulaSheet.SECONDARY} w-full">${I(iconName)} ${label}</button>`;
    host.innerHTML = `
      <div class="p-5 rounded-2xl border border-indigo-800 bg-indigo-950/40">
        <div class="flex items-start gap-3.5">
          <span class="hidden sm:inline-flex w-11 h-11 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white text-xl" aria-hidden="true">${I('file-question')}</span>
          <div class="flex-1 min-w-0">
            <div class="text-[11px] uppercase font-extrabold tracking-wider text-indigo-400">Midterm 2 · formula sheet</div>
            <h3 class="text-lg font-black text-slate-100 leading-snug">Exam formula sheet: comes without labels</h3>
            <p class="text-sm text-slate-300 mt-1 max-w-3xl">At Midterm 2 you get the printed table of ${total || 'the'} distributions with the p.m.f./p.d.f., m.g.f., mean and variance, but the distribution names are not written on it. Learn to recognise every row.</p>
          </div>
        </div>
        <div class="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2">
          ${button('study', 'book-open', 'Study the sheet')}
          ${button('exam', 'file-text', 'As handed out')}
          ${button('drill', 'target', 'Drill: name the rows', true)}
        </div>
        <p id="fs-card-best" class="mt-3 text-xs text-slate-400 tabular-nums"></p>
      </div>`;
    host.querySelectorAll('[data-fs-open]').forEach(btn => btn.addEventListener('click', () => this.open({ mode: btn.dataset.fsOpen, opener: btn })));
    this.updateCardBest();
  }

  bestText() {
    const { rows, cells } = this.best;
    const parts = [];
    if (rows) parts.push(`${rows} / ${this.rows.length} rows named`);
    if (cells) parts.push(`a streak of ${cells} ${cells === 1 ? 'cell' : 'cells'}`);
    return parts.length ? `${FormulaSheet.icon('trophy', 'text-amber-400')} Your best: ${parts.join(' · ')}` : '';
  }

  updateCardBest() {
    const el = document.getElementById('fs-card-best');
    if (!el) return;
    const text = this.bestText();
    el.innerHTML = text;
    el.classList.toggle('hidden', !text);
  }

  // --- the dialog ---
  get isOpen() {
    return !!this.root?.isConnected && !this.root.hidden;
  }

  get panel() { return this.root?.querySelector('.fs-panel'); }
  get body() { return this.root?.querySelector('#fs-body'); }
  get foot() { return this.root?.querySelector('#fs-foot'); }

  ensureDom() {
    if (this.root?.isConnected) return this.root;
    const I = FormulaSheet.icon;
    const modeButton = (mode, iconName, label) =>
      `<button type="button" data-fs-mode="${mode}" aria-pressed="false" class="fs-mode inline-flex items-center justify-center gap-1.5 px-2 sm:px-4 py-1.5 rounded-lg cursor-pointer transition tab-inactive">${I(iconName)}<span>${label}</span></button>`;
    const root = document.createElement('div');
    root.id = 'fs-dialog';
    root.className = 'fs-overlay';
    root.hidden = true;
    root.innerHTML = `
      <div class="fs-backdrop bg-black/60 backdrop-blur-sm" data-fs-action="close"></div>
      <div class="fs-panel bg-slate-900 border border-slate-700 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="fs-title" aria-describedby="fs-subtitle" tabindex="-1">
        <div class="fs-head border-b border-slate-800">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="text-[11px] uppercase font-extrabold tracking-wider text-indigo-400">Midterm 2</div>
              <h2 id="fs-title" class="text-lg sm:text-xl font-black text-slate-100 leading-tight">Exam formula sheet</h2>
              <p id="fs-subtitle" class="text-xs text-slate-400 mt-0.5"></p>
            </div>
            <button type="button" data-fs-action="close" class="shrink-0 p-2 -mr-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer transition" aria-label="Close the formula sheet" title="Close (Esc)">${I('x', 'text-lg')}</button>
          </div>
          <div id="fs-modes" role="group" aria-label="View" class="mt-3 grid grid-cols-3 gap-1 p-1 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm font-semibold">
            ${modeButton('study', 'book-open', 'Study')}
            ${modeButton('exam', 'file-text', 'As handed out')}
            ${modeButton('drill', 'target', 'Drill')}
          </div>
        </div>
        <div id="fs-body" class="fs-body"></div>
        <div id="fs-foot" class="fs-foot border-t border-slate-800" hidden></div>
        <div id="fs-live" class="sr-only" aria-live="polite"></div>
      </div>`;
    document.body.appendChild(root);
    root.addEventListener('click', e => this.onClick(e));
    root.addEventListener('change', e => this.onChange(e));
    this.root = root;
    return root;
  }

  // locked: no view switch and no "Show the names" (the mock midterm keeps its exam sheet unlabelled)
  open({ mode = 'study', level, hideHeaders, locked = false, opener } = {}) {
    const wasOpen = this.isOpen;
    this.ensureDom();
    this.mode = FormulaSheetLogic.normalizeMode(mode);
    this.locked = !!locked;
    if (level !== undefined) this.level = FormulaSheetLogic.normalizeLevel(level);
    // "As handed out" means with the column headers unless the caller asks otherwise
    if (hideHeaders !== undefined) this.hideHeaders = !!hideHeaders;
    else if (!wasOpen) this.hideHeaders = false;
    if (!wasOpen) {
      const active = document.activeElement;
      this.opener = opener || (active && active !== document.body ? active : null);
      this.root.hidden = false;
      document.body.classList.add('fs-lock');
      document.addEventListener('keydown', this.onKey, true);
      // A checked round is over; an unfinished one waits for you
      if (this.graded) this.newRound();
      if (this.cellGraded) this.nextCell();
    }
    this.render();
    this.body.scrollTop = 0;
    this.syncRoute();
    if (!wasOpen) this.panel.focus({ preventScroll: true });
    return this;
  }

  close({ restoreFocus = true } = {}) {
    if (!this.isOpen) return;
    this.root.hidden = true;
    document.body.classList.remove('fs-lock');
    document.removeEventListener('keydown', this.onKey, true);
    if (FormulaSheetLogic.modeForRoute(this.routeSegment())) this.setRoute('formulas');
    const opener = this.opener;
    this.opener = null;
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }

  setMode(mode) {
    this.mode = FormulaSheetLogic.normalizeMode(mode);
    this.render();
    this.body.scrollTop = 0;
    this.syncRoute();
  }

  setLevel(level) {
    this.level = FormulaSheetLogic.normalizeLevel(level);
    this.render({ focus: `[data-fs-level="${this.level}"]` });
  }

  // --- routing: the address follows the dialog only while it sits on the Formulas tab. Opened over another
  // section (the mock midterm exam screen), it leaves that section's address alone. ---
  routeSegment() {
    const [tab, segment] = location.hash.replace(/^#\/?/, '').split('/');
    return tab === 'formulas' ? segment || '' : null;
  }

  setRoute(route) {
    if (window.app?.setRoute) window.app.setRoute(route, { replace: true });
    else try { history.replaceState(null, '', `#/${route}`); } catch (e) { /* file:// or sandboxed frame */ }
  }

  syncRoute() {
    if (this.routeSegment() !== null) this.setRoute(FormulaSheetLogic.routeFor(this.mode));
  }

  // app.applyRoute: #/formulas/sheet · #/formulas/sheet-exam · #/formulas/sheet-drill
  openRoute(segment, { fromRoute = false } = {}) {
    window.app?.switchTab('formulas', { fromRoute });
    const mode = FormulaSheetLogic.modeForRoute(segment);
    if (mode) this.open({ mode });
    else {
      this.close({ restoreFocus: false });
      this.setRoute('formulas');
    }
  }

  // --- keyboard: Esc closes, Tab stays inside the dialog ---
  handleKey(e) {
    if (!this.isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = this.panel;
    const items = [...panel.querySelectorAll('button, [href], select, input, textarea, [tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.disabled && el.getClientRects().length > 0);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active) || active === panel) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  onClick(e) {
    const t = e.target.closest('[data-fs-action], [data-fs-mode], [data-fs-level], [data-fs-pick-row], [data-fs-pick-col]');
    if (!t || t.disabled) return;
    const d = t.dataset;
    if (d.fsAction === 'close') this.close();
    else if (d.fsAction === 'check') this.checkRows();
    else if (d.fsAction === 'shuffle') this.shuffleAgain();
    else if (d.fsAction === 'check-cell') this.checkCell();
    else if (d.fsAction === 'next') {
      this.nextCell();
      this.render({ focus: '#fs-cell-card' });
    } else if (d.fsMode) {
      const fromBody = this.body.contains(t);
      this.setMode(d.fsMode);
      if (fromBody) this.root.querySelector(`.fs-mode[data-fs-mode="${this.mode}"]`)?.focus();
    } else if (d.fsLevel) this.setLevel(d.fsLevel);
    else if (d.fsPickRow) this.choose('row', d.fsPickRow);
    else if (d.fsPickCol !== undefined) this.choose('col', Number(d.fsPickCol));
  }

  onChange(e) {
    const t = e.target;
    if (t.matches('select[data-fs-slot]')) {
      const [tableId, index] = t.dataset.fsSlot.split(':');
      const rowId = this.order?.[tableId]?.[Number(index)];
      if (rowId) this.answers[rowId] = t.value || null;
      this.renderFoot();
    } else if (t.id === 'fs-hide-headers') {
      this.hideHeaders = t.checked;
      this.body.classList.toggle('fs-noheads', this.hideHeaders);
    }
  }

  announce(text) {
    const live = this.root?.querySelector('#fs-live');
    if (!live) return;
    live.textContent = '';
    setTimeout(() => { live.textContent = text; }, 30);
  }

  // --- rendering ---
  render({ focus } = {}) {
    if (!this.root) return;
    this.root.querySelectorAll('.fs-mode').forEach(btn => {
      const on = btn.dataset.fsMode === this.mode;
      btn.classList.toggle('tab-active', on);
      btn.classList.toggle('tab-inactive', !on);
      btn.setAttribute('aria-pressed', String(on));
    });
    this.root.querySelector('#fs-subtitle').textContent = FormulaSheet.SUBTITLES[this.mode];
    this.root.querySelector('#fs-modes').classList.toggle('hidden', this.locked);
    const body = this.body;
    if (!this.sheet?.tables?.length) {
      body.innerHTML = '<p class="text-sm text-rose-300">The formula sheet did not load. Reload the page to try again.</p>';
      this.foot.hidden = true;
      return;
    }
    body.classList.toggle('fs-noheads', this.mode === 'exam' && this.hideHeaders);
    body.innerHTML = this.mode === 'exam' ? this.examHtml() : this.mode === 'drill' ? this.drillHtml() : this.studyHtml();
    this.renderMath(body);
    this.renderFoot();
    if (focus) this.root.querySelector(focus)?.focus({ preventScroll: true });
  }

  renderFoot() {
    const html = this.mode === 'drill' ? this.drillFootHtml() : '';
    this.foot.innerHTML = html;
    this.foot.hidden = !html;
  }

  // One table of the sheet. dist(row, i) renders the Distribution cell; the four formula cells are verbatim,
  // each with its main line and the optional second line (support, domain of t).
  tableHtml(table, rowIds, dist, rowClass) {
    const tex = FormulaSheet.tex;
    const byId = new Map(table.rows.map(r => [r.id, r]));
    const heads = table.columns.map((c, i) => `<th scope="col" role="columnheader"${i === 0 ? ' class="fs-dist"' : ''}><span class="fs-th">${tex(c)}</span></th>`).join('');
    const body = rowIds.map((id, i) => {
      const row = byId.get(id);
      const cells = row.cells.map((cell, col) => `
        <td role="cell" class="fs-c${col}">
          <span class="fs-cell-label" aria-hidden="true">${tex(table.columns[col + 1])}</span>
          <span class="fs-main">${tex(cell.main)}</span>${cell.sub ? `<span class="fs-sub">${tex(cell.sub)}</span>` : ''}
        </td>`).join('');
      return `<tr role="row" class="${rowClass(row)}">${dist(row, i, table)}${cells}</tr>`;
    }).join('');
    return `
      <section aria-labelledby="fs-cap-${table.id}">
        <h3 id="fs-cap-${table.id}" class="mb-2 text-sm font-extrabold text-slate-100">${FormulaSheet.esc(table.title)}</h3>
        <div class="fs-scroll">
          <table class="fs-sheet" role="table" aria-labelledby="fs-cap-${table.id}">
            <thead role="rowgroup"><tr role="row">${heads}</tr></thead>
            <tbody role="rowgroup">${body}</tbody>
          </table>
        </div>
      </section>`;
  }

  // Both tables and the footer (the gamma function), as on the printed sheet
  sheetHtml(dist, { order = null, rowClass = () => '' } = {}) {
    const tables = this.sheet.tables.map(t => this.tableHtml(t, order?.[t.id] || t.rows.map(r => r.id), dist, rowClass)).join('');
    const footer = this.sheet.footer?.length ? `<p class="fs-footer text-sm text-slate-300">${FormulaSheet.tex(this.sheet.footer.join(' '))}</p>` : '';
    return `<div class="space-y-5">${tables}${footer}</div>`;
  }

  labelCell(row) {
    const tex = FormulaSheet.tex;
    return `<th scope="row" role="rowheader" class="fs-dist"><span class="fs-name">${tex(row.label)}</span>${row.params ? `<span class="fs-sub">${tex(row.params)}</span>` : ''}</th>`;
  }

  blankCell(row, i) {
    return `<td role="cell" class="fs-dist fs-blank"><span class="sr-only">Row ${i + 1}, no label</span></td>`;
  }

  pickCell(row, i, table) {
    const picked = this.answers[row.id] || '';
    const options = this.rows.map(r => `<option value="${r.id}"${r.id === picked ? ' selected' : ''}>${FormulaSheet.esc(r.name)}</option>`).join('');
    return `
      <td role="cell" class="fs-dist">
        <select data-fs-slot="${table.id}:${i}" aria-label="Row ${i + 1} of the ${FormulaSheet.esc(table.id)} table: which distribution?" class="w-full pl-2.5 pr-8 py-2 rounded-lg bg-slate-800 border border-slate-700 text-sm font-semibold text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition">
          <option value=""${picked ? '' : ' selected'}>Which distribution?</option>${options}
        </select>
      </td>`;
  }

  resultCell(row) {
    const I = FormulaSheet.icon;
    const r = this.graded.results[row.id];
    const pickedName = r.picked ? this.rowById(r.picked)?.name : '';
    const mark = r.correct
      ? `<span class="fs-mark text-emerald-300">${I('circle-check')} Right</span>`
      : `<span class="fs-mark text-rose-300">${I('circle-x')} ${pickedName ? 'Wrong' : 'Not answered'}</span>`;
    const second = !r.correct && pickedName
      ? `<span class="fs-sub">You picked ${FormulaSheet.esc(pickedName)}</span>`
      : (row.params ? `<span class="fs-sub">${FormulaSheet.tex(row.params)}</span>` : '');
    return `<th scope="row" role="rowheader" class="fs-dist">${mark}<span class="fs-name">${FormulaSheet.tex(row.label)}</span>${second}</th>`;
  }

  nextStepsHtml(lead, buttons) {
    if (this.locked) return '';
    const I = FormulaSheet.icon;
    return `
      <div class="mt-6 pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
        <p class="text-sm text-slate-400 sm:mr-auto">${lead}</p>
        <div class="grid grid-cols-1 sm:flex gap-2">
          ${buttons.map(([mode, iconName, label, primary]) => `<button type="button" data-fs-mode="${mode}" class="${primary ? FormulaSheet.PRIMARY : FormulaSheet.SECONDARY}">${I(iconName)} ${label}</button>`).join('')}
        </div>
      </div>`;
  }

  studyHtml() {
    return `
      <div class="flex items-start gap-2.5 p-3 mb-5 rounded-xl border border-indigo-800 bg-indigo-950/50 text-sm text-slate-200">
        ${FormulaSheet.icon('eye-off', 'text-indigo-400 mt-0.5 shrink-0')}<p>${FormulaSheet.tex(this.sheet.note)}</p>
      </div>
      ${this.sheetHtml(row => this.labelCell(row))}
      ${this.nextStepsHtml('Know it? See it the way you will get it:', [['exam', 'file-text', 'As handed out'], ['drill', 'target', 'Drill: name the rows', true]])}`;
  }

  examHtml() {
    return `
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 mb-5">
        <p class="text-sm text-slate-300 sm:mr-auto">${FormulaSheet.icon('info', 'text-indigo-400')} The Distribution column is empty, just like on the exam.</p>
        <label class="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-sm font-semibold text-slate-200 cursor-pointer transition">
          <input type="checkbox" id="fs-hide-headers" class="w-4 h-4 accent-indigo-600 cursor-pointer"${this.hideHeaders ? ' checked' : ''}>
          Also hide the column headers
        </label>
      </div>
      ${this.sheetHtml((row, i) => this.blankCell(row, i))}
      ${this.nextStepsHtml('Stuck on a row?', [['study', 'book-open', 'Show the names'], ['drill', 'target', 'Drill: name the rows', true]])}`;
  }

  drillHtml() {
    const I = FormulaSheet.icon;
    const levelButton = (level, iconName, label) => {
      const on = this.level === level;
      return `<button type="button" data-fs-level="${level}" aria-pressed="${on}" class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer transition ${on ? 'tab-active' : 'tab-inactive'}">${I(iconName)}<span>${label}</span></button>`;
    };
    return `
      <div role="group" aria-label="Drill level" class="grid grid-cols-2 sm:inline-grid gap-1 p-1 mb-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs sm:text-sm font-semibold">
        ${levelButton('rows', 'list-checks', 'Name the rows')}
        ${levelButton('cells', 'crosshair', 'One cell at a time')}
      </div>
      ${this.level === 'cells' ? this.cellsHtml() : this.rowsHtml()}`;
  }

  // Level 1: every row of the shuffled sheet gets a select; Check reveals the names
  rowsHtml() {
    if (!this.order) this.newRound();
    const graded = this.graded;
    const intro = graded
      ? 'Every row now shows its name. Shuffle again for a new round.'
      : 'The rows are shuffled within each table and the names are hidden. Pick the distribution of every row, then check.';
    const dist = graded ? row => this.resultCell(row) : (row, i, table) => this.pickCell(row, i, table);
    const rowClass = graded ? row => (graded.results[row.id].correct ? 'fs-right' : 'fs-wrong') : () => '';
    return `<p class="text-sm text-slate-300 mb-4">${intro}</p>${this.sheetHtml(dist, { order: this.order, rowClass })}`;
  }

  // Level 2: one cell, pick its distribution and its column
  cellsHtml() {
    if (!this.cell) this.nextCell();
    const I = FormulaSheet.icon;
    const cell = this.cell;
    const g = this.cellGraded;
    const rightRows = new Set(g ? g.answers.map(a => a.rowId) : []);
    const rightCols = new Set(g ? g.answers.map(a => a.col) : []);
    const chip = (kind, value, label, picked, right) => {
      const attr = kind === 'row' ? `data-fs-pick-row="${value}"` : `data-fs-pick-col="${value}"`;
      const base = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-semibold transition';
      if (!g) {
        const look = picked
          ? 'bg-indigo-600 hover:bg-indigo-500 border-indigo-600 text-white'
          : 'bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-indigo-500 text-slate-200';
        return `<button type="button" ${attr} aria-pressed="${picked}" class="${base} cursor-pointer ${look}">${label}</button>`;
      }
      const look = right ? 'bg-emerald-950 border-emerald-600 text-emerald-300'
        : picked ? 'bg-rose-950 border-rose-600 text-rose-300'
          : 'bg-slate-800 border-slate-700 text-slate-400';
      const mark = right ? I('check') : picked ? I('x') : '';
      return `<button type="button" ${attr} aria-pressed="${picked}" disabled class="${base} ${look}">${mark}${label}</button>`;
    };
    const rowChips = this.rows.map(r => chip('row', r.id, FormulaSheet.esc(r.name), this.pick.rowId === r.id, rightRows.has(r.id))).join('');
    const colChips = FormulaSheetLogic.COLUMNS.map((label, col) => chip('col', col, label, this.pick.col === col, rightCols.has(col))).join('');
    return `
      <p class="text-sm text-slate-300 mb-4">One cell of the sheet at a time. Which distribution is it from, and which column?</p>
      <div id="fs-cell-card" tabindex="-1" role="group" aria-label="The formula to recognise" class="rounded-2xl border border-slate-700 bg-slate-950/50 px-4 py-6 text-center text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500">
        <div class="fs-cell-big">${FormulaSheet.tex(cell.main)}</div>
        ${cell.sub ? `<div class="fs-sub fs-cell-sub">${FormulaSheet.tex(cell.sub)}</div>` : ''}
      </div>
      <div class="mt-5 space-y-4">
        <div>
          <div id="fs-pick-row-label" class="mb-2 text-[11px] uppercase font-bold tracking-wider text-slate-400">Distribution</div>
          <div role="group" aria-labelledby="fs-pick-row-label" class="flex flex-wrap gap-2">${rowChips}</div>
        </div>
        <div>
          <div id="fs-pick-col-label" class="mb-2 text-[11px] uppercase font-bold tracking-wider text-slate-400">Column</div>
          <div role="group" aria-labelledby="fs-pick-col-label" class="flex flex-wrap gap-2">${colChips}</div>
        </div>
      </div>
      ${g ? this.cellFeedbackHtml() : ''}`;
  }

  cellFeedbackHtml() {
    const I = FormulaSheet.icon;
    const g = this.cellGraded;
    const cell = this.cell;
    const row = this.rowById(cell.rowId);
    const where = (rowId, col) => `the ${this.columnWord(rowId, col)} of the ${rowId === cell.rowId ? FormulaSheet.tex(row.label) : FormulaSheet.esc(this.rowById(rowId)?.name)}`;
    const picked = this.pick;
    const lines = [g.correct ? `It is ${where(cell.rowId, cell.col)}.` : `It is ${where(cell.rowId, cell.col)}. You picked ${where(picked.rowId, picked.col)}.`];
    if (g.answers.length > 1) {
      lines.push(`The same formula is ${g.answers.map(a => where(a.rowId, a.col)).join(' and ')}, so either counts.`);
    }
    return `
      <div id="fs-cell-feedback" class="mt-5 p-3.5 rounded-xl border ${g.correct ? 'border-emerald-700 bg-emerald-950/50' : 'border-rose-700 bg-rose-950/50'} text-sm">
        <p class="font-bold ${g.correct ? 'text-emerald-300' : 'text-rose-300'}">${I(g.correct ? 'circle-check' : 'circle-x')} ${g.correct ? 'Right' : 'Not quite'}</p>
        ${lines.map(l => `<p class="mt-1 text-slate-200">${l}</p>`).join('')}
      </div>`;
  }

  drillFootHtml() {
    const I = FormulaSheet.icon;
    const total = this.rows.length;
    const badge = '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-950 text-amber-300 border border-amber-700">New best</span>';
    const notice = this.notice ? `<span class="text-xs font-semibold text-amber-300">${this.notice}</span>` : '';
    if (this.level === 'cells') {
      const g = this.cellGraded;
      const info = `<span class="text-sm text-slate-300 tabular-nums">${I('flame', 'text-amber-400')} Streak <strong class="text-slate-100">${this.streak}</strong> · best ${this.best.cells}</span>${g?.newBest ? badge : ''}${notice}`;
      const action = g
        ? `<button type="button" data-fs-action="next" class="${FormulaSheet.PRIMARY}">Next cell ${I('arrow-right')}</button>`
        : `<button type="button" data-fs-action="check-cell" class="${FormulaSheet.PRIMARY}">${I('check')} Check</button>`;
      return this.footRow(info, action);
    }
    if (this.graded) {
      const { correct } = this.graded;
      const info = `<span class="text-sm text-slate-300 tabular-nums"><strong class="text-lg font-black ${correct === total ? 'text-emerald-300' : 'text-slate-100'}">${correct} / ${total}</strong> right · best ${this.best.rows} / ${total}</span>${this.graded.newBest ? badge : ''}`;
      return this.footRow(info, `<button type="button" data-fs-action="shuffle" class="${FormulaSheet.PRIMARY}">${I('shuffle')} Shuffle again</button>`);
    }
    const picked = Object.values(this.answers).filter(Boolean).length;
    const info = `<span class="text-sm text-slate-300 tabular-nums">${picked} of ${total} picked${this.best.rows ? ` · best ${this.best.rows} / ${total}` : ''}</span>`;
    return this.footRow(info, `
      <button type="button" data-fs-action="shuffle" class="${FormulaSheet.SECONDARY}">${I('shuffle')} Shuffle again</button>
      <button type="button" data-fs-action="check" class="${FormulaSheet.PRIMARY}">${I('check')} Check</button>`);
  }

  footRow(info, actions) {
    return `
      <div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="min-w-0 flex flex-wrap items-center gap-2">${info}</div>
        <div class="flex gap-2 ml-auto">${actions}</div>
      </div>`;
  }

  // --- drill actions ---
  newRound() {
    this.order = FormulaSheetLogic.shuffleRows(this.sheet, this.rand, this.order);
    this.answers = {};
    this.graded = null;
  }

  shuffleAgain() {
    this.newRound();
    this.render({ focus: 'select[data-fs-slot]' });
    this.body.scrollTop = 0;
    this.announce('New round: the rows are shuffled again.');
  }

  checkRows() {
    const grade = FormulaSheetLogic.gradeRows(this.sheet, this.answers);
    const newBest = this.recordBest('rows', grade.correct);
    this.graded = { ...grade, newBest };
    this.render({ focus: '[data-fs-action="shuffle"]' });
    this.announce(`${grade.correct} of ${grade.total} right.${newBest ? ' New best.' : ''}`);
  }

  nextCell() {
    const { cell, deck } = FormulaSheetLogic.drawCell(this.sheet, this.deck, this.rand, this.cell?.key);
    this.cell = cell;
    this.deck = deck;
    this.pick = { rowId: null, col: null };
    this.cellGraded = null;
    this.notice = '';
  }

  choose(kind, value) {
    if (this.cellGraded) return;
    if (kind === 'row') this.pick.rowId = this.pick.rowId === value ? null : value;
    else this.pick.col = this.pick.col === value ? null : value;
    this.notice = '';
    this.render({ focus: kind === 'row' ? `[data-fs-pick-row="${value}"]` : `[data-fs-pick-col="${value}"]` });
  }

  checkCell() {
    const { rowId, col } = this.pick;
    if (!rowId || col === null) {
      this.notice = !rowId && col === null ? 'Pick a distribution and a column first.' : !rowId ? 'Pick a distribution first.' : 'Pick a column first.';
      this.renderFoot();
      this.announce(this.notice);
      return;
    }
    const grade = FormulaSheetLogic.gradeCell(this.sheet, this.cell, this.pick);
    this.streak = FormulaSheetLogic.nextStreak(this.streak, grade.correct);
    const newBest = grade.correct && this.recordBest('cells', this.streak);
    this.cellGraded = { ...grade, newBest };
    this.notice = '';
    this.render({ focus: '[data-fs-action="next"]' });
    // On a phone the verdict lands below the chips: bring it into view once its styles have applied
    // (the Tailwind CDN compiles classes it has not seen yet on the next frame)
    const feedback = this.root.querySelector('#fs-cell-feedback');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (feedback?.isConnected) feedback.scrollIntoView({ block: 'nearest' });
    }));
    this.announce(`${grade.correct ? 'Right' : 'Not quite'}. Streak ${this.streak}.${newBest ? ' New best.' : ''}`);
  }
}

FormulaSheet.STORE = 'stathustle_formula_sheet';
FormulaSheet.SUBTITLES = {
  study: 'As printed, with the labels. At the exam the Distribution column is empty.',
  exam: 'Exactly as handed out at the exam: no distribution names.',
  drill: 'Recognise every row without its label.'
};
// Button looks shared by the card and the dialog (the palette variables remap them for the light theme).
// Both carry a 1px border, so a primary and a secondary button side by side have the same height.
FormulaSheet.BUTTON = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl border text-sm font-bold cursor-pointer transition';
FormulaSheet.PRIMARY = `${FormulaSheet.BUTTON} border-transparent bg-indigo-600 hover:bg-indigo-500 text-white`;
FormulaSheet.SECONDARY = `${FormulaSheet.BUTTON} border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200`;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { FormulaSheetLogic };
} else {
  window.FormulaSheetLogic = FormulaSheetLogic;
  window.formulaSheet = new FormulaSheet(window.FORMULA_SHEET);
  window.addEventListener('popstate', window.formulaSheet.onPopState);
}
