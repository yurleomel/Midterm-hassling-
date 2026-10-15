// ========================================================
// LMS Self-test Bank: the unique tasks from Moodle self-tests 4–6, drilled by
// topic, task type and difficulty. Data: js/selftest-data.js (window.SELFTEST_BANK).
// Progress lives in this browser only (localStorage), it is never synced.
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
  // returns { correct: bool, score: 0..1 }; partial score mirrors Moodle (right picks minus wrong picks)
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

  // The first version kept progress in a browser-only key; fold it into the readiness state once
  migrateLegacyStats() {
    try {
      const legacy = JSON.parse(localStorage.getItem(SelfTestBank.LEGACY_KEY) || 'null');
      if (!legacy || !window.quizManager?.readinessState) return;
      this.stats = SelfTestLogic.mergeStats(this.stats, legacy);
      localStorage.removeItem(SelfTestBank.LEGACY_KEY);
      this.saveStats();
    } catch (e) {}
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

  startTask(taskId) {
    const task = this.bank.tasks.find(t => t.id === taskId);
    window.app?.switchTab('selftests');
    if (task) this.start([task]);
  }

  get container() {
    return document.getElementById('selftest-container');
  }

  init() {
    this.migrateLegacyStats();
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
        delimiters: [{ left: '\\[', right: '\\]', display: true }, { left: '\\(', right: '\\)', display: false }],
        throwOnError: false
      });
    }
  }

  topicLabel(id) {
    return this.bank.topics.find(t => t.id === id)?.label || `Тема ${id}`;
  }

  difficultyBadge(d) {
    const map = {
      easy: ['легка', 'bg-emerald-950 text-emerald-300 border-emerald-700'],
      medium: ['середня', 'bg-amber-950 text-amber-300 border-amber-700'],
      hard: ['складна', 'bg-rose-950 text-rose-300 border-rose-700']
    };
    const [label, cls] = map[d] || [d, 'bg-slate-800 text-slate-300 border-slate-700'];
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}">${label}</span>`;
  }

  chip(group, value, label, active, extra = '') {
    return `<button class="st-chip px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition ${
      active
        ? 'border-indigo-500 bg-indigo-950/60 text-white ring-1 ring-indigo-500/50'
        : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600 hover:text-white'
    }" data-group="${group}" data-value="${this.esc(value)}">${label}${extra}</button>`;
  }

  solvedOf(tasks) {
    return tasks.filter(t => this.stats[t.id]?.solved).length;
  }

  // --- setup screen ---
  renderSetup() {
    const host = this.container;
    if (!host) return;
    this.session = null;
    const all = this.bank.tasks;
    const f = this.filters;

    // Chip counts show the whole bank (so a fully solved type stays visible); "only unsolved" narrows the pool only
    const counted = { ...f, onlyUnsolved: false };
    const byTopic = all;
    const inTopic = SelfTestLogic.filter(all, { ...counted, type: 'all', difficulty: 'all' });
    const typesHere = this.bank.types.filter(t => inTopic.some(x => x.type === t.id));
    if (f.type !== 'all' && !typesHere.some(t => t.id === f.type)) f.type = 'all';
    const inType = SelfTestLogic.filter(all, { ...counted, type: f.type, difficulty: 'all' });
    const pool = SelfTestLogic.filter(all, f, this.stats);
    const count = Math.min(Math.max(1, this.count), Math.max(1, pool.length));

    const topicChips = [this.chip('topic', 'all', `Усі теми`, f.topic === 'all', ` <span class="text-slate-500">${byTopic.length}</span>`)]
      .concat(this.bank.topics.map(t => this.chip('topic', t.id, this.esc(t.label), f.topic === t.id,
        ` <span class="text-slate-500">${byTopic.filter(x => x.topic === t.id).length}</span>`)));

    const typeRows = [{ id: 'all', label: 'Усі типи задач', lecture: '' }].concat(typesHere).map(t => {
      const tasks = t.id === 'all' ? inTopic : inTopic.filter(x => x.type === t.id);
      const solved = this.solvedOf(tasks);
      const active = f.type === t.id;
      return `<button class="st-chip w-full text-left px-3 py-2 rounded-xl border text-xs cursor-pointer transition flex items-center justify-between gap-3 ${
        active ? 'border-indigo-500 bg-indigo-950/60 text-white ring-1 ring-indigo-500/50' : 'border-slate-800 bg-slate-950/50 text-slate-300 hover:border-slate-600 hover:text-white'
      }" data-group="type" data-value="${t.id}">
        <span class="min-w-0"><span class="font-semibold">${this.esc(t.label)}</span>${t.lecture ? ` <span class="text-slate-500">· ${this.esc(t.lecture)}</span>` : ''}</span>
        <span class="shrink-0 flex items-center gap-2">
          ${solved ? `<span class="text-emerald-400 font-bold">${icon('check')} ${solved}</span>` : ''}
          <span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-bold">${tasks.length}</span>
        </span>
      </button>`;
    }).join('');

    const diffCounts = SelfTestLogic.countBy(inType, 'difficulty');
    const diffChips = [this.chip('difficulty', 'all', 'Будь-яка', f.difficulty === 'all', ` <span class="text-slate-500">${inType.length}</span>`)]
      .concat([['easy', 'Легкі'], ['medium', 'Середні'], ['hard', 'Складні']].map(([d, l]) =>
        this.chip('difficulty', d, l, f.difficulty === d, ` <span class="text-slate-500">${diffCounts[d] || 0}</span>`)));

    const solvedAll = this.solvedOf(all);
    const mistakes = this.mistakeTasks();
    const progressRows = this.topicProgress().map(p => {
      const pct = Math.round((p.solved / Math.max(1, p.total)) * 100);
      const mark = Math.round((p.need / Math.max(1, p.total)) * 100);
      return `
        <div class="space-y-1">
          <div class="flex justify-between gap-2 text-[11px]">
            <span class="font-semibold text-slate-300">Тема ${p.topic}</span>
            <span class="${p.passed ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${p.passed
              ? `${icon('check')} +1% до готовності`
              : `${p.solved}/${p.total} · ще ${p.need - p.solved} до +1%`}</span>
          </div>
          <div class="relative w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
            <div class="h-full rounded-full transition-all duration-300 ${p.passed ? 'bg-emerald-500' : 'bg-violet-500'}" style="width: ${pct}%"></div>
            <div class="absolute top-0 h-full w-0.5 bg-slate-400/70" style="left: ${mark}%" title="${p.need} з ${p.total}"></div>
          </div>
        </div>`;
    }).join('');

    host.innerHTML = `
      <div class="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
        <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
          <div>
            <span class="text-xs font-bold uppercase tracking-wider text-indigo-400">Moodle self-tests · теми 4–6</span>
            <h3 class="text-lg font-bold text-slate-100">Банк задач із self-тестів LMS</h3>
            <p class="text-xs text-slate-400 mt-1">${all.length} унікальних задач дослівно з платформи, без дублікатів. Обери тему, тип задач, складність і кількість.</p>
          </div>
          <div class="text-xs text-slate-400 shrink-0">Розв'язано правильно: <strong class="text-emerald-400">${solvedAll}</strong> / ${all.length}</div>
        </div>

        <div class="mb-5 p-3 rounded-xl bg-slate-950/60 border border-slate-800">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <span class="text-[11px] text-slate-400">Розв'яжи ${Math.round(SelfTestLogic.TOPIC_PASS_SHARE * 100)}% задач теми — і вона додасть <strong class="text-slate-200">+1%</strong> до Readiness.</span>
            ${mistakes.length ? `<button id="st-mistakes" class="shrink-0 px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 hover:border-rose-600 hover:text-white text-xs font-semibold cursor-pointer transition">${icon('repeat')} Мої помилки (${mistakes.length})</button>` : ''}
          </div>
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${progressRows}</div>
        </div>

        <div class="space-y-4">
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Тема</div>
            <div class="flex flex-wrap gap-2">${topicChips.join('')}</div>
          </div>
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Тип задач</div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2">${typeRows}</div>
          </div>
          <div>
            <div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Складність</div>
            <div class="flex flex-wrap gap-2">${diffChips.join('')}</div>
          </div>
          <label class="inline-flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
            <input type="checkbox" id="st-only-unsolved" class="cursor-pointer accent-indigo-500" ${f.onlyUnsolved ? 'checked' : ''}>
            Лише задачі, які я ще не розв'язав правильно
          </label>

          <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
            ${pool.length ? `
              <div class="flex items-center gap-2 text-xs text-slate-300">
                <span>Кількість:</span>
                <input id="st-count" type="number" min="1" max="${pool.length}" value="${count}" class="w-20 px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm">
                ${[5, 10, 20].filter(n => n < pool.length).map(n => `<button class="st-count-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-300 cursor-pointer transition" data-count="${n}">${n}</button>`).join('')}
                <button class="st-count-btn px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-300 cursor-pointer transition" data-count="${pool.length}">усі ${pool.length}</button>
              </div>
              <button id="st-start" class="sm:ml-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer transition flex items-center justify-center gap-2">
                ${icon('play')} Почати (${count} з ${pool.length})
              </button>
            ` : `
              <div class="text-xs text-slate-400">Під ці фільтри задач немає${f.onlyUnsolved ? ' — схоже, все вже розв\'язано' : ''}.</div>
              <button id="st-reset" class="sm:ml-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition">${icon('rotate-ccw')} Скинути фільтри</button>
            `}
          </div>
        </div>
      </div>
    `;

    host.querySelectorAll('.st-chip').forEach(btn => btn.addEventListener('click', () => {
      const group = btn.getAttribute('data-group');
      const raw = btn.getAttribute('data-value');
      this.filters[group] = group === 'topic' && raw !== 'all' ? Number(raw) : raw;
      this.renderSetup();
    }));
    host.querySelector('#st-only-unsolved')?.addEventListener('change', e => {
      this.filters.onlyUnsolved = e.target.checked;
      this.renderSetup();
    });
    const countInput = host.querySelector('#st-count');
    countInput?.addEventListener('change', () => {
      this.count = Math.min(Math.max(1, parseInt(countInput.value, 10) || 1), pool.length);
      this.renderSetup();
    });
    host.querySelectorAll('.st-count-btn').forEach(btn => btn.addEventListener('click', () => {
      this.count = Number(btn.getAttribute('data-count'));
      this.renderSetup();
    }));
    host.querySelector('#st-start')?.addEventListener('click', () => {
      const n = Math.min(Math.max(1, parseInt(countInput?.value, 10) || count), pool.length);
      this.count = n;
      this.start(SelfTestLogic.pick(pool, n));
    });
    host.querySelector('#st-mistakes')?.addEventListener('click', () => this.startMistakes());
    host.querySelector('#st-reset')?.addEventListener('click', () => {
      this.filters = { topic: 'all', type: 'all', difficulty: 'all', onlyUnsolved: false };
      this.renderSetup();
    });
    this.renderMath(host);
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
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">Тема ${task.topic}</span>
            ${this.difficultyBadge(task.difficulty)}
            <span class="text-xs text-slate-400">${this.esc(type?.label || task.type)}</span>
          </div>
          <div class="flex items-center gap-3 text-xs text-slate-400">
            <span>Задача <strong class="text-slate-200">${s.index + 1}</strong> з ${s.items.length}</span>
            <span>Правильно: <strong class="text-indigo-400">${score}</strong></span>
            <button id="st-exit" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer transition">${icon('sliders-horizontal')} Фільтри</button>
          </div>
        </div>

        <div class="text-base sm:text-lg font-semibold text-slate-100 mb-5 leading-relaxed" id="st-question">${this.renderQuestion(task)}</div>
        <div id="st-answer" class="mb-5">${this.renderAnswer(task, order)}</div>
        <div id="st-feedback" class="hidden mb-5"></div>

        <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-800">
          <span class="text-[11px] text-slate-500">${this.esc(task.id)} · траплялась у ${task.seenInAttempts} ${task.seenInAttempts === 1 ? 'спробі' : 'спробах'}</span>
          <button id="st-check" class="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm cursor-pointer transition disabled:opacity-40 disabled:cursor-not-allowed" disabled>Перевірити</button>
        </div>
      </div>
    `;

    this.bindAnswer(task, order);
    host.querySelector('#st-check').addEventListener('click', () => (s.checked ? this.next() : this.check()));
    host.querySelector('#st-exit').addEventListener('click', () => this.renderSetup());
    this.renderMath(host);
  }

  renderQuestion(task) {
    let text = this.esc(task.question).replace(/\n/g, '<br>');
    if (task.format === 'gaps') {
      text = text.replace(/\[\[(\d+)\]\]/g, (_, n) => {
        const i = Number(n) - 1;
        return `<select class="st-gap mx-1 my-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm cursor-pointer" data-i="${i}">
          <option value="">— обрати —</option>${task.gaps[i].map(o => `<option value="${this.esc(o)}">${this.esc(o)}</option>`).join('')}
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
        return `${task.format === 'multi' ? '<p class="text-xs text-slate-400 mb-2">Можна обрати кілька відповідей.</p>' : ''}
          <div class="space-y-2.5">${order.map((i, k) => optionBtn(this.esc(task.options[i].text), String.fromCharCode(97 + k), i, task.format === 'multi')).join('')}</div>`;
      case 'tf':
        return `<div class="grid grid-cols-2 gap-2.5">${optionBtn('Правда', 'T', 'true', false)}${optionBtn('Неправда', 'F', 'false', false)}</div>`;
      case 'numeric':
        return `<label class="flex items-center gap-3 text-sm text-slate-300">Відповідь:
          <input id="st-numeric" type="text" inputmode="decimal" autocomplete="off" class="w-48 px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100" placeholder="число або дріб, напр. 3/4"></label>`;
      case 'match':
        return `<div class="space-y-2.5">${task.stems.map((stem, i) => `
          <div class="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-xl border border-slate-800 bg-slate-950/70">
            <span class="flex-1 text-sm text-slate-200">${this.esc(stem)}</span>
            <select class="st-match px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-sm cursor-pointer" data-i="${i}">
              <option value="">— обрати —</option>${task.choices.map(c => `<option value="${this.esc(c)}">${this.esc(c)}</option>`).join('')}
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
        const on = task.format === 'multi' ? s.response.includes(Number(v))
          : task.format === 'tf' ? String(s.response) === v : String(s.response) === v;
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
      // Without this the same keypress lands on the freshly focused "Далі" button and skips the feedback
      e.preventDefault();
      if (!checkBtn.disabled) checkBtn.click();
    });
    numeric?.focus();

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
    s.results.push({ task, correct: res.correct, score: res.score });
    this.stats = SelfTestLogic.recordResult(this.stats, task.id, res.correct);
    this.saveStats();
    // Same mistakes registry as the topic tests: a wrong answer shows up on the dashboard, a right one clears it
    const mistakeId = SelfTestBank.MISTAKE_PREFIX + task.id;
    if (res.correct) window.userProfile?.recordSuccess(mistakeId);
    else window.userProfile?.recordMistake(mistakeId, task.question, `Self-test · Тема ${task.topic}`, 'selftest');

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
        b.insertAdjacentHTML('beforeend', '<span class="text-[11px] text-emerald-400 font-semibold shrink-0">пропущено</span>');
      } else if (chosen) {
        b.classList.add('border-rose-500', 'bg-rose-950/60');
        this.paintMark(b, 'wrong');
      } else {
        b.classList.add('border-slate-800', 'bg-slate-950/70', 'opacity-70');
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

    const answerText = {
      numeric: () => this.esc(task.answer),
      match: () => task.stems.map((st, i) => `${this.esc(st)} → <strong>${this.esc(task.answer[i])}</strong>`).join('<br>'),
      gaps: () => task.answer.map(a => `[${this.esc(a)}]`).join(' '),
      tf: () => (task.answer ? 'Правда' : 'Неправда')
    }[task.format];
    const type = this.typeById.get(task.type);
    const box = host.querySelector('#st-feedback');
    box.className = `mb-5 p-4 rounded-xl text-sm leading-relaxed border ${res.correct
      ? 'bg-emerald-950/50 border-emerald-800 text-emerald-200'
      : 'bg-rose-950/50 border-rose-800 text-rose-200'}`;
    box.innerHTML = `
      <div class="font-bold mb-1">${res.correct ? `${icon('circle-check')} Правильно` : res.score > 0
        ? `${icon('circle-alert')} Частково (${Math.round(res.score * 100)}%)` : `${icon('circle-x')} Неправильно`}</div>
      ${answerText && !res.correct ? `<div class="mb-1">Правильна відповідь: ${answerText()}</div>` : ''}
      ${task.hint ? `<div class="mb-1"><strong>Підказка з LMS:</strong> ${this.esc(task.hint)}</div>` : ''}
      <div class="text-slate-200"><strong>Чому:</strong> ${this.esc(task.explanation)}</div>
      ${type?.lecture ? `<div class="mt-1 text-xs text-slate-400">${icon('book-open')} Лекції: ${this.esc(type.lecture)}</div>` : ''}
    `;
    const btn = host.querySelector('#st-check');
    btn.disabled = false;
    btn.innerHTML = s.index === s.items.length - 1 ? `Завершити ${icon('flag')}` : `Далі ${icon('chevron-right')}`;
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
        <h2 class="text-2xl font-black text-slate-100 mb-4">Набір завершено</h2>
        ${newlyPassed.length ? `
          <div class="max-w-xl mx-auto mb-5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-700 text-emerald-200 text-sm font-semibold">
            ${icon('trophy', 'text-amber-400')} ${newlyPassed.map(t => `Тема ${t}`).join(', ')}: self-тести зараховано — <strong>+${newlyPassed.length}% до готовності</strong>
          </div>` : ''}
        <div class="inline-block px-8 py-4 rounded-2xl bg-indigo-950/70 border border-indigo-700 mb-6">
          <div class="text-4xl font-black text-indigo-400">${sum.correct} / ${sum.total}</div>
          <div class="text-xs uppercase font-extrabold text-slate-300 mt-1">${pct}%</div>
        </div>
        <div class="max-w-xl mx-auto text-left mb-6 space-y-1.5">
          ${Object.entries(sum.byType).map(([id, row]) => `
            <div class="flex items-center justify-between gap-3 text-xs px-3 py-2 rounded-lg bg-slate-950/60 border border-slate-800">
              <span class="text-slate-300">${this.esc(this.typeById.get(id)?.label || id)}</span>
              <span class="font-bold ${row.correct === row.total ? 'text-emerald-400' : 'text-amber-300'}">${row.correct}/${row.total}</span>
            </div>`).join('')}
        </div>
        <div class="flex flex-wrap justify-center gap-3">
          ${wrong.length ? `<button id="st-retry-wrong" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs cursor-pointer transition">${icon('repeat')} Прорішати помилкові (${wrong.length})</button>` : ''}
          <button id="st-again" class="px-5 py-2.5 rounded-xl ${wrong.length ? 'bg-slate-800 hover:bg-slate-700 text-slate-200' : 'bg-indigo-600 hover:bg-indigo-500 text-white'} font-bold text-xs cursor-pointer transition">${icon('dices')} Новий набір з тими ж фільтрами</button>
          <button id="st-setup" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs cursor-pointer transition">${icon('sliders-horizontal')} Змінити фільтри</button>
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
  }
}

SelfTestBank.LEGACY_KEY = 'stathustle_selftest_stats'; // browser-only progress of the first version
SelfTestBank.MISTAKE_PREFIX = 'st_';                    // id prefix in the shared mistakes registry

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SelfTestLogic };
} else {
  window.selfTestBank = new SelfTestBank(window.SELFTEST_BANK);
}
