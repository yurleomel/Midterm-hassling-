// ========================================================
// Get ready: the teacher's checklist "I am ready for Midterm 2 if" (R.H., Spring 2018) for module 2.
// Every item opens what the lecture slides say about it, word for word (lecture + slide), the lecture
// examples, practice from the course materials, links to review, and our own notes, kept apart from the quotes.
// Data: js/midterm-prep-data.js (generated). Ticks: readinessState.prepChecks[itemId] = { on, at } (js/quiz.js);
// js/user.js merges them per item across devices (the latest tick or untick wins).
// The app calls init(), show() and openItem(id, { fromRoute }) for #/getready/<itemId>.
// ========================================================

// Pure logic — DOM-free so it can be unit-tested with `node --test`.
const GetReadyLogic = {
  // An item flagged "not on the sheet" (x-bernoulli) is our extra: shown and tickable, never counted
  isExtra(item) {
    return /^\s*not on the sheet/i.test(item?.typo || '');
  },

  items(prep) {
    return (prep?.groups || []).flatMap(g => g.items || []);
  },

  find(prep, id) {
    return this.items(prep).find(i => i.id === id) || null;
  },

  isTicked(checks, id) {
    return checks?.[id]?.on === true;
  },

  // { ticked, total, done } over the teacher's items only (extras never count)
  progress(items, checks) {
    const sheet = (items || []).filter(i => !this.isExtra(i));
    const ticked = sheet.filter(i => this.isTicked(checks, i.id)).length;
    return { ticked, total: sheet.length, done: sheet.length > 0 && ticked === sheet.length };
  },

  // A new checks object; an untick is kept as { on: false } with its time, so the latest change wins the merge
  toggle(checks, id, on, now = Date.now()) {
    return { ...(checks || {}), [id]: { on: !!on, at: now } };
  },

  // Rows to show. With onlyUnticked: the unticked items plus `keep` (ticked while that view was open, so a
  // slip of the finger can be undone in place; they leave when the view is rebuilt)
  visible(items, checks, { onlyUnticked = false, keep = [] } = {}) {
    if (!onlyUnticked) return (items || []).slice();
    const kept = new Set(keep);
    return (items || []).filter(i => !this.isTicked(checks, i.id) || kept.has(i.id));
  },

  escapeText(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  // \( \), \[ \], $$ $$ and $ $ — the delimiters the page renders
  MATH_RE: /\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]+?\$\$|\$[^$]+?\$/g,
  // The formatting tags the data may use; any other "<" is text
  ALLOWED_TAGS: ['b', 'strong', 'i', 'em', 'u', 's', 'sup', 'sub', 'small', 'br', 'hr', 'p', 'div', 'span',
    'ul', 'ol', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'code', 'blockquote'],

  // Data text is HTML with TeX, and TeX may hold a bare "<" (P(a<X\le b), 0<x<y). innerHTML would read "<X"
  // as the start of a tag and swallow the rest of the quote. Inside formulas < > & become entities (the
  // browser turns them back into the same characters, so KaTeX gets the exact source); outside formulas only
  // the allowed tags stay markup. Nothing is reworded: the page shows exactly the source text.
  safeHtml(html) {
    const src = String(html ?? '');
    const tag = new RegExp(`^<\\/?(?:${this.ALLOWED_TAGS.join('|')})(?:\\s[^<>]*)?\\/?>`, 'i');
    const entity = /^&(?:#\d+|#x[0-9a-f]+|[a-z][a-z0-9]*);/i;
    const outside = s => s.replace(/[<&]/g, (c, i) => {
      if (c === '<') return tag.test(s.slice(i)) ? c : '&lt;';
      return entity.test(s.slice(i)) ? c : '&amp;';
    });
    const inside = s => s.replace(/[<>&]/g, (c, i) => {
      if (c === '&' && entity.test(s.slice(i))) return c;
      return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c];
    });
    let out = '';
    let last = 0;
    for (const m of src.matchAll(this.MATH_RE)) {
      out += outside(src.slice(last, m.index)) + inside(m[0]);
      last = m.index + m[0].length;
    }
    return out + outside(src.slice(last));
  },

  // The data puts a few editorial marks inside quotes: corrections "(sic: possess)", "(sic)" and pointers to
  // other slides such as "(L6 p13)" or "L5 p30". They are ours, not the lecturer's: their text stays as it is
  // but they get our own style and a tooltip. Pointers are only looked for outside formulas.
  markEditorial(html) {
    const mark = (title, text) => `<span class="gr-ed" title="${title}">${text}</span>`;
    const sic = /\(sic(?::\s(?:\\\([\s\S]*?\\\)|[^()])*)?\)/g;
    const pointer = /\bL(\d+) p(\d+(?:[–-]\d+)?(?:, p\d+(?:[–-]\d+)?)*)/g;
    const pointers = s => s.replace(pointer, (m, n, pages) => mark(`Our pointer to Lecture ${n}, slide ${pages.replace(/p/g, '')}: not on this slide`, m));
    const src = String(html ?? '').replace(sic, m => mark('Our correction: not on the slide', m));
    let out = '';
    let last = 0;
    for (const m of src.matchAll(this.MATH_RE)) {
      out += pointers(src.slice(last, m.index)) + m[0];
      last = m.index + m[0].length;
    }
    return out + pointers(src.slice(last));
  },

  // The start of a plain-text question for a preview: whole words, a formula is never cut in two,
  // display formulas become inline and gap markers [[1]] become "…". Returns plain text (escape it).
  excerpt(text, max = 160) {
    const src = String(text ?? '')
      .replace(/\[\[\d+\]\]/g, '…')
      .replace(/\\\[([\s\S]*?)\\\]/g, '\\($1\\)')
      .replace(/\s+/g, ' ')
      .trim();
    if (src.length <= max) return src;
    const tokens = [];
    let last = 0;
    for (const m of src.matchAll(this.MATH_RE)) {
      if (m.index > last) tokens.push({ text: src.slice(last, m.index), math: false });
      tokens.push({ text: m[0], math: true });
      last = m.index + m[0].length;
    }
    if (last < src.length) tokens.push({ text: src.slice(last), math: false });

    let out = '';
    for (const t of tokens) {
      if (out.length + t.text.length <= max) { out += t.text; continue; }
      if (!t.math) {
        const room = t.text.slice(0, max - out.length);
        const cut = room.lastIndexOf(' ');
        if (cut > 0) out += room.slice(0, cut);
        else if (!out) out = room;
      } else if (!out) {
        out = t.text; // a formula longer than the whole preview: show it whole
      }
      break;
    }
    return `${out.replace(/[\s,;:.(—–-]+$/, '')}…`;
  },

  lectureNumber(key) {
    const m = /^L(\d+)$/i.exec(String(key || ''));
    return m ? Number(m[1]) : null;
  },

  // "Lecture 4 · slide 10"; title = the lecture's full name for the tooltip
  citation(lectures, q) {
    const n = this.lectureNumber(q?.lecture);
    const label = `${n ? `Lecture ${n}` : String(q?.lecture || 'Lecture')}${q?.page ? ` · slide ${q.page}` : ''}`;
    return { label, title: lectures?.[q?.lecture] || label };
  },

  // A practice entry resolved against the banks, or null when it would lead nowhere (unknown kind or id)
  practice(entry, { tasks = [], problems = [] } = {}) {
    switch (entry?.kind) {
      case 'selftest': {
        const task = tasks.find(t => t.id === entry.id);
        return task ? { kind: 'selftest', id: task.id, label: `LMS self-test ${task.id} · Topic ${task.topic}`, text: this.excerpt(task.question) } : null;
      }
      case 'problem': {
        const p = problems.find(x => x.id === Number(entry.id));
        return p ? { kind: 'problem', id: p.id, label: [p.source, p.topic].filter(Boolean).join(' · '), title: p.title } : null;
      }
      case 'source':
        return entry.text && entry.sourceTitle
          ? { kind: 'source', label: [entry.sourceTitle, entry.label].filter(Boolean).join(' · '), html: entry.text }
          : null;
      case 'midterm2017': {
        const n = Number(entry.problem);
        if (!Number.isInteger(n) || n < 1) return null;
        const part = entry.part ? ` (${entry.part})` : '';
        return { kind: 'midterm2017', problem: n, part: entry.part || '', label: `Practice midterm 2017 · Problem ${n}${part}` };
      }
      default:
        return null;
    }
  },

  plural(n, one, many = `${one}s`) {
    return `${n} ${n === 1 ? one : many}`;
  },

  // The small counts under an item: "5 quotes · 1 example · 2 practice · our note"
  metaParts({ quotes = 0, examples = 0, practice = 0, notes = 0 } = {}) {
    return [
      quotes ? this.plural(quotes, 'quote') : '',
      examples ? this.plural(examples, 'example') : '',
      practice ? `${practice} practice` : '',
      notes ? (notes === 1 ? 'our note' : 'our notes') : ''
    ].filter(Boolean);
  }
};

