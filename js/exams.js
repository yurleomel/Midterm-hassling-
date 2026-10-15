// ========================================================
// Exams by module and how ready you are for each one. The dashboard shows the exam in focus
// (picked with a switch, defaulting to the next exam without a grade) and the parts of its readiness;
// every part leads to the section where it is trained. A new module's exams are new entries in EXAMS.
// ========================================================

// Pure logic — DOM-free so it can be unit-tested with `node --test`.
const ExamFocus = {
  STORAGE_KEY: 'stathustle_exam_focus',
  PASS_SCORE: 6, // a definition / oral answer counts once scored ≥ 6/10

  EXAMS: [
    {
      id: 'midterm-2', module: 2, moduleTitle: 'Module 2 · Random variables', title: 'Midterm 2',
      scheduleKey: 'midtermDate', gradeKey: 'midterm',
      parts: [
        { id: 'checklist', label: 'Get ready checklist', tab: 'getready', weight: 20 },
        { id: 'problems', label: 'Exam problems solved', tab: 'problems', weight: 30 },
        { id: 'selftests', label: 'LMS self-tests solved', tab: 'selftests', weight: 20 },
        { id: 'topicTests', label: 'Topic tests passed', tab: 'quizzes', weight: 15 },
        { id: 'mock', label: 'Mock midterm · best score', tab: 'mock', weight: 15 }
      ]
    },
    {
      id: 'colloquium-2', module: 2, moduleTitle: 'Module 2 · Random variables', title: 'Colloquium 2',
      scheduleKey: 'colloquiumDate', gradeKey: 'colloquium',
      parts: [
        { id: 'definitions', label: 'Definitions passed (6+/10)', tab: 'colloquium', weight: 60 },
        { id: 'oral', label: 'Oral questions passed (6+/10)', tab: 'colloquium', weight: 40 }
      ]
    }
  ],

  byId(id) {
    return this.EXAMS.find(e => e.id === id) || null;
  },

  // ctx[partId] = [have, need]; percent = weighted share of every part, 0–100
  compute(exam, ctx = {}) {
    const parts = exam.parts.map(p => {
      const [have = 0, need = 0] = ctx[p.id] || [];
      const share = need > 0 ? Math.min(1, Math.max(0, have / need)) : 0;
      return { ...p, have, need, share };
    });
    const weights = parts.reduce((s, p) => s + p.weight, 0);
    const percent = weights ? Math.round((parts.reduce((s, p) => s + p.weight * p.share, 0) / weights) * 100) : 0;
    return { percent, parts };
  },

  // The next exam that has not happened and has no grade yet; otherwise the latest one
  defaultExam(schedule = {}, grades = {}, now = Date.now()) {
    const dated = this.EXAMS.map(e => ({ e, t: new Date(schedule[e.scheduleKey]).getTime() }))
      .filter(x => Number.isFinite(x.t));
    const upcoming = dated.filter(x => !grades[x.e.gradeKey]?.grade && x.t > now).sort((a, b) => a.t - b.t);
    if (upcoming.length) return upcoming[0].e;
    const latest = dated.sort((a, b) => b.t - a.t)[0];
    return latest ? latest.e : this.EXAMS[0];
  },

  // [best points, out of] over finished mock attempts, scaled to the paper total (50)
  bestMock(attempts = {}, outOf = 50) {
    const shares = Object.values(attempts || {}).filter(a => a && a.finishedAt && a.total > 0).map(a => a.score / a.total);
    return [shares.length ? Math.round(Math.max(...shares) * outOf) : 0, outOf];
  },

  // ctx from the readiness state and the data banks (all optional, so it also works in tests)
  context({ rs = {}, prep = null, bank = null, problems = 23, oralIds = [] } = {}) {
    const pass = id => (rs.definitionsScores?.[id] || 0) >= this.PASS_SCORE;
    const sheetItems = prep ? prep.groups.flatMap(g => g.items).filter(i => i.id !== 'x-bernoulli').map(i => i.id) : [];
    const tasks = bank?.tasks || [];
    return {
      checklist: [sheetItems.filter(id => rs.prepChecks?.[id]?.on).length, sheetItems.length || 28],
      problems: [Object.values(rs.problemsMastered || {}).filter(Boolean).length, problems],
      selftests: [tasks.filter(t => rs.selfTestStats?.[t.id]?.solved).length, tasks.length || 69],
      topicTests: [Object.values(rs.topicTestsSolved || {}).filter(t => t?.solved).length, 12],
      mock: this.bestMock(rs.mockAttempts),
      definitions: [Array.from({ length: 21 }, (_, i) => i + 1).filter(pass).length, 21],
      oral: [oralIds.filter(id => pass(`oral_${id}`)).length, oralIds.length || 12]
    };
  }
};

// Browser only: the readiness card on the dashboard and the readiness pill in the top bar
class ExamFocusCard {
  get rs() { return window.quizManager?.readinessState || {}; }

