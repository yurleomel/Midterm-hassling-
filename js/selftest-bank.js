// ========================================================
// LMS Self-test Bank: the unique tasks from Moodle self-tests 4–6, drilled by
// topic, task type and difficulty. Data: js/selftest-data.js (window.SELFTEST_BANK).
// Progress is part of the readiness state (js/quiz.js), so it follows the account.
// UCU Probability & Statistics Midterm 2
// ========================================================

// Pure logic — DOM-free so it can be unit-tested with `node --test`.
const SelfTestLogic = {
  DIFFICULTIES: ['easy', 'medium', 'hard'],

  // filters: { topic: 'all'|4|5|6, type: 'all'|typeId, difficulty: 'all'|'easy'|..., onlyUnsolved: bool }
  filter(tasks, { topic = 'all', type = 'all', difficulty = 'all', onlyUnsolved = false } = {}, stats = {}) {
    return tasks.filter(t =>
      (topic === 'all' || t.topic === Number(topic)) &&
      (type === 'all' || t.type === type) &&
      (difficulty === 'all' || t.difficulty === difficulty) &&
      (!onlyUnsolved || !stats[t.id]?.solved));
  },

  countBy(tasks, key) {
    return tasks.reduce((acc, t) => ((acc[t[key]] = (acc[t[key]] || 0) + 1), acc), {});
  },

  shuffle(items, rand = Math.random) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // n random tasks (all of them when n exceeds the pool)
  pick(tasks, n, rand = Math.random) {
    return this.shuffle(tasks, rand).slice(0, Math.max(0, Math.min(n, tasks.length)));
  },

  // Display order of the answer options; Moodle reshuffles them on every attempt too
  optionOrder(task, rand = Math.random) {
    const idx = (task.options || []).map((_, i) => i);
    return task.format === 'single' || task.format === 'multi' ? this.shuffle(idx, rand) : idx;
  },

  // "0.5", "0,5", "1/2", " -3 " -> number; NaN when it is not a number
  parseNumber(input) {
    const s = String(input ?? '').trim().replace(',', '.');
    const frac = s.match(/^(-?\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (frac) return Number(frac[1]) / Number(frac[2]);
    return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(s) ? Number(s) : NaN;
  },

  // response by format: single -> option index | multi -> option indices | tf -> bool
  // numeric -> string | match / gaps -> array of chosen strings (null = left empty)
  // returns { correct: bool, score: 0..1 }; multi-select partial score = (right picks − wrong picks) / all right options
  grade(task, response) {
    switch (task.format) {
      case 'single':
        return this.result(task.options[response]?.correct === true);
      case 'multi': {
        const picked = new Set(response || []);
        const right = task.options.filter(o => o.correct).length;
        const hits = task.options.filter((o, i) => o.correct && picked.has(i)).length;
        const misses = task.options.filter((o, i) => !o.correct && picked.has(i)).length;
        return { correct: hits === right && misses === 0, score: Math.max(0, (hits - misses) / right) };
      }
      case 'tf':
        return this.result(response === task.answer);
      case 'numeric': {
        const got = this.parseNumber(response);
        const want = this.parseNumber(task.answer);
        return this.result(Number.isFinite(got) && Math.abs(got - want) <= 1e-6 * Math.max(1, Math.abs(want)));
      }
      case 'match':
      case 'gaps': {
        const ok = task.answer.filter((a, i) => (response || [])[i] === a).length;
        return { correct: ok === task.answer.length, score: ok / task.answer.length };
      }
      default:
        return this.result(false);
    }
  },

  result(correct) {
    return { correct, score: correct ? 1 : 0 };
  },

  // A response the user has actually filled in (the check button stays disabled until then)
  isAnswered(task, response) {
    if (task.format === 'multi') return Array.isArray(response) && response.length > 0;
    if (task.format === 'numeric') return String(response ?? '').trim() !== '';
    if (task.format === 'match' || task.format === 'gaps') {
      return Array.isArray(response) && task.answer.every((_, i) => response[i]);
    }
    return response !== null && response !== undefined;
  },

  // Per-task history: solved stays true once the task was answered correctly
  recordResult(stats, taskId, correct, now = Date.now()) {
    const prev = stats[taskId] || { attempts: 0, correct: 0, solved: false };
    return {
      ...stats,
      [taskId]: {
        attempts: prev.attempts + 1,
        correct: prev.correct + (correct ? 1 : 0),
        solved: prev.solved || correct,
        lastCorrect: correct,
        lastAt: now
      }
    };
  },

  // A topic's self-tests count towards Readiness once this share of its tasks has been solved
  TOPIC_PASS_SHARE: 0.8,

  // [{ topic, total, solved, need, passed }] — `need` = solved tasks required for the topic to count
  topicProgress(tasks, topics, stats = {}) {
    return topics.map(({ id }) => {
      const own = tasks.filter(t => t.topic === id);
      const solved = own.filter(t => stats[t.id]?.solved).length;
      const need = Math.ceil(own.length * this.TOPIC_PASS_SHARE);
      return { topic: id, total: own.length, solved, need, passed: own.length > 0 && solved >= need };
    });
  },

  // Local vs cloud progress: keep the best of both per task (used by the profile merge)
  mergeStats(a = {}, b = {}) {
    const out = { ...a };
    for (const [id, s] of Object.entries(b || {})) {
      const p = out[id];
      out[id] = !p ? { ...s } : {
        attempts: Math.max(p.attempts || 0, s.attempts || 0),
        correct: Math.max(p.correct || 0, s.correct || 0),
        solved: !!(p.solved || s.solved),
        lastCorrect: (s.lastAt || 0) > (p.lastAt || 0) ? s.lastCorrect : p.lastCorrect,
        lastAt: Math.max(p.lastAt || 0, s.lastAt || 0)
      };
    }
    return out;
  },

  summarize(results) {
    const byType = {};
    results.forEach(r => {
      const row = (byType[r.task.type] = byType[r.task.type] || { total: 0, correct: 0 });
      row.total++;
      if (r.correct) row.correct++;
    });
    return { total: results.length, correct: results.filter(r => r.correct).length, byType };
  }
};

class SelfTestBank {
  constructor(bank) {
    this.bank = bank || { topics: [], types: [], tasks: [] };
    this.typeById = new Map(this.bank.types.map(t => [t.id, t]));
    this.filters = { topic: 'all', type: 'all', difficulty: 'all', onlyUnsolved: false };
    this.count = 10;
    this.session = null;   // { items: [{ task, order }], index, results, response, checked, passedBefore }
    this.fallbackStats = {};
    this.typeInfo = null;  // the open task type window: { type, tasks, index, revealed, opener }
    this.onTypeInfoKey = e => { if (e.key === 'Escape') this.closeTypeInfo(); };
  }

  // --- persistence: part of the readiness state, so it follows the account like the rest of the progress ---
  get stats() {
    const rs = window.quizManager?.readinessState;
    if (!rs) return this.fallbackStats;
    if (!rs.selfTestStats) rs.selfTestStats = {};
    return rs.selfTestStats;
  }

  set stats(next) {
    const rs = window.quizManager?.readinessState;
    if (rs) rs.selfTestStats = next;
    else this.fallbackStats = next;
  }

  saveStats() {
    window.quizManager?.saveReadiness();
  }

  topicProgress() {
    return SelfTestLogic.topicProgress(this.bank.tasks, this.bank.topics, this.stats);
  }

  passedTopics() {
    return this.topicProgress().filter(p => p.passed).map(p => p.topic);
  }

  // Self-test tasks currently in the dashboard's mistakes registry, most-missed first
  mistakeTasks() {
    const history = window.userProfile?.profile?.mistakesHistory || {};
    const byId = new Map(this.bank.tasks.map(t => [SelfTestBank.MISTAKE_PREFIX + t.id, t]));
    return Object.values(history)
      .filter(m => m.type === 'selftest' && byId.has(m.id))
      .sort((a, b) => b.count - a.count)
      .map(m => byId.get(m.id));
  }

  // Entry points used by the dashboard's mistakes panel
  startMistakes() {
    const tasks = this.mistakeTasks();
    window.app?.switchTab('selftests');
    if (tasks.length) this.start(tasks);
    else this.renderSetup();
  }

  startTask(taskId, { fromRoute = false } = {}) {
    const task = this.bank.tasks.find(t => t.id === taskId);
    window.app?.switchTab('selftests', { fromRoute });
    if (!task) return;
    this.start([task]);
    if (!fromRoute) window.app?.setRoute(`selftests/${task.id}`, { replace: true });
  }

  get container() {
    return document.getElementById('selftest-container');
  }

  init() {
    this.renderSetup();
  }

  show() {
    if (!this.session) this.renderSetup();
  }

  // --- helpers ---
  esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  renderMath(el) {
    if (el && typeof window.renderMathInElement === 'function') {
      window.renderMathInElement(el, {
        macros: { '\\mbox': '\\text{#1}' },
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
  }

  topicLabel(id) {
    return this.bank.topics.find(t => t.id === id)?.label || `Topic ${id}`;
  }

  topicName(id) {
    return this.topicLabel(id).replace(/^Topic \d+ · /, '');
  }

  difficultyBadge(d) {
    const map = {
      easy: ['easy', 'bg-emerald-950 text-emerald-300 border-emerald-700'],
      medium: ['medium', 'bg-amber-950 text-amber-300 border-amber-700'],
      hard: ['hard', 'bg-rose-950 text-rose-300 border-rose-700']
    };
    const [label, cls] = map[d] || [d, 'bg-slate-800 text-slate-300 border-slate-700'];
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}">${label}</span>`;
  }

  solvedOf(tasks) {
    return tasks.filter(t => this.stats[t.id]?.solved).length;
  }

  definitionName(id) {
    return (window.PS_DATA?.DEFINITIONS_21 || []).find(d => d.id === id)?.name || `Definition ${id}`;
  }

  // Buttons that jump to the colloquium definitions behind a task type
  reviewLinks(type) {
    if (!type?.defs?.length) return '';
    return type.defs.map(id => `<button class="st-def-link inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-xs text-slate-200 cursor-pointer transition" data-def="${id}">
      <span class="font-bold text-indigo-400">#${id}</span> ${this.esc(this.definitionName(id))}</button>`).join('');
  }

  bindReviewLinks(root, before = () => {}) {
    root.querySelectorAll('.st-def-link').forEach(btn => btn.addEventListener('click', () => {
      before();
      window.app?.openDefinition(Number(btn.getAttribute('data-def')));
    }));
  }

  // The correct answer of a task, for feedback and the type examples
  answerHtml(task) {
    switch (task.format) {
      case 'single':
      case 'multi':
        return task.options.filter(o => o.correct).map(o => this.optionHtml(o.text)).join('<br>');
      case 'tf': return task.answer ? 'True' : 'False';
      case 'numeric': return this.esc(task.answer);
      case 'match': return task.stems.map((st, i) => `${this.esc(st)} → <strong>${this.esc(task.answer[i])}</strong>`).join('<br>');
      case 'gaps': return task.answer.map(a => `[${this.esc(a)}]`).join(' ');
      default: return '';
    }
  }

  // A choice that is a single formula with fractions reads better in display style (inline \frac is tiny)
  optionHtml(text) {
    const html = this.esc(text);
    return /^\\\((?:(?!\\\)).)*\\frac(?:(?!\\\)).)*\\\)$/s.test(String(text).trim()) ? html.replace('\\(', '\\(\\displaystyle ') : html;
  }

  // --- setup: 1 topic · 2 task type · 3 difficulty · start ---
  renderSetup() {
    const host = this.container;
    if (!host) return;
    this.session = null;
    const all = this.bank.tasks;
    const f = this.filters;

    // Counts describe the whole bank (a fully solved type stays visible); "only unsolved" narrows the pool only
    const counted = { ...f, onlyUnsolved: false };
    const inTopic = SelfTestLogic.filter(all, { ...counted, type: 'all', difficulty: 'all' });
    const typesHere = this.bank.types.filter(t => inTopic.some(x => x.type === t.id));
    if (f.type !== 'all' && !typesHere.some(t => t.id === f.type)) f.type = 'all';
    const inType = SelfTestLogic.filter(all, { ...counted, type: f.type, difficulty: 'all' });
    const pool = SelfTestLogic.filter(all, f, this.stats);
    const count = Math.min(Math.max(1, this.count), Math.max(1, pool.length));
    const mistakes = this.mistakeTasks();
    const solvedAll = this.solvedOf(all);
    const progress = this.topicProgress();
    const step = (n, title, hint = '') => `
      <div class="flex items-baseline gap-2 mb-2">
        <span class="w-5 h-5 shrink-0 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-[11px] font-bold inline-flex items-center justify-center">${n}</span>
        <span class="text-sm font-bold text-slate-100">${title}</span>
        ${hint ? `<span class="text-xs text-slate-400">${hint}</span>` : ''}
      </div>`;
    const selectable = active => active
      ? 'border-indigo-500 bg-indigo-950/50 ring-1 ring-indigo-500/50'
      : 'border-slate-800 bg-slate-950/40 hover:border-slate-600';

    // 1 · topic cards = filter + progress towards the topic's +1%
    const topicCard = (id, title, sub, solved, total, extra) => `
      <button class="st-topic flex flex-col text-left p-3 rounded-xl border cursor-pointer transition ${selectable(f.topic === id)}" data-topic="${id}" aria-pressed="${f.topic === id}">
        <span class="text-sm font-bold text-slate-100">${title}</span>
        <span class="text-[11px] text-slate-400 leading-snug">${sub}</span>
        <span class="block mt-auto pt-2">
          <span class="relative block h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <span class="block h-full rounded-full ${extra?.passed ? 'bg-emerald-500' : 'bg-indigo-500'}" style="width: ${Math.round((solved / Math.max(1, total)) * 100)}%"></span>
            ${extra ? `<span class="absolute top-0 h-full w-0.5 bg-slate-400/80" style="left: ${Math.round((extra.need / Math.max(1, total)) * 100)}%"></span>` : ''}
          </span>
          <span class="block mt-1 text-[11px] ${extra?.passed ? 'text-emerald-400 font-semibold' : 'text-slate-400'}">
            ${extra?.passed ? `${icon('check')} +1% readiness earned` : `${solved}/${total} solved${extra ? ` · +1% at ${extra.need}` : ''}`}
          </span>
        </span>
      </button>`;
    const topicCards = [topicCard('all', 'All topics', 'Topics 4–6', solvedAll, all.length, null)]
      .concat(progress.map(p => topicCard(p.topic, `Topic ${p.topic}`, this.esc(this.topicName(p.topic)), p.solved, p.total, p)))
      .join('');

    // 2 · task types: tap opens the type window (description + examples); "All types" selects directly
    const chipCls = active => `flex items-center gap-1.5 text-left px-2.5 sm:px-3 py-2 rounded-xl border text-xs font-semibold text-slate-200 cursor-pointer transition ${selectable(active)}`;
    const typeChip = t => {
      const active = f.type === t.id;
      return `<button class="st-type ${chipCls(active)}" data-type="${t.id}" aria-haspopup="dialog" ${active ? 'aria-current="true"' : ''} title="What these tasks ask">
        ${active ? icon('check', 'text-indigo-400 shrink-0') : ''}
        <span class="flex-1 sm:flex-none leading-snug">${this.esc(t.label)}</span>
        <span class="shrink-0 inline-flex items-center gap-1 text-slate-400 tabular-nums">${inTopic.filter(x => x.type === t.id).length}<span class="text-slate-500">${icon('info')}</span></span>
      </button>`;
    };
    const typeChips = `<button class="st-type-all col-span-2 ${chipCls(f.type === 'all')}" aria-pressed="${f.type === 'all'}">
        ${f.type === 'all' ? icon('check', 'text-indigo-400 shrink-0') : ''}<span class="flex-1 sm:flex-none">All types</span>
        <span class="shrink-0 text-slate-400 tabular-nums">${inTopic.length}</span>
      </button>` + typesHere.map(typeChip).join('');

    // 3 · difficulty (segmented) + only unsolved
    const diffCounts = SelfTestLogic.countBy(inType, 'difficulty');
    const diffSeg = [['all', 'Any', inType.length], ['easy', 'Easy', diffCounts.easy || 0], ['medium', 'Medium', diffCounts.medium || 0], ['hard', 'Hard', diffCounts.hard || 0]]
      .map(([d, l, n]) => `<button class="st-diff px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition ${f.difficulty === d ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}" data-diff="${d}" aria-pressed="${f.difficulty === d}">${l} <span class="${f.difficulty === d ? 'opacity-70' : 'text-slate-500'}">${n}</span></button>`)
      .join('');

    host.innerHTML = `
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="text-lg font-bold text-slate-100">LMS self-tests</h3>
            <p class="text-xs text-slate-400 mt-0.5">${all.length} unique tasks from the Moodle self-tests for topics 4–6, word for word. Solve ${Math.round(SelfTestLogic.TOPIC_PASS_SHARE * 100)}% of a topic to add +1% readiness.</p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <span class="text-xs text-slate-400"><strong class="text-emerald-400">${solvedAll}</strong>/${all.length} solved</span>
            ${mistakes.length ? `<button id="st-mistakes" class="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 hover:border-rose-600 text-xs font-semibold cursor-pointer transition">${icon('repeat')} Retry my mistakes (${mistakes.length})</button>` : ''}
          </div>
        </div>

        <section>
          ${step(1, 'Topic')}
          <div class="grid grid-cols-2 lg:grid-cols-4 gap-2">${topicCards}</div>
        </section>

        <section>
          ${step(2, 'Task type', 'tap a type to see what it asks')}
          <div class="grid grid-cols-2 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">${typeChips}</div>
        </section>

        <section>
          ${step(3, 'Difficulty')}
          <div class="flex flex-wrap items-center gap-3">
            <div class="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-950/60 border border-slate-800">${diffSeg}</div>
            <label class="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
              <input type="checkbox" id="st-only-unsolved" class="w-4 h-4 cursor-pointer accent-indigo-500" ${f.onlyUnsolved ? 'checked' : ''}>
              Only tasks I haven't solved yet
            </label>
          </div>
        </section>

        <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
          ${pool.length ? `
            <div class="flex flex-wrap items-center gap-2 text-xs text-slate-300">
              <span class="font-semibold">How many</span>
              <div class="inline-flex items-center rounded-lg border border-slate-700 overflow-hidden">
                <button class="st-step-btn px-2.5 py-1.5 bg-slate-950/50 hover:bg-slate-800 text-slate-300 cursor-pointer transition" data-delta="-1" aria-label="Fewer">${icon('minus')}</button>
                <input id="st-count" type="number" inputmode="numeric" min="1" max="${pool.length}" value="${count}" aria-label="Number of tasks" class="w-14 py-1.5 text-center bg-slate-950 border-x border-slate-700 text-slate-100 text-base sm:text-sm">
                <button class="st-step-btn px-2.5 py-1.5 bg-slate-950/50 hover:bg-slate-800 text-slate-300 cursor-pointer transition" data-delta="1" aria-label="More">${icon('plus')}</button>
              </div>
              <span class="text-slate-400">of ${pool.length}</span>
              ${count < pool.length ? `<button class="st-all-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-300 cursor-pointer transition">All</button>` : ''}
            </div>
            <button id="st-start" class="sm:ml-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer transition flex items-center justify-center gap-2">
              ${icon('play')} <span id="st-start-label">Start ${count} ${count === 1 ? 'task' : 'tasks'}</span>
            </button>
          ` : `
            <div class="text-xs text-slate-400">No tasks match these filters${f.onlyUnsolved ? ' — looks like you have solved them all' : ''}.</div>
            <button id="st-reset" class="sm:ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition">${icon('rotate-ccw')} Reset filters</button>
          `}
        </div>
      </div>
    `;

    host.querySelectorAll('.st-topic').forEach(btn => btn.addEventListener('click', () => {
      const raw = btn.getAttribute('data-topic');
      this.filters.topic = raw === 'all' ? 'all' : Number(raw);
      this.renderSetup();
    }));
    host.querySelector('.st-type-all')?.addEventListener('click', () => { this.filters.type = 'all'; this.renderSetup(); });
    host.querySelectorAll('.st-type').forEach(btn => btn.addEventListener('click', () => this.openTypeInfo(btn.getAttribute('data-type'), btn)));
    host.querySelectorAll('.st-diff').forEach(btn => btn.addEventListener('click', () => { this.filters.difficulty = btn.getAttribute('data-diff'); this.renderSetup(); }));
    host.querySelector('#st-only-unsolved')?.addEventListener('change', e => { this.filters.onlyUnsolved = e.target.checked; this.renderSetup(); });

    const countInput = host.querySelector('#st-count');
    const clampCount = raw => Math.min(Math.max(1, parseInt(raw, 10) || 1), pool.length);
    const setCount = n => {
      this.count = clampCount(n);
      if (countInput) countInput.value = this.count;
      const label = host.querySelector('#st-start-label');
      if (label) label.textContent = `Start ${this.count} ${this.count === 1 ? 'task' : 'tasks'}`;
    };
    countInput?.addEventListener('input', () => setCount(countInput.value || 1));
    countInput?.addEventListener('change', () => setCount(countInput.value));
    host.querySelectorAll('.st-step-btn').forEach(btn => btn.addEventListener('click', () => setCount((this.count || count) + Number(btn.getAttribute('data-delta')))));
    host.querySelector('.st-all-btn')?.addEventListener('click', () => { this.count = pool.length; this.renderSetup(); });
    host.querySelector('#st-start')?.addEventListener('click', () => {
      setCount(countInput?.value ?? count);
      this.start(SelfTestLogic.pick(pool, this.count));
    });
    host.querySelector('#st-mistakes')?.addEventListener('click', () => this.startMistakes());
    host.querySelector('#st-reset')?.addEventListener('click', () => {
      this.filters = { topic: 'all', type: 'all', difficulty: 'all', onlyUnsolved: false };
      this.renderSetup();
    });
    this.renderMath(host);
  }

  // --- task type window: what the type asks, real examples, theory to review ---
  openTypeInfo(typeId, opener = null) {
    const type = this.typeById.get(typeId);
    if (!type) return;
    this.closeTypeInfo({ restoreFocus: false });
    const tasks = this.bank.tasks.filter(t => t.type === typeId);
    this.typeInfo = { type, tasks, index: 0, revealed: false, opener };
    const solved = this.solvedOf(tasks);
    const navBtn = (step, label, name) => `<button class="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer transition disabled:opacity-30 disabled:cursor-not-allowed" data-ex="${step}" aria-label="${label}">${icon(name)}</button>`;

    const modal = document.createElement('div');
    modal.id = 'st-type-modal';
    modal.className = 'fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'st-type-title');
    modal.innerHTML = `
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" data-close></div>
      <div class="relative w-full sm:max-w-2xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl">
        <div class="overflow-y-auto overscroll-contain p-5 space-y-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="flex flex-wrap items-center gap-1.5 mb-1">
                ${type.topics.map(t => `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">Topic ${t}</span>`).join('')}
                <span class="text-[11px] text-slate-400">${tasks.length} ${tasks.length === 1 ? 'task' : 'tasks'} · ${solved} solved</span>
              </div>
              <h3 id="st-type-title" class="text-lg font-bold text-slate-100">${this.esc(type.label)}</h3>
            </div>
            <button class="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer transition" data-close aria-label="Close">${icon('x')}</button>
          </div>
          <p class="text-sm text-slate-300 leading-relaxed">${this.esc(type.about)}</p>

          <div class="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div class="flex items-center justify-between gap-2 mb-2">
              <span id="st-ex-counter" class="text-[11px] font-bold uppercase tracking-wider text-slate-400"></span>
              <span class="flex items-center gap-1">
                <span id="st-ex-diff"></span>
                ${tasks.length > 1 ? navBtn(-1, 'Previous example', 'chevron-left') + navBtn(1, 'Next example', 'chevron-right') : ''}
              </span>
            </div>
            <div id="st-ex-body"></div>
          </div>

          ${type.defs?.length ? `
            <div>
              <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Theory to review</div>
              <div class="flex flex-wrap gap-1.5">${this.reviewLinks(type)}</div>
              ${type.lecture ? `<div class="mt-1.5 text-[11px] text-slate-400">${icon('book-open')} Lecture slides: ${this.esc(type.lecture)}</div>` : ''}
            </div>` : ''}
        </div>
        <div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-3 border-t border-slate-800">
          <button class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold cursor-pointer transition" data-close>Close</button>
          <button class="st-select-type px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold cursor-pointer transition">${icon('check')} Practise this type</button>
        </div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', () => this.closeTypeInfo()));
    modal.querySelectorAll('[data-ex]').forEach(btn => btn.addEventListener('click', () => {
      const ti = this.typeInfo;
      ti.index = Math.min(Math.max(0, ti.index + Number(btn.getAttribute('data-ex'))), tasks.length - 1);
      ti.revealed = false;
      this.renderTypeExample();
      if (btn.disabled) modal.querySelector(`[data-ex="${-Number(btn.getAttribute('data-ex'))}"]`)?.focus(); // reached an end
    }));
    modal.querySelector('.st-select-type').addEventListener('click', () => {
      this.filters.type = type.id;
      if (this.filters.topic !== 'all' && !type.topics.includes(this.filters.topic)) this.filters.topic = 'all';
      this.closeTypeInfo({ restoreFocus: false });
      this.renderSetup();
      document.getElementById('st-start')?.focus();
    });
    this.bindReviewLinks(modal, () => this.closeTypeInfo({ restoreFocus: false }));
    document.addEventListener('keydown', this.onTypeInfoKey);
    this.renderTypeExample();
    modal.querySelector('[data-close][aria-label]').focus();
  }

  closeTypeInfo({ restoreFocus = true } = {}) {
    document.getElementById('st-type-modal')?.remove();
    document.removeEventListener('keydown', this.onTypeInfoKey);
    const opener = this.typeInfo?.opener;
    this.typeInfo = null;
    if (restoreFocus && opener?.isConnected) opener.focus();
  }

  // Only the example re-renders, so the window keeps its scroll position and focus
  renderTypeExample() {
    const ti = this.typeInfo;
    const modal = document.getElementById('st-type-modal');
    if (!ti || !modal) return;
    const task = ti.tasks[ti.index];
    modal.querySelector('#st-ex-counter').textContent = `Example ${ti.index + 1} of ${ti.tasks.length}`;
    modal.querySelector('#st-ex-diff').innerHTML = this.difficultyBadge(task.difficulty);
    modal.querySelectorAll('[data-ex]').forEach(btn => {
      const to = ti.index + Number(btn.getAttribute('data-ex'));
      btn.disabled = to < 0 || to >= ti.tasks.length;
    });
    const body = modal.querySelector('#st-ex-body');
    body.innerHTML = `
      <div class="text-sm font-semibold text-slate-100 mb-3 leading-relaxed">${this.renderQuestion(task)}</div>
      ${this.examplePreview(task, ti.revealed)}
      <div class="mt-3">${ti.revealed ? `
        <div class="st-ex-answer p-3 rounded-lg bg-emerald-950/40 border border-emerald-800 text-sm text-emerald-200 space-y-1 outline-none" tabindex="-1">
          <div><strong>Answer:</strong> ${this.answerHtml(task)}</div>
          <div class="text-slate-200"><strong>Why:</strong> ${this.esc(task.explanation)}</div>
        </div>` : `<button class="st-reveal text-xs font-semibold text-indigo-400 hover:text-indigo-300 cursor-pointer transition">${icon('eye')} Show the answer</button>`}
      </div>`;
    body.querySelectorAll('select').forEach(sel => { sel.disabled = true; }); // the gap-fill example is read-only
    body.querySelector('.st-reveal')?.addEventListener('click', () => {
      ti.revealed = true;
      this.renderTypeExample();
      body.querySelector('.st-ex-answer')?.focus({ preventScroll: true });
    });
    this.renderMath(body);
  }

  // How the answer is given, without live inputs; the right options light up once revealed
  examplePreview(task, revealed) {
    switch (task.format) {
      case 'single':
      case 'multi':
        return `${task.format === 'multi' ? '<p class="text-[11px] text-slate-400 mb-1">Select all that apply.</p>' : ''}
          <ol class="space-y-1">${task.options.map((o, k) => `<li class="flex gap-2 text-sm px-2 py-1 rounded-lg ${revealed && o.correct ? 'bg-emerald-950/60 text-emerald-200' : 'text-slate-300'}">
            <span class="font-bold text-slate-400">${String.fromCharCode(97 + k)}</span><span>${this.optionHtml(o.text)}</span></li>`).join('')}</ol>`;
      case 'tf': return '<p class="text-sm text-slate-300">True or false?</p>';
      case 'numeric': return '<p class="text-sm text-slate-300">Answer with a number.</p>';
      case 'match': return `<ul class="space-y-1 text-sm text-slate-300">${task.stems.map(st => `<li>${this.esc(st)} → ?</li>`).join('')}</ul>
        <p class="text-[11px] text-slate-400 mt-1">Choices: ${task.choices.map(c => this.esc(c)).join(' · ')}</p>`;
      default: return '';
    }
  }

  // --- drill ---
  start(tasks) {
    this.session = {
      items: tasks.map(task => ({ task, order: SelfTestLogic.optionOrder(task) })),
      index: 0,
      results: [],
      passedBefore: this.passedTopics()
    };
    this.renderTask();
  }

  emptyResponse(task) {
    if (task.format === 'multi') return [];
    if (task.format === 'match' || task.format === 'gaps') return task.answer.map(() => null);
    if (task.format === 'numeric') return '';
    return null;
  }

  renderTask() {
    const host = this.container;
    const s = this.session;
    if (!host || !s) return;
    if (s.index >= s.items.length) return this.renderResults();

    const { task, order } = s.items[s.index];
    s.response = this.emptyResponse(task);
    s.checked = false;
    const type = this.typeById.get(task.type);
    const score = s.results.filter(r => r.correct).length;

    host.innerHTML = `
      <div class="p-6 rounded-2xl shadow-xl border border-slate-800 bg-slate-900/90">
        <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800 mb-4">
          <div class="flex flex-wrap items-center gap-2">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">Topic ${task.topic}</span>
            ${this.difficultyBadge(task.difficulty)}
            <button class="st-type-info inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-400 cursor-pointer transition" title="What these tasks ask">${this.esc(type?.label || task.type)} ${icon('info')}</button>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <span>Task <strong class="text-slate-200">${s.index + 1}</strong> of ${s.items.length}</span>
            <span>Correct: <strong class="text-indigo-400">${score}</strong></span>
            <button id="st-exit" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition">${icon('sliders-horizontal')} Filters</button>
          </div>
        </div>

        <div class="text-base sm:text-lg font-semibold text-slate-100 mb-5 leading-relaxed" id="st-question">${this.renderQuestion(task)}</div>
        <div id="st-answer" class="mb-5">${this.renderAnswer(task, order)}</div>
        <div id="st-feedback" class="hidden mb-5"></div>

        <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <span class="text-[11px] text-slate-500">${this.esc(task.id)} · seen in ${task.seenInAttempts} LMS ${task.seenInAttempts === 1 ? 'attempt' : 'attempts'}</span>
          <button id="st-check" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm cursor-pointer transition disabled:opacity-70 disabled:cursor-not-allowed" disabled>Check</button>
        </div>
      </div>
    `;

    this.bindAnswer(task, order);
    host.querySelector('#st-check').addEventListener('click', () => {
      if (!s.checked) return this.check();
      if (Date.now() - (s.checkedAt || 0) < 450) return; // second half of a double click / key repeat
      this.next();
    });
    host.querySelector('#st-exit').addEventListener('click', () => this.renderSetup());
    host.querySelector('.st-type-info')?.addEventListener('click', e => this.openTypeInfo(task.type, e.currentTarget));
    this.renderMath(host);
  }

  renderQuestion(task) {
    let text = this.esc(task.question).replace(/\n/g, '<br>');
    if (task.format === 'gaps') {
      text = text.replace(/\[\[(\d+)\]\]/g, (_, n) => {
        const i = Number(n) - 1;
        return `<select class="st-gap mx-1 my-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-base sm:text-sm cursor-pointer" data-i="${i}">
          <option value="">— choose —</option>${task.gaps[i].map(o => `<option value="${this.esc(o)}">${this.esc(o)}</option>`).join('')}
        </select>`;
      });
    }
    if (task.table) {
      const t = task.table;
      text += `<table class="mt-3 text-sm font-normal border-collapse">
        <tr>${t.columns.map(c => `<th class="border border-slate-700 px-3 py-1 text-slate-300">${this.esc(c)}</th>`).join('')}</tr>
        ${t.rows.map(r => `<tr>${r.map((c, j) => `<td class="border border-slate-700 px-3 py-1 ${j ? 'text-right' : 'text-slate-300'}">${this.esc(c)}</td>`).join('')}</tr>`).join('')}
      </table>`;
    }
    return text;
  }

  renderAnswer(task, order) {
    const optionBtn = (label, key, i, multi) => `
      <button class="st-option w-full text-left p-3.5 rounded-xl border border-slate-800 bg-slate-950/70 hover:border-indigo-500 hover:bg-slate-900 cursor-pointer transition text-slate-200 text-sm flex items-center gap-3" data-i="${i}">
        <span class="st-mark w-7 h-7 ${multi ? 'rounded-md' : 'rounded-full'} bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">${key}</span>
        <span class="flex-1">${label}</span>
      </button>`;
    switch (task.format) {
      case 'single':
      case 'multi':
        return `${task.format === 'multi' ? '<p class="text-xs text-slate-400 mb-2">Select all that apply.</p>' : ''}
          <div class="space-y-2.5">${order.map((i, k) => optionBtn(this.optionHtml(task.options[i].text), String.fromCharCode(97 + k), i, task.format === 'multi')).join('')}</div>`;
      case 'tf':
        return `<div class="grid grid-cols-2 gap-2.5">${optionBtn('True', 'T', 'true', false)}${optionBtn('False', 'F', 'false', false)}</div>`;
      case 'numeric':
        return `<label class="flex items-center gap-3 text-sm text-slate-300">Answer:
          <input id="st-numeric" type="text" inputmode="decimal" autocomplete="off" class="w-48 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-base sm:text-sm" placeholder="number or fraction, e.g. 3/4"></label>`;
      case 'match':
        return `<div class="space-y-2.5">${task.stems.map((stem, i) => `
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950/70">
            <span class="flex-1 text-sm text-slate-200">${this.esc(stem)}</span>
            <select class="st-match px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-base sm:text-sm cursor-pointer" data-i="${i}">
              <option value="">— choose —</option>${task.choices.map(c => `<option value="${this.esc(c)}">${this.esc(c)}</option>`).join('')}
            </select>
          </div>`).join('')}</div>`;
      default:
        return '';
    }
  }

  // Swaps the option badge colours (Tailwind utilities of equal specificity must not coexist)
  paintMark(btn, state) {
    const mark = btn.querySelector('.st-mark');
    if (!mark) return;
    const looks = {
      idle: ['bg-slate-800', 'border-slate-700', 'text-slate-300'],
      picked: ['bg-indigo-600', 'border-indigo-500', 'text-white'],
      right: ['bg-emerald-600', 'border-emerald-500', 'text-white'],
      wrong: ['bg-rose-600', 'border-rose-500', 'text-white']
    };
    Object.values(looks).flat().forEach(c => mark.classList.remove(c));
    mark.classList.add(...looks[state]);
  }

  bindAnswer(task) {
    const host = this.container;
    const s = this.session;
    const checkBtn = host.querySelector('#st-check');
    const sync = () => { checkBtn.disabled = !SelfTestLogic.isAnswered(task, s.response); };

    host.querySelectorAll('.st-option').forEach(btn => btn.addEventListener('click', () => {
      if (s.checked) return;
      const raw = btn.getAttribute('data-i');
      if (task.format === 'multi') {
        const i = Number(raw);
        s.response = s.response.includes(i) ? s.response.filter(x => x !== i) : [...s.response, i];
      } else {
        s.response = task.format === 'tf' ? raw === 'true' : Number(raw);
      }
      host.querySelectorAll('.st-option').forEach(b => {
        const v = b.getAttribute('data-i');
        const on = task.format === 'multi' ? s.response.includes(Number(v)) : String(s.response) === v;
        b.classList.toggle('border-indigo-500', on);
        b.classList.toggle('border-slate-800', !on);
        b.classList.toggle('ring-1', on);
        b.classList.toggle('ring-indigo-500/60', on);
        this.paintMark(b, on ? 'picked' : 'idle');
      });
      sync();
    }));

    const numeric = host.querySelector('#st-numeric');
    numeric?.addEventListener('input', () => { s.response = numeric.value; sync(); });
    numeric?.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      // Without this the same keypress lands on the freshly focused "Next" button and skips the feedback
      e.preventDefault();
      if (!checkBtn.disabled) checkBtn.click();
    });
    if (window.matchMedia('(pointer: fine)').matches) numeric?.focus();

    host.querySelectorAll('.st-match, .st-gap').forEach(sel => sel.addEventListener('change', () => {
      s.response[Number(sel.getAttribute('data-i'))] = sel.value || null;
      sync();
    }));
  }

  check() {
    const host = this.container;
    const s = this.session;
    const { task } = s.items[s.index];
    const res = SelfTestLogic.grade(task, s.response);
    s.checked = true;
    s.checkedAt = Date.now();
    s.results.push({ task, correct: res.correct, score: res.score });
    this.stats = SelfTestLogic.recordResult(this.stats, task.id, res.correct);
    this.saveStats();
    window.rewards?.notify('selftest', { id: task.id, correct: res.correct }); // rewards: points + stickers
    // Same mistakes registry as the topic tests: a wrong answer shows up on the dashboard, a right one clears it
    const mistakeId = SelfTestBank.MISTAKE_PREFIX + task.id;
    if (res.correct) window.userProfile?.recordSuccess(mistakeId);
    else window.userProfile?.recordMistake(mistakeId, task.question, `Self-test · Topic ${task.topic}`, 'selftest');

    // Lock and colour the inputs
    host.querySelectorAll('.st-option').forEach(b => {
      const v = b.getAttribute('data-i');
      const isRight = task.format === 'tf' ? String(task.answer) === v : task.options[Number(v)].correct;
      const chosen = task.format === 'multi' ? s.response.includes(Number(v)) : String(s.response) === v;
      b.disabled = true;
      b.classList.remove('hover:border-indigo-500', 'hover:bg-slate-900', 'cursor-pointer', 'ring-1', 'ring-indigo-500/60', 'border-indigo-500', 'border-slate-800', 'bg-slate-950/70');
      if (isRight && chosen) {
        b.classList.add('border-emerald-500', 'bg-emerald-950/60');
        this.paintMark(b, 'right');
      } else if (isRight) {
        // A correct option the user did not pick: visible, but clearly not "your" answer
        b.classList.add('border-emerald-600', 'border-dashed', 'bg-slate-950/70');
        b.insertAdjacentHTML('beforeend', '<span class="text-[11px] text-emerald-400 font-semibold shrink-0">missed</span>');
      } else if (chosen) {
        b.classList.add('border-rose-500', 'bg-rose-950/60');
        this.paintMark(b, 'wrong');
      } else {
        b.classList.add('border-slate-800', 'bg-slate-950/70', 'opacity-80');
      }
      const fb = task.options?.[Number(v)]?.feedback;
      if (chosen && fb) b.insertAdjacentHTML('beforeend', `<span class="text-xs text-amber-300 ml-2">${this.esc(fb)}</span>`);
    });
    host.querySelectorAll('.st-match, .st-gap').forEach(sel => {
      const i = Number(sel.getAttribute('data-i'));
      sel.disabled = true;
      sel.classList.add(sel.value === task.answer[i] ? 'border-emerald-500' : 'border-rose-500');
    });
    const numeric = host.querySelector('#st-numeric');
    if (numeric) {
      numeric.disabled = true;
      numeric.classList.add(res.correct ? 'border-emerald-500' : 'border-rose-500');
    }

    const type = this.typeById.get(task.type);
    const showAnswer = !res.correct && !['single', 'multi'].includes(task.format); // choice tasks already show it on the options
    const box = host.querySelector('#st-feedback');
    box.className = `mb-5 p-4 rounded-xl text-sm leading-relaxed border ${res.correct
      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
      : 'bg-rose-950/50 border-rose-800 text-rose-200'}`;
    box.innerHTML = `
      <div class="font-bold mb-1">${res.correct ? `${icon('circle-check')} Correct` : res.score > 0
        ? `${icon('circle-alert')} Partly correct (${Math.round(res.score * 100)}%)` : `${icon('circle-x')} Incorrect`}</div>
      ${showAnswer ? `<div class="mb-1">Correct answer: ${this.answerHtml(task)}</div>` : ''}
      ${task.hint ? `<div class="mb-1"><strong>LMS hint:</strong> ${this.esc(task.hint)}</div>` : ''}
      <div class="text-slate-200"><strong>Why:</strong> ${this.esc(task.explanation)}</div>
      ${type?.defs?.length ? `
        <div class="mt-3 pt-3 border-t border-slate-700/60">
          <div class="text-xs font-semibold text-slate-300 mb-1.5">${icon('book-open')} Review the theory${type.lecture ? ` <span class="font-normal text-slate-400">· lecture slides ${this.esc(type.lecture)}</span>` : ''}</div>
          <div class="flex flex-wrap gap-1.5">${this.reviewLinks(type)}</div>
        </div>` : ''}
    `;
    this.bindReviewLinks(box);
    const btn = host.querySelector('#st-check');
    btn.disabled = false;
    btn.innerHTML = s.index === s.items.length - 1 ? `Finish ${icon('flag')}` : `Next ${icon('chevron-right')}`;
    btn.focus();
    this.renderMath(box);
    this.renderMath(host.querySelector('#st-answer'));
  }

  next() {
    this.session.index++;
    this.renderTask();
  }

  renderResults() {
    const host = this.container;
    const s = this.session;
    const sum = SelfTestLogic.summarize(s.results);
    const pct = Math.round((sum.correct / Math.max(1, sum.total)) * 100);
    const wrong = s.results.filter(r => !r.correct).map(r => r.task);
    const newlyPassed = this.passedTopics().filter(t => !s.passedBefore.includes(t));

    host.innerHTML = `
      <div class="p-8 rounded-2xl shadow-2xl border border-slate-700 bg-slate-900 text-center">
        <div class="text-5xl mb-3">${pct >= 70 || newlyPassed.length ? icon('party-popper', 'text-amber-400') : icon('book-open', 'text-indigo-400')}</div>
        <h2 class="text-2xl font-black text-slate-100 mb-4">Set complete</h2>
        ${newlyPassed.length ? `
          <div class="max-w-xl mx-auto mb-5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-sm font-semibold">
            ${icon('trophy', 'text-amber-400')} ${newlyPassed.map(t => `Topic ${t}`).join(', ')}: self-tests counted — <strong>+${newlyPassed.length}% readiness</strong>
          </div>` : ''}
        <div class="inline-block px-8 py-4 rounded-2xl bg-indigo-950/70 border border-indigo-700 mb-6">
          <div class="text-4xl font-black text-indigo-400">${sum.correct} / ${sum.total}</div>
          <div class="text-xs uppercase font-extrabold text-slate-300 mt-1">${pct}%</div>
        </div>
        <div class="max-w-xl mx-auto text-left mb-6 space-y-1.5">
          ${Object.entries(sum.byType).map(([id, row]) => `
            <button class="st-result-type w-full flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition" data-type="${id}" title="What these tasks ask">
              <span class="text-slate-300">${this.esc(this.typeById.get(id)?.label || id)}</span>
              <span class="font-bold ${row.correct === row.total ? 'text-emerald-400' : 'text-amber-300'}">${row.correct}/${row.total}</span>
            </button>`).join('')}
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          ${wrong.length ? `<button id="st-retry-wrong" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition">${icon('repeat')} Retry the wrong ones (${wrong.length})</button>` : ''}
          <button id="st-again" class="px-5 py-2.5 rounded-xl ${wrong.length ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} font-bold text-xs cursor-pointer transition">${icon('dices')} New set, same filters</button>
          <button id="st-setup" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition">${icon('sliders-horizontal')} Change filters</button>
        </div>
      </div>
    `;
    host.querySelector('#st-retry-wrong')?.addEventListener('click', () => this.start(SelfTestLogic.shuffle(wrong)));
    host.querySelector('#st-again').addEventListener('click', () => {
      const pool = SelfTestLogic.filter(this.bank.tasks, this.filters, this.stats);
      if (pool.length) this.start(SelfTestLogic.pick(pool, this.count));
      else this.renderSetup();
    });
    host.querySelector('#st-setup').addEventListener('click', () => this.renderSetup());
    host.querySelectorAll('.st-result-type').forEach(btn => btn.addEventListener('click', () => this.openTypeInfo(btn.getAttribute('data-type'), btn)));
  }
}

SelfTestBank.MISTAKE_PREFIX = 'st_';                    // id prefix in the shared mistakes registry

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SelfTestLogic };
} else {
  window.selfTestBank = new SelfTestBank(window.SELFTEST_BANK);
}