// Short names for the jump row; the group headings keep the sheet's own wording
const GET_READY_SHORT = { definitions: 'Definitions', distributions: 'Distributions', notions: 'Notions', ican: 'I can' };
// Kind tag of a lecture quote (Tailwind shades that css/style.css remaps for the light theme)
const GET_READY_KIND_CLS = {
  definition: 'bg-indigo-950 text-indigo-300',
  theorem: 'bg-violet-950 text-violet-300',
  property: 'bg-cyan-950 text-cyan-300',
  formula: 'bg-emerald-950 text-emerald-300',
  remark: 'bg-amber-950 text-amber-300'
};
// Where the exam formula sheet drill is offered (the sheet is handed out without its labels)
const GET_READY_SHEET_GROUPS = new Set(['distributions']);
const GET_READY_SHEET_ITEMS = new Set(['c-recognise']);
const GET_READY_FILTER_KEY = 'stathustle_getready_unticked';

class GetReady {
  constructor(prep) {
    this.prep = prep || null;
    this.expanded = new Set();     // open items (kept while the user is elsewhere)
    this.keep = new Set();         // ticked while "only unticked" was on: they stay until the view is rebuilt
    this.landing = null;           // item a deep link is about to open
    this.fallbackChecks = {};
    this.warned = new Set();
    this.hooked = false;
    this.onlyUnticked = false;
    try { this.onlyUnticked = localStorage.getItem(GET_READY_FILTER_KEY) === '1'; } catch (e) {}
  }