  get focusId() {
    try {
      const saved = localStorage.getItem(ExamFocus.STORAGE_KEY);
      if (ExamFocus.byId(saved)) return saved;
    } catch (e) {}
    const up = window.userProfile;
    return ExamFocus.defaultExam(up?.getExamSchedule?.() || {}, up?.getExamGrades?.() || {}).id;
  }

  set focusId(id) {
    try { localStorage.setItem(ExamFocus.STORAGE_KEY, id); } catch (e) {}
  }

  context() {
    return ExamFocus.context({
      rs: this.rs,
      prep: window.MIDTERM_PREP || null,
      bank: window.SELFTEST_BANK || null,
      problems: window.PS_DATA?.PROBLEMS_BANK?.length || 23,
      oralIds: (window.PS_DATA?.ORAL_QUESTIONS_12 || []).map(o => o.id)
    });
  }

  render() {
    const exam = ExamFocus.byId(this.focusId) || ExamFocus.EXAMS[0];
    const { percent, parts } = ExamFocus.compute(exam, this.context());
    const grade = window.userProfile?.getExamGrades?.()?.[exam.gradeKey]?.grade;

    // Top bar pill follows the exam in focus
    const pill = document.getElementById('header-readiness-percent');
    if (pill) pill.textContent = `${percent}%`;
    const bar = document.getElementById('bar-readiness-header');
    if (bar) bar.style.width = `${percent}%`;
    document.getElementById('header-readiness-btn')?.setAttribute('title', `${exam.title} readiness: open the overview`);

    const card = document.getElementById('exam-focus-card');
    if (!card) return;
    const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    card.querySelector('#exam-focus-module').textContent = exam.moduleTitle;
    card.querySelector('#exam-focus-title').textContent = `${exam.title} readiness`;
    card.querySelector('#exam-focus-switch').innerHTML = ExamFocus.EXAMS.filter(e => e.module === exam.module).map(e => {
      const on = e.id === exam.id;
      return `<button type="button" class="exam-focus-btn px-3 py-1.5 rounded-lg cursor-pointer transition ${on ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-300 hover:bg-slate-800'}" data-exam="${e.id}" aria-pressed="${on}">${esc(e.title)}</button>`;
    }).join('');
    const val = document.getElementById('dashboard-readiness-val');
    if (val) val.textContent = `${percent}%`;
    const circle = document.getElementById('readiness-progress-circle');
    if (circle) circle.style.strokeDashoffset = String(2 * Math.PI * 40 * (1 - percent / 100));
    card.querySelector('#exam-focus-parts').innerHTML = parts.map(p => `
      <button type="button" class="exam-focus-part w-full text-left rounded-lg px-2 py-1.5 -mx-2 hover:bg-slate-800/70 cursor-pointer transition" data-tab="${p.tab}" title="Open ${esc(p.label.toLowerCase())}">
        <span class="flex justify-between gap-3 text-slate-300 mb-1">
          <span>${esc(p.label)}</span>
          <span class="font-bold text-slate-100 tabular-nums whitespace-nowrap">${p.have}/${p.need}</span>
        </span>
        <span class="block w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <span class="block h-full rounded-full ${p.share >= 1 ? 'bg-emerald-500' : 'bg-indigo-500'}" style="width: ${Math.round(p.share * 100)}%"></span>
        </span>
      </button>`).join('');
    const when = new Date(window.userProfile?.getExamSchedule?.()?.[exam.scheduleKey]);
    const date = Number.isNaN(when.getTime()) ? '' : when.toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    const foot = card.querySelector('#exam-focus-footer');
    foot.innerHTML = `
      <span class="text-slate-400">${grade ? `${icon('trophy', 'text-emerald-400')} Grade: <strong class="text-emerald-400 exam-focus-grade"></strong>` : `${icon('calendar')} ${esc(date || 'Date not set')}`}</span>
      <button type="button" class="exam-focus-dates text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition">Dates &amp; grades ${icon('arrow-right')}</button>`;
    if (grade) foot.querySelector('.exam-focus-grade').textContent = grade; // user input: text, never HTML
    this.bind();
  }

  bind() {
    const card = document.getElementById('exam-focus-card');
    if (!card || card.dataset.bound) return;
    card.dataset.bound = 'true';
    card.addEventListener('click', e => {
      const btn = e.target.closest('.exam-focus-btn');
      if (btn) { this.focusId = btn.dataset.exam; return this.render(); }
      const part = e.target.closest('.exam-focus-part');
      if (part) return window.app?.switchTab(part.dataset.tab);
      if (e.target.closest('.exam-focus-dates')) window.rewards?.open('exams');
    });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ExamFocus };
} else {
  window.ExamFocus = ExamFocus;
  window.examFocus = new ExamFocusCard();
}
