// ========================================================
// Study plan: links every day-by-day task to the place in the app where it is done,
// and checks it off from the real result (definition scores, solved problems, topic tests,
// pomodoro sessions, exam grades). Tasks with nothing to measure get a manual checkbox.
// Day dates count back from the user's midterm date, so "today" is the real today.
// UCU Probability & Statistics Midterm 2
// ========================================================

// Pure logic — DOM-free so it can be unit-tested with `node --test`.
const StudyPlan = {
  DAY_MS: 86400000,
  PASS_SCORE: 6, // a definition / oral answer counts once scored ≥ 6/10
  BONUS_DAYS: 5, // days 1–5 give the +2% readiness milestone; day 6 is the midterm itself

  // Quiz targets of the schedule → topic tests (ids of PS_DATA.TOPICS_LIST)
  QUIZ_TARGET_TOPICS: { 'discrete-blitz': [1, 2, 3], 'expectation-pgf': [4, 5, 6] },

  // Tasks whose data has no machine-readable target (ids are PS_DATA ids)
  TASK_LINKS: {
    'd1-t2': { kind: 'definitions', ids: [3] },          // 4 properties of the CDF
    'd2-t2': { kind: 'definitions', ids: [20] },         // p.g.f. moment formulas
    'd2-t3': { kind: 'problems', ids: [9, 12, 14, 18] }, // the plan also names problem 10, which is not in the bank
    'd2-t4': { kind: 'definitions', ids: [14] },         // Cov = 0 does not imply independence
    'd3-t2': { kind: 'definitions', ids: [18] },         // 1D transformation formula
    'd3-t4': { kind: 'oral' },                           // all 12 oral questions
    'd3-t5': { kind: 'ticket' },                         // colloquium mock exam
    'd4-t1': { kind: 'drill' },                          // rapid review of all 21 definitions
    'd4-t2': { kind: 'exam', exam: 'colloquium' },
    'd4-t3': { kind: 'problems', ids: [37, 39, 40, 41, 42] }, // Midterm 2017 paper
    'd4-t4': { kind: 'problems', ids: [26] },            // Poisson thinning
    'd5-t1': { kind: 'problems', ids: [28] },            // Gambler's ruin
    'd5-t2': { kind: 'problems', ids: [32, 33] },        // helicopter, traffic light
    'd5-t3': { kind: 'topic', topic: 'topic-12' },       // difference of exponentials (Laplace): theory only
    'd5-t4': { kind: 'selftests' },                      // full midterm simulation → LMS self-tests, topics 4–6
    'd5-t5': { kind: 'mistakes' },                       // review every missed question
    'd6-t1': { kind: 'formulas' },                       // distributions cheat sheet
    'd6-t2': { kind: 'formulas' },                       // golden traps (pitfalls column)
    'd6-t3': { kind: 'exam', exam: 'midterm' }
  },

  // "1-6" | "1,2,7" | "7-11,17-19,21" → [numbers]
  parseIdList(target = '') {
    return String(target).split(',').flatMap(part => {
      const [a, b] = part.split('-').map(s => parseInt(s, 10));
      if (!Number.isFinite(a)) return [];
      if (!Number.isFinite(b)) return [a];
      return Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);
    });
  },

  linkFor(task) {
    if (this.TASK_LINKS[task.id]) return this.TASK_LINKS[task.id];
    switch (task.topic) {
      case 'definitions': return { kind: 'definitions', ids: this.parseIdList(task.target) };
      case 'problems': return { kind: 'problems', ids: this.parseIdList(task.target) };
      case 'quiz': {
        const topics = this.QUIZ_TARGET_TOPICS[task.target];
        return topics ? { kind: 'quiz', topics } : { kind: 'manual' };
      }
      case 'pomodoro': {
        const n = parseInt(/(\d+)\s+pomodoro/i.exec(task.text)?.[1], 10);
        return { kind: 'pomodoro', sessions: Number.isFinite(n) ? n : 1 };
      }
      default: return { kind: 'manual' };
    }
  },

  // Tasks with nothing to measure in the app are ticked by hand
  isManual(link) {
    return ['manual', 'ticket', 'topic', 'formulas'].includes(link.kind);
  },

  // ctx: { defScores, problemsMastered, topicTests, oralIds, selfTestPassed, selfTestTopics,
  //        mistakesCount, grades, pomodoroByDate, planChecks }
  // returns { done, have, need } — have/need are null when there is nothing to count
  status(task, ctx, dayKey = null) {
    const link = this.linkFor(task);
    const pass = id => (ctx.defScores?.[id] || 0) >= this.PASS_SCORE;
    const count = (have, need) => ({ done: need > 0 && have >= need, have, need });
    if (this.isManual(link)) return { done: !!ctx.planChecks?.[task.id], have: null, need: null };
    switch (link.kind) {
      case 'definitions': return count(link.ids.filter(pass).length, link.ids.length);
      case 'problems': return count(link.ids.filter(id => ctx.problemsMastered?.[id]).length, link.ids.length);
      case 'quiz': return count(link.topics.filter(t => ctx.topicTests?.[t]?.solved).length, link.topics.length);
      case 'oral': return count((ctx.oralIds || []).filter(id => pass(`oral_${id}`)).length, (ctx.oralIds || []).length);
      case 'drill': {
        const ids = Array.from({ length: 21 }, (_, i) => i + 1);
        return count(ids.filter(pass).length, ids.length);
      }
      case 'exam': return { done: !!ctx.grades?.[link.exam]?.grade, have: null, need: null };
      case 'pomodoro': return count(Math.min(ctx.pomodoroByDate?.[dayKey] || 0, link.sessions), link.sessions);
      case 'mistakes': return { done: (ctx.mistakesCount || 0) === 0, have: null, need: null, left: ctx.mistakesCount || 0 };
      case 'selftests': return count(ctx.selfTestPassed || 0, ctx.selfTestTopics || 3);
      default: return { done: false, have: null, need: null };
    }
  },

  dayDone(day, ctx, dayKey) {
    return day.tasks.length > 0 && day.tasks.every(t => this.status(t, ctx, dayKey).done);
  },

  // Local calendar date as 'YYYY-MM-DD'
  dateKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },

  // The last day of the plan is the midterm day; earlier days count back one calendar day each
  dayDates(midtermDate, dayNumbers) {
    const anchor = new Date(midtermDate);
    if (Number.isNaN(anchor.getTime())) return {};
    const last = Math.max(...dayNumbers);
    return Object.fromEntries(dayNumbers.map(n => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() - (last - n));
      return [n, this.dateKey(d)];
    }));
  },

  // 'today' | 'past' | 'upcoming' for each day, plus which day to open by default
  timeline(dates, todayKey) {
    const state = {};
    for (const [n, key] of Object.entries(dates)) state[n] = key === todayKey ? 'today' : key < todayKey ? 'past' : 'upcoming';
    const nums = Object.keys(dates).map(Number).sort((a, b) => a - b);
    const focus = nums.find(n => state[n] === 'today') ?? nums.find(n => state[n] === 'upcoming') ?? nums[nums.length - 1];
    return { state, focus };
  },

  // Readable label of where a task leads
  linkLabel(link) {
    const range = ids => (ids.length > 2 && ids[ids.length - 1] - ids[0] === ids.length - 1 ? `${ids[0]}–${ids[ids.length - 1]}` : ids.join(', '));
    switch (link.kind) {
      case 'definitions': return link.ids.length === 1 ? `Означення №${link.ids[0]}` : `Означення ${range(link.ids)}`;
      case 'problems': return link.ids.length === 1 ? `Задача ${link.ids[0]}` : `Задачі ${range(link.ids)}`;
      case 'quiz': return `Тести: теми ${range(link.topics)}`;
      case 'oral': return 'Усні питання';
      case 'drill': return 'Рандомний тест';
      case 'ticket': return 'Білет колоквіуму';
      case 'exam': return link.exam === 'midterm' ? 'Оцінка за мідтерм' : 'Оцінка за колоквіум';
      case 'pomodoro': return 'Таймер';
      case 'mistakes': return 'Мої помилки';
      case 'selftests': return 'Self-тести LMS';
      case 'formulas': return 'Формули';
      case 'topic': return `Теорія: тема ${String(link.topic).replace('topic-', '')}`;
      default: return '';
    }
  },

  // Browser only: collects the context from the live app state
  contextFromApp(readinessState) {
    const rs = readinessState || window.quizManager?.readinessState || {};
    const profile = window.userProfile?.profile || {};
    const bank = window.SELFTEST_BANK;
    const selfTest = bank && typeof SelfTestLogic !== 'undefined'
      ? SelfTestLogic.topicProgress(bank.tasks, bank.topics, rs.selfTestStats || {})
      : [];
    return {
      defScores: rs.definitionsScores || {},
      problemsMastered: rs.problemsMastered || {},
      topicTests: rs.topicTestsSolved || {},
      planChecks: rs.planChecks || {},
      oralIds: (window.PS_DATA?.ORAL_QUESTIONS_12 || []).map(o => o.id),
      selfTestPassed: selfTest.filter(p => p.passed).length,
      selfTestTopics: selfTest.length || 3,
      mistakesCount: Object.keys(profile.mistakesHistory || {}).length,
      grades: window.userProfile?.getExamGrades?.() || profile.examGrades || {},
      pomodoroByDate: window.pomodoroTimer?.stats?.sessionsByDate || {}
    };
  },

  midtermDate() {
    return window.userProfile?.getExamSchedule?.()?.midtermDate || '2026-10-16T08:30';
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { StudyPlan };
} else {
  window.StudyPlan = StudyPlan;
}