  get container() { return document.getElementById('getready-container'); }
  get items() { return GetReadyLogic.items(this.prep); }

  // --- persistence: part of the readiness state, so it follows the account ---
  get checks() {
    const rs = window.quizManager?.readinessState;
    if (!rs) return this.fallbackChecks;
    if (!rs.prepChecks) rs.prepChecks = {};
    return rs.prepChecks;
  }

  setTick(id, on) {
    if (!GetReadyLogic.find(this.prep, id)) return;
    const rs = window.quizManager?.readinessState;
    const next = GetReadyLogic.toggle(this.checks, id, on);
    if (this.onlyUnticked && on) this.keep.add(id);
    if (rs) {
      rs.prepChecks = next;
      window.quizManager.saveReadiness(); // ends in updateReadinessUI, which runs sync() once hooked
    } else {
      this.fallbackChecks = next;
    }
    if (!rs || !this.hooked) this.sync();
  }

  // Readiness changes from anywhere (login, cloud merge, another account) end in quizManager.updateReadinessUI():
  // refresh the sidebar counter and the visible ticks there too
  hookReadiness() {
    const qm = window.quizManager;
    if (this.hooked || !qm || typeof qm.updateReadinessUI !== 'function') return;
    const original = qm.updateReadinessUI;
    const self = this;
    qm.updateReadinessUI = function (...args) {
      const out = original.apply(this, args);
      self.sync();
      return out;
    };
    this.hooked = true;
  }

  init() {
    this.hookReadiness();
    this.updateNavMeta();
  }

  show() {
    this.keep = new Set(this.landing ? [this.landing] : []);
    this.landing = null;
    this.render();
  }

  openItem(id, { fromRoute = false } = {}) {
    const item = GetReadyLogic.find(this.prep, id);
    if (item) {
      this.expanded.add(item.id);
      this.landing = item.id; // shown even when "only unticked" would hide it
    }
    if (window.app) window.app.switchTab('getready', { fromRoute });
    else this.show();
    if (!item) {
      if (fromRoute) window.app?.setRoute('getready', { replace: true });
      return;
    }
    if (!fromRoute) window.app?.setRoute(`getready/${item.id}`, { replace: true });
    const row = document.getElementById(`gr-item-${item.id}`);
    if (row) this.land(row);
  }

  // Scroll an item under the top bar (app.scrollToTarget: -72px and the landing pulse). Tailwind's CDN styles
  // freshly rendered classes a frame later and KaTeX fonts may still load, which can push the item down after
  // the scroll was aimed (19px on a cold deep link), so check again once the layout has settled.
  land(row) {
    if (!window.app) return row.scrollIntoView();
    window.app.scrollToTarget(row);
    // Only a layout shift moves the item on the page; the user's own scrolling does not, so it is never undone
    let aimed = row.getBoundingClientRect().top + window.scrollY;
    const realign = () => {
      if (!row.isConnected) return;
      const now = row.getBoundingClientRect().top + window.scrollY;
      if (Math.abs(now - aimed) <= 2) return;
      aimed = now;
      window.scrollTo({ top: Math.max(0, now - 72), behavior: 'smooth' });
    };
    setTimeout(realign, 300);
    setTimeout(realign, 1000);
  }

  // --- helpers ---
  esc(s) { return GetReadyLogic.escapeText(s); }
  html(s) { return GetReadyLogic.safeHtml(s); }
  // A verbatim quote: exact source text, our editorial marks inside it styled as ours
  quoteHtml(s) { return GetReadyLogic.markEditorial(GetReadyLogic.safeHtml(s)); }

  renderMath(el) {
    if (!el || typeof window.renderMathInElement !== 'function') return;
    try {
      window.renderMathInElement(el, {
        macros: { '\\mbox': '\\text{#1}' },
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '$', right: '$', display: false }
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'option'],
        throwOnError: false
      });
    } catch (e) {
      console.warn('KaTeX render notice:', e);
    }
  }

  isTicked(id) { return GetReadyLogic.isTicked(this.checks, id); }

  banks() {
    return {
      tasks: window.SELFTEST_BANK?.tasks || [],
      problems: window.PS_DATA?.PROBLEMS_BANK || []
    };
  }

  canOpenSheet() { return typeof window.formulaSheet?.open === 'function'; }

  // Practice entries that lead somewhere; unknown kinds and ids are skipped (and reported once in the console)
  practiceOf(item) {
    const banks = this.banks();
    const list = [];
    if (GET_READY_SHEET_ITEMS.has(item.id) && this.canOpenSheet()) list.push({ kind: 'sheet' });
    for (const entry of item.practice || []) {
      const resolved = GetReadyLogic.practice(entry, banks);
      if (resolved) list.push(resolved);
      else this.warnOnce(`${item.id}:${JSON.stringify(entry)}`, `Get ready: practice entry of ${item.id} skipped (unknown kind or id)`, entry);
    }
    return list;
  }

  reviewOf(item) {
    const defs = (item.defs || [])
      .map(id => (window.PS_DATA?.DEFINITIONS_21 || []).find(d => d.id === Number(id)))
      .filter(Boolean);
    const notes = (item.notes || [])
      .map(id => (window.PS_DATA?.TOPICS_NOTES || []).find(t => t.id === id))
      .filter(Boolean);
    return { defs, notes };
  }

  warnOnce(key, ...msg) {
    if (this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(...msg);
  }

  updateNavMeta() {
    const el = document.getElementById('getready-nav-meta');
    if (!el || !this.prep) return;
    const p = GetReadyLogic.progress(this.items, this.checks);
    el.textContent = `${p.ticked}/${p.total}`;
    el.title = `${p.ticked} of ${p.total} checklist items ticked`;
  }

  // --- render ---
  render() {
    const host = this.container;
    if (!host) return;
    this.bind(host);
    if (!this.items.length) {
      host.innerHTML = this.missingHtml();
      return;
    }
    host.innerHTML = `
      <div class="gr-root space-y-5">
        <span id="gr-can-label" hidden>I can do this:</span>
        ${this.headerHtml()}
        ${this.toolbarHtml()}
        ${(this.prep.groups || []).map(g => this.groupHtml(g)).join('')}
        ${this.footerHtml()}
      </div>`;
    for (const id of this.expanded) {
      const panel = document.getElementById(`gr-panel-${id}`);
      if (panel) this.fillPanel(id, panel);
    }
    this.renderMath(host);
    this.updateNavMeta();
  }

  visibleItems() {
    return GetReadyLogic.visible(this.items, this.checks, { onlyUnticked: this.onlyUnticked, keep: [...this.keep] });
  }

  missingHtml() {
    return `
      <div class="p-6 rounded-2xl border border-slate-800 bg-slate-900 text-center space-y-3">
        <p class="text-sm text-slate-200">The Midterm 2 checklist did not load.</p>
        <div class="flex flex-wrap justify-center gap-2">
          <button type="button" data-gr-reload class="px-4 py-2 rounded-lg border border-transparent bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer transition">${icon('rotate-ccw')} Reload the page</button>
          <button type="button" data-gr-tab="dashboard" class="px-4 py-2 rounded-lg border border-slate-700 bg-slate-950/40 hover:border-indigo-500 text-slate-200 text-sm font-semibold cursor-pointer transition">${icon('layout-dashboard')} Go to the overview</button>
        </div>
      </div>`;
  }

  headerHtml() {
    const src = this.prep.source || {};
    const sheetButtons = this.canOpenSheet() ? `
        <div class="flex flex-wrap gap-2 shrink-0">
          <button type="button" data-gr-sheet="drill" class="gr-btn border border-transparent bg-indigo-600 hover:bg-indigo-500 text-white">${icon('dumbbell')} Drill: name the rows</button>
          <button type="button" data-gr-sheet="exam" class="gr-btn border border-slate-700 bg-slate-950/40 hover:border-indigo-500 text-slate-200">${icon('eye')} See it as handed out</button>
        </div>` : '';
    return `
      <div class="p-5 sm:p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-xl space-y-4">
        <div class="flex items-start gap-3">
          <span class="hidden sm:inline-flex w-11 h-11 shrink-0 rounded-xl bg-indigo-950 border border-indigo-800 text-indigo-300 items-center justify-center text-xl">${icon('list-checks')}</span>
          <div class="min-w-0">
            <h2 class="text-2xl font-black text-slate-100 leading-tight">Get ready for Midterm 2</h2>
            <p class="mt-1 text-sm text-slate-300 leading-relaxed">
              “${this.esc(src.title || 'I am ready for Midterm 2 if')}”: the checklist by ${this.esc(src.author || 'R.H.')}${src.term ? ` (${this.esc(src.term)})` : ''}.
              Open an item to see what the lecture slides say about it, word for word.
            </p>
            ${src.typos ? `<p class="mt-1.5 text-[11px] leading-snug text-slate-400">${icon('info')} ${this.html(src.typos)}</p>` : ''}
          </div>
        </div>
        <div id="gr-progress">${this.progressHtml()}</div>
        <div id="gr-done" role="status" data-done="${GetReadyLogic.progress(this.items, this.checks).done}">${this.doneHtml()}</div>
        <div class="gr-ours rounded-xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex items-start gap-2.5 flex-1 min-w-0">
            <span class="text-lg leading-none text-amber-300 mt-0.5">${icon('sheet')}</span>
            <div class="min-w-0">
              <div class="text-[11px] font-bold text-amber-300">Our tip</div>
              <p class="text-sm text-slate-200">At the exam you get the formula sheet without labels.</p>
            </div>
          </div>
          ${sheetButtons}
        </div>
      </div>`;
  }

  progressHtml() {
    const p = GetReadyLogic.progress(this.items, this.checks);
    const pct = p.total ? Math.round((p.ticked / p.total) * 100) : 0;
    return `
      <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 mb-1.5">
        <span class="text-sm text-slate-300"><strong class="text-lg font-extrabold text-slate-100 tabular-nums" data-gr-ticked>${p.ticked}</strong> of <span class="tabular-nums">${p.total}</span> ticked</span>
        <span class="text-[11px] text-slate-400">Tick an item when you can do it</span>
      </div>
      <div class="gr-bar h-2 rounded-full bg-slate-700 overflow-hidden" role="progressbar" aria-label="Checklist items ticked" aria-valuemin="0" aria-valuemax="${p.total}" aria-valuenow="${p.ticked}">
        <span class="block h-full rounded-full ${p.done ? 'is-done' : ''}" style="width: ${pct}%"></span>
      </div>`;
  }

  // The sheet's own closing line, once every item on it is ticked (#gr-done is the live region around it)
  doneHtml() {
    const p = GetReadyLogic.progress(this.items, this.checks);
    if (!p.done) return '';
    return `
      <div class="gr-done flex items-center gap-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800">
        <span class="text-2xl leading-none text-emerald-400">${icon('party-popper')}</span>
        <div class="min-w-0">
          <p class="text-base font-bold text-emerald-300">“${this.esc(this.prep.source?.closing || 'Yes, I am now ready for Midterm 2!')}”</p>
          <p class="text-[11px] text-slate-400">The last line of the sheet: all ${p.total} items are ticked.</p>
        </div>
      </div>`;
  }

  groupCount(g) {
    return GetReadyLogic.progress(g.items, this.checks);
  }

  chipCountHtml(g) {
    const p = this.groupCount(g);
    return p.done
      ? `<span class="inline-flex items-center gap-0.5 text-emerald-400 tabular-nums">${icon('check')}${p.ticked}/${p.total}</span>`
      : `<span class="text-slate-400 tabular-nums">${p.ticked}/${p.total}</span>`;
  }

  toolbarHtml() {
    const chips = (this.prep.groups || []).map(g => `
      <button type="button" data-gr-jump="${this.esc(g.id)}" class="gr-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 hover:border-indigo-500 text-xs font-semibold text-slate-200 cursor-pointer transition" title="Jump to “${this.esc(g.title)}”">
        ${this.esc(GET_READY_SHORT[g.id] || g.title)} <span data-gr-count="${this.esc(g.id)}">${this.chipCountHtml(g)}</span>
      </button>`).join('');
    return `
      <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <nav class="flex flex-wrap items-center gap-1.5" aria-label="Checklist groups">
          <span class="text-xs font-semibold text-slate-400 mr-1">Jump to</span>
          ${chips}
        </nav>
        <button type="button" data-gr-filter role="switch" aria-checked="${this.onlyUnticked}" class="gr-switch self-start md:self-auto inline-flex items-center gap-2 px-1 py-1 rounded-lg text-xs font-semibold text-slate-300 cursor-pointer transition">
          <span class="gr-track" aria-hidden="true"><span class="gr-knob"></span></span>
          Only what I haven't ticked
        </button>
      </div>`;
  }

  groupHtml(g) {
    const items = GetReadyLogic.visible(g.items, this.checks, { onlyUnticked: this.onlyUnticked, keep: [...this.keep] });
    const p = this.groupCount(g);
    const sheet = GET_READY_SHEET_GROUPS.has(g.id) && this.canOpenSheet()
      ? `<button type="button" data-gr-sheet="drill" class="gr-btn border border-slate-700 bg-slate-950/40 hover:border-indigo-500 text-slate-200">${icon('sheet')} Drill the unlabelled formula sheet</button>`
      : '';
    const rows = items.length
      ? `<ul class="space-y-2">${items.map(i => this.rowHtml(i)).join('')}</ul>`
      : `<div class="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 rounded-xl border border-dashed border-slate-700 text-sm text-slate-300">
          <span class="text-emerald-400">${icon('circle-check')}</span> Everything here is ticked.
          <button type="button" data-gr-showall class="gr-link">Show all items</button>
        </div>`;
    return `
      <section id="gr-group-${this.esc(g.id)}" class="space-y-2.5" aria-labelledby="gr-group-title-${this.esc(g.id)}">
        <div class="flex flex-wrap items-end justify-between gap-x-3 gap-y-2 px-1">
          <div class="min-w-0">
            <h3 id="gr-group-title-${this.esc(g.id)}" class="text-base font-bold text-slate-100 leading-snug">${this.html(g.title)}</h3>
            <span class="text-xs text-slate-400 tabular-nums" data-gr-group-count="${this.esc(g.id)}">${p.ticked} of ${p.total} ticked</span>
          </div>
          ${sheet}
        </div>
        ${rows}
      </section>`;
  }

  checkboxHtml(id, ticked, labelled) {
    return `<button type="button" class="gr-check" role="checkbox" aria-checked="${ticked}" data-gr-check="${this.esc(id)}"
      aria-labelledby="gr-can-label ${labelled}" title="I can do this"><span class="gr-box">${icon('check')}</span></button>`;
  }

  rowHtml(item) {
    const id = this.esc(item.id);
    const ticked = this.isTicked(item.id);
    const open = this.expanded.has(item.id);
    const extra = GetReadyLogic.isExtra(item);
    const meta = GetReadyLogic.metaParts({
      quotes: item.quotes?.length || 0,
      examples: item.lectureExamples?.length || 0,
      practice: this.practiceOf(item).length,
      notes: item.tips?.length || 0
    });
    return `
      <li id="gr-item-${id}" data-gr-item="${id}" class="gr-item rounded-xl border border-slate-800 bg-slate-900${ticked ? ' is-ticked' : ''}${open ? ' is-open' : ''}">
        <div class="flex items-start gap-0.5 p-1.5">
          ${this.checkboxHtml(item.id, ticked, `gr-text-${id}`)}
          <button type="button" id="gr-open-${id}" class="gr-open flex-1 min-w-0 flex items-start gap-2 text-left rounded-lg px-2 py-1.5 cursor-pointer transition"
            aria-expanded="${open}" aria-controls="gr-panel-${id}" data-gr-toggle="${id}">
            <span class="flex-1 min-w-0">
              <span id="gr-text-${id}" class="gr-text block text-[15px] font-semibold text-slate-100 leading-snug">${this.html(item.text)}</span>
              ${item.typo ? `<span class="block mt-0.5 text-[11px] leading-snug text-slate-400">${extra ? '<span class="gr-extra border border-slate-700 text-slate-300">Extra</span> ' : `${icon('info')} `}${this.html(item.typo)}</span>` : ''}
              ${meta.length ? `<span class="block mt-1 text-xs text-slate-400 tabular-nums">${meta.join(' · ')}</span>` : ''}
            </span>
            <span class="gr-chevron mt-0.5 text-slate-400">${icon('chevron-down')}</span>
          </button>
        </div>
        <div id="gr-panel-${id}" class="gr-panel" role="region" aria-labelledby="gr-open-${id}"${open ? '' : ' hidden'}></div>
      </li>`;
  }

  footerHtml() {
    const lectures = Object.values(this.prep.lectures || {}).map(t => this.esc(t)).join('; ');
    return `
      <footer class="px-1 pt-1 pb-2 space-y-2 text-[11px] leading-relaxed text-slate-400">
        ${lectures ? `<p>${icon('presentation')} Quotes and examples are word for word from the lecture slides: ${lectures}.</p>` : ''}
        <p>${icon('message-square-text')} “Our notes”, “Our tip” and the <span class="gr-ed">amber marks</span> inside quotes, such as <span class="gr-ed">(sic: …)</span> or a slide pointer like <span class="gr-ed">L6 p13</span>, are ours, not from the slides.</p>
        <button type="button" data-gr-top class="gr-link">${icon('arrow-up')} Back to the top</button>
      </footer>`;
  }

  // --- the open item: lectures · examples · practice · review · our notes ---
  fillPanel(id, panel = document.getElementById(`gr-panel-${id}`)) {
    const item = GetReadyLogic.find(this.prep, id);
    if (!item || !panel) return;
    const lectures = this.prep.lectures || {};
    const section = (iconName, title, body, count = 0) => `
      <section class="space-y-2">
        <h4 class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">${icon(iconName)} ${title}${count ? ` <span class="font-semibold normal-case tracking-normal tabular-nums">· ${count}</span>` : ''}</h4>
        ${body}
      </section>`;
    const lectureQuote = (q, kind) => {
      const c = GetReadyLogic.citation(lectures, q);
      return `
        <figure class="gr-quote gr-quote-lecture">
          <figcaption class="flex flex-wrap items-center gap-x-2 gap-y-1 mb-1.5">
            ${kind ? `<span class="gr-kind ${GET_READY_KIND_CLS[String(kind).toLowerCase()] || 'bg-slate-800 text-slate-300'}">${this.esc(kind)}</span>` : ''}
            <cite class="not-italic text-[11px] font-semibold text-slate-400" title="${this.esc(c.title)}">${this.esc(c.label)}<span class="sr-only"> (${this.esc(c.title)})</span></cite>
          </figcaption>
          <blockquote class="gr-quote-text text-sm leading-relaxed text-slate-200">${this.quoteHtml(q.text)}</blockquote>
          ${q.note ? `<p class="mt-1.5 text-xs leading-relaxed text-amber-300"><span class="font-bold">Our note:</span> ${this.html(q.note)}</p>` : ''}
        </figure>`;
    };

    const parts = [];
    if (item.quotes?.length) {
      parts.push(section('presentation', 'From the lectures', `<div class="space-y-2.5">${item.quotes.map(q => lectureQuote(q, q.kind)).join('')}</div>`, item.quotes.length));
    }
    if (item.lectureExamples?.length) {
      parts.push(section('lightbulb', 'Examples from the lectures', `<div class="space-y-2.5">${item.lectureExamples.map(q => lectureQuote(q, '')).join('')}</div>`, item.lectureExamples.length));
    }
    const practice = this.practiceOf(item);
    parts.push(section('pencil-line', 'Practice from the course materials', practice.length
      ? `<div class="space-y-2">${practice.map(p => this.practiceHtml(p)).join('')}</div>`
      : `<p class="text-xs text-slate-400 leading-relaxed">No practice is linked to this item yet. Practise in
          <button type="button" data-gr-tab="problems" class="gr-link">Exam problems</button> or
          <button type="button" data-gr-tab="selftests" class="gr-link">LMS self-tests</button>.</p>`, practice.length));
    const review = this.reviewOf(item);
    if (review.defs.length || review.notes.length) {
      const ref = 'gr-ref border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-200';
      parts.push(section('book-open', 'Review', `<div class="flex flex-wrap gap-1.5">
        ${review.defs.map(d => `<button type="button" data-gr-def="${d.id}" class="${ref}" title="Colloquium definition ${d.id}">${icon('target', 'text-indigo-400')} <span class="font-bold text-indigo-400 tabular-nums">#${d.id}</span> ${this.esc(d.name)}</button>`).join('')}
        ${review.notes.map(n => `<button type="button" data-gr-notes="${this.esc(n.id)}" class="${ref}" title="Theory by topic">${icon('book-open', 'text-indigo-400')} ${this.esc(n.title)}</button>`).join('')}
      </div>`));
    }
    if (item.tips?.length) {
      parts.push(section('message-square-text', 'Our notes', `<div class="space-y-2">${item.tips.map(t => `
        <div class="gr-ours rounded-xl px-3.5 py-2.5">
          <div class="text-[11px] font-bold text-amber-300 mb-1">Our note, not from the slides</div>
          <div class="text-sm text-slate-200 leading-relaxed">${this.html(t)}</div>
        </div>`).join('')}</div>`));
    }

    panel.innerHTML = `
      <div class="border-t border-slate-800 px-3 sm:px-4 pt-3.5 pb-3.5 space-y-5">
        ${parts.join('')}
        <div class="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-800">
          <button type="button" class="gr-can gr-btn border border-slate-700 bg-slate-950/40 hover:border-emerald-500 text-slate-200" role="checkbox"
            aria-checked="${this.isTicked(item.id)}" data-gr-check="${this.esc(item.id)}"><span class="gr-box">${icon('check')}</span> I can do this</button>
          <button type="button" data-gr-next="${this.esc(item.id)}" class="gr-btn border border-slate-700 bg-slate-950/40 hover:border-indigo-500 text-slate-200"></button>
        </div>
      </div>`;
    this.labelNext(panel, item.id);
    this.renderMath(panel);
  }

  practiceHtml(p) {
    const card = (iconName, label, main, action) => `
      <div class="flex flex-col sm:flex-row sm:items-center gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-950/40">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">${icon(iconName)} ${label}</div>
          ${main ? `<div class="mt-0.5 text-sm text-slate-200 leading-relaxed gr-scroll">${main}</div>` : ''}
        </div>
        ${action}
      </div>`;
    const go = (attrs, iconName, text) => `<button type="button" ${attrs} class="gr-btn shrink-0 self-start sm:self-auto border border-transparent bg-indigo-600 hover:bg-indigo-500 text-white">${icon(iconName)} ${text}</button>`;
    switch (p.kind) {
      case 'sheet':
        return card('sheet', 'Exam formula sheet', 'The distribution table as handed out at the exam, without its labels.',
          go('data-gr-sheet="drill"', 'dumbbell', 'Drill the unlabelled formula sheet'));
      case 'selftest':
        return card('clipboard-check', this.esc(p.label), this.esc(p.text), go(`data-gr-selftest="${this.esc(p.id)}"`, 'play', 'Practise'));
      case 'problem':
        return card('notebook-pen', this.esc(p.label), `<span class="font-semibold">${this.esc(p.title)}</span>`, go(`data-gr-problem="${p.id}"`, 'arrow-right', 'Open problem'));
      case 'midterm2017': {
        const canOpen = typeof window.mockMidterm?.openPaper === 'function';
        return card('file-text', this.esc(p.label), '', canOpen ? go(`data-gr-paper="2017" data-gr-paper-problem="${p.problem}"`, 'arrow-right', 'Open') : '');
      }
      case 'source':
        return `
          <figure class="gr-quote gr-quote-source">
            <figcaption class="mb-1.5"><cite class="not-italic inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">${icon('file-text')} ${this.esc(p.label)}</cite></figcaption>
            <blockquote class="gr-quote-text text-sm leading-relaxed text-slate-200">${this.quoteHtml(p.html)}</blockquote>
          </figure>`;
      default:
        return '';
    }
  }

  // "Next item" in the open item's footer, or "Back to the top" after the last visible one
  labelNext(panel, id) {
    const btn = panel.querySelector('[data-gr-next]');
    if (!btn) return;
    const last = !this.nextVisibleId(id);
    btn.innerHTML = last ? `${icon('arrow-up')} Back to the top` : `Next item ${icon('arrow-down')}`;
  }

  visibleIds() {
    return [...(this.container?.querySelectorAll('[data-gr-item]') || [])].map(li => li.getAttribute('data-gr-item'));
  }

  nextVisibleId(id) {
    const ids = this.visibleIds();
    const i = ids.indexOf(id);
    return i >= 0 ? ids[i + 1] || null : null;
  }

  // --- interaction ---
  setExpanded(id, open, { route = true } = {}) {
    if (open) this.expanded.add(id);
    else this.expanded.delete(id);
    const li = document.getElementById(`gr-item-${id}`);
    if (!li) return;
    const panel = li.querySelector('.gr-panel');
    li.querySelector('[data-gr-toggle]')?.setAttribute('aria-expanded', String(open));
    li.classList.toggle('is-open', open);
    if (open) this.fillPanel(id, panel);
    if (panel) panel.hidden = !open;
    if (route) window.app?.setRoute(open ? `getready/${id}` : 'getready', { replace: true });
  }

  next(id) {
    const nextId = this.nextVisibleId(id);
    this.setExpanded(id, false, { route: false });
    if (!nextId) {
      window.app?.setRoute('getready', { replace: true });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      this.container?.querySelector('[data-gr-jump]')?.focus({ preventScroll: true });
      return;
    }
    this.setExpanded(nextId, true);
    const li = document.getElementById(`gr-item-${nextId}`);
    li?.querySelector('[data-gr-toggle]')?.focus({ preventScroll: true });
    window.app?.scrollToTarget(li);
  }

  setFilter(on) {
    this.onlyUnticked = !!on;
    try { localStorage.setItem(GET_READY_FILTER_KEY, on ? '1' : '0'); } catch (e) {}
    this.keep.clear();
    this.render();
  }

  // One delegated listener survives every re-render of the section
  bind(host) {
    if (host.dataset.grBound) return;
    host.dataset.grBound = 'true';
    host.addEventListener('click', e => {
      const el = e.target.closest('button');
      if (!el || !host.contains(el)) return;
      const d = el.dataset;
      if (d.grCheck !== undefined) return this.setTick(d.grCheck, !this.isTicked(d.grCheck));
      if (d.grToggle !== undefined) return this.setExpanded(d.grToggle, !this.expanded.has(d.grToggle));
      if (d.grNext !== undefined) return this.next(d.grNext);
      if (d.grJump !== undefined) return window.app?.scrollToTarget(`gr-group-${d.grJump}`);
      if (d.grFilter !== undefined) {
        this.setFilter(!this.onlyUnticked);
        return host.querySelector('[data-gr-filter]')?.focus();
      }
      if (d.grShowall !== undefined) {
        this.setFilter(false);
        return host.querySelector('[data-gr-filter]')?.focus();
      }
      if (d.grSheet !== undefined) return window.formulaSheet?.open?.({ mode: d.grSheet });
      if (d.grSelftest !== undefined) return window.selfTestBank?.startTask(d.grSelftest);
      if (d.grProblem !== undefined) return window.app?.openProblem(Number(d.grProblem));
      if (d.grPaper !== undefined) return window.mockMidterm?.openPaper?.(d.grPaper, { problem: Number(d.grPaperProblem) });
      if (d.grDef !== undefined) return window.app?.openDefinition(Number(d.grDef));
      if (d.grNotes !== undefined) return window.app?.openTopic(d.grNotes);
      if (d.grTab !== undefined) return window.app?.switchTab(d.grTab);
      if (d.grTop !== undefined) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return host.querySelector('[data-gr-jump]')?.focus({ preventScroll: true });
      }
      if (d.grReload !== undefined) return location.reload();
    });
  }

  // In-place refresh after a tick or a readiness change elsewhere: focus and scroll stay where they are
  sync() {
    this.updateNavMeta();
    const host = this.container;
    const root = host?.querySelector('.gr-root');
    if (!root || !this.prep) return;
    // "Only unticked" view: an item unticked on another device belongs on the page now
    if (this.onlyUnticked) {
      const shown = new Set(this.visibleIds());
      if (this.visibleItems().some(i => !shown.has(i.id))) return this.render();
    }
    root.querySelectorAll('[data-gr-check]').forEach(btn => btn.setAttribute('aria-checked', String(this.isTicked(btn.getAttribute('data-gr-check')))));
    root.querySelectorAll('[data-gr-item]').forEach(li => li.classList.toggle('is-ticked', this.isTicked(li.getAttribute('data-gr-item'))));
    for (const g of this.prep.groups || []) {
      const p = this.groupCount(g);
      const chip = root.querySelector(`[data-gr-count="${g.id}"]`);
      if (chip) chip.innerHTML = this.chipCountHtml(g);
      const head = root.querySelector(`[data-gr-group-count="${g.id}"]`);
      if (head) head.textContent = `${p.ticked} of ${p.total} ticked`;
    }
    const p = GetReadyLogic.progress(this.items, this.checks);
    const ticked = root.querySelector('[data-gr-ticked]');
    if (ticked) ticked.textContent = String(p.ticked);
    const bar = root.querySelector('.gr-bar');
    if (bar) {
      bar.setAttribute('aria-valuenow', String(p.ticked));
      bar.firstElementChild.style.width = `${p.total ? Math.round((p.ticked / p.total) * 100) : 0}%`;
      bar.firstElementChild.classList.toggle('is-done', p.done);
    }
    // The closing line appears (and is announced) only when "done" flips
    const done = root.querySelector('#gr-done');
    if (done && done.dataset.done !== String(p.done)) {
      done.dataset.done = String(p.done);
      done.innerHTML = this.doneHtml();
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GetReadyLogic };
} else {
  window.getReady = new GetReady(window.MIDTERM_PREP);
}
