// ========================================================
// Main UI Controller & Application Logic
// UCU Probability & Statistics Midterm 2 & Colloquium 2
// ========================================================

class AppController {
  constructor() {
    this.currentTab = 'dashboard';
    this.currentDefFilter = 'all';
    this.currentProbFilter = 'all';
    this.flashcardIndex = 0;
    this.isCardFlipped = false;
    this.colloquiumMode = 'browse'; // 'browse' | 'drill' | 'ticket'
    this.hintLevels = {};           // probId -> how many hint steps are open
  }

  init() {
    this.setupTheme();
    this.setupNavigation();
    this.setupCountdowns();
    this.renderDashboard();
    this.renderColloquiumSection();
    this.renderProblemsSection();
    this.renderTopicsSection();
    this.renderFormulasSection();
    this.setupGeminiDrawer();
    this.setupGeminiSettingsModal();
    this.setupEventListeners();
    this.setupProfileModal();
    this.setupColloquiumModes();
    window.definitionDrill?.init();
    window.selfTestBank?.init();
    window.getReady?.init();
    window.mockMidterm?.init();

    // Trigger initial KaTeX rendering and readiness update
    window.quizManager?.updateReadinessUI();
    window.userProfile?.initExamScheduleControls?.();
    window.userProfile?.updateUserUI();
    window.userProfile?.renderExamScheduleAndGrades?.();
    window.geminiMentor?.updateKeyStatusUI();
    this.renderAllMath();
    this.setupRouting(); // last: open the section / item named in the address
  }

  setupTheme() {
    // The initial theme (saved choice or system preference) is applied by an inline script in <head>
    const root = document.documentElement;
    const themeToggle = document.getElementById('theme-toggle-btn');
    const syncToggle = () => {
      if (!themeToggle) return;
      const isDark = root.classList.contains('dark');
      const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';
      themeToggle.innerHTML = icon(isDark ? 'moon' : 'sun');
      themeToggle.title = label;
      themeToggle.setAttribute('aria-label', label);
    };
    syncToggle();

    themeToggle?.addEventListener('click', () => {
      const isDark = !root.classList.contains('dark');
      root.classList.toggle('dark', isDark);
      root.classList.toggle('light', !isDark);
      try { localStorage.setItem('stathustle_theme', isDark ? 'dark' : 'light'); } catch (e) {}
      syncToggle();
    });
  }

  setupNavigation() {
    const navButtons = document.querySelectorAll('[data-tab-target]');
    navButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-tab-target');
        this.switchTab(target);
      });
    });

    // Sidebar is a slide-in drawer below the lg breakpoint
    document.getElementById('nav-open-btn')?.addEventListener('click', () => this.setNavDrawer(true));
    document.getElementById('nav-close-btn')?.addEventListener('click', () => this.setNavDrawer(false));
    document.getElementById('nav-backdrop')?.addEventListener('click', () => this.setNavDrawer(false));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') this.setNavDrawer(false); });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', e => { if (e.matches) this.setNavDrawer(false); });

    document.getElementById('brand-home-btn')?.addEventListener('click', () => this.switchTab('dashboard'));
    document.getElementById('header-readiness-btn')?.addEventListener('click', () => this.switchTab('dashboard'));
  }

  setNavDrawer(open) {
    const sidebar = document.getElementById('app-sidebar');
    if (!sidebar) return;
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const show = open && !isDesktop;
    sidebar.classList.toggle('-translate-x-full', !show);
    sidebar.classList.toggle('translate-x-0', show);
    document.getElementById('nav-backdrop')?.classList.toggle('hidden', !show);
    document.body.classList.toggle('nav-open', show);
    document.getElementById('nav-open-btn')?.setAttribute('aria-expanded', String(show));
    if (show) sidebar.querySelector('.nav-item.tab-active')?.focus({ preventScroll: true });
  }

  switchTab(tabId, { fromRoute = false } = {}) {
    this.currentTab = tabId;
    if (!fromRoute) this.setRoute(tabId);

    // Toggle active tab buttons
    document.querySelectorAll('[data-tab-target]').forEach(btn => {
      const active = btn.getAttribute('data-tab-target') === tabId;
      btn.classList.toggle('tab-active', active);
      btn.classList.toggle('tab-inactive', !active);
      if (active) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });

    // Section name in the top bar (the only place it shows on phones, where the sidebar is hidden)
    const label = document.querySelector(`[data-tab-target="${tabId}"] .nav-label`)?.textContent;
    const titleEl = document.getElementById('current-section-title');
    if (titleEl && label) titleEl.textContent = label;
    this.setNavDrawer(false);

    // Toggle active content section
    document.querySelectorAll('.tab-content-panel').forEach(panel => {
      if (panel.id === `tab-${tabId}`) {
        panel.classList.remove('hidden');
      } else {
        panel.classList.add('hidden');
      }
    });

    // If switching to quiz, start default quiz if empty
    if (tabId === 'quizzes' && (!window.quizManager?.currentQuiz || window.quizManager.currentQuiz.length === 0)) {
      window.quizManager?.startQuiz(1);
    }
    if (tabId === 'selftests') window.selfTestBank?.show();
    if (tabId === 'dashboard') window.examFocus?.render();
    if (tabId === 'getready') window.getReady?.show();
    if (tabId === 'mock') window.mockMidterm?.show();

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.renderAllMath();
  }

  setupCountdowns() {
    const parseTargetDate = (dateStr, fallbackDayOfWeek, fallbackHour = 9, fallbackMinute = 0) => {
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) return d;
      }
      const now = new Date();
      const target = new Date(now);
      target.setHours(fallbackHour, fallbackMinute, 0, 0);
      let diffDays = (fallbackDayOfWeek - now.getDay() + 7) % 7;
      if (diffDays === 0 && now.getTime() >= target.getTime()) {
        diffDays = 7;
      }
      target.setDate(now.getDate() + diffDays);
      return target;
    };

    const DAY_MS = 86400000;
    const formatCountdown = (diffMs) => {
      if (diffMs <= -DAY_MS) return 'Finished';
      if (diffMs <= 0) return 'Today!';
      const totalSec = Math.floor(diffMs / 1000);
      const d = Math.floor(totalSec / 86400);
      const h = Math.floor((totalSec % 86400) / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      if (d > 0) {
        return `${d}d ${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
      }
      return `${h.toString().padStart(2, '0')}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
    };

    const updateTimer = () => {
      const schedule = window.userProfile?.getExamSchedule?.() || {
        colloquiumDate: '2026-10-14T09:00',
        midtermDate: '2026-10-16T08:30'
      };
      const grades = window.userProfile?.getExamGrades?.() || {
        colloquium: { grade: '' },
        midterm: { grade: '' }
      };

      const colTarget = parseTargetDate(schedule.colloquiumDate, 3, 9, 0);
      // Midterm 2 strictly at 08:30 Kyiv time on Friday
      const midTarget = parseTargetDate(schedule.midtermDate, 5, 8, 30);

      const now = new Date();
      const colDiff = colTarget.getTime() - now.getTime();
      const midDiff = midTarget.getTime() - now.getTime();

      // Top Header Countdown Display
      const colEl = document.getElementById('colloquium-countdown-text');
      const midEl = document.getElementById('midterm-countdown-text');

      // Sidebar rows: label left, time / grade right
      // value can be a grade the user typed: escaped, never parsed as HTML
      const safe = v => String(v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const row = (iconName, iconClass, label, value, valueClass) => `
        <span class="flex items-center gap-1.5 text-slate-300 font-medium whitespace-nowrap">${icon(iconName, iconClass)} ${label}</span>
        <span class="font-bold tabular-nums whitespace-nowrap ${valueClass}">${safe(value)}</span>`;
      // A day after the exam the timer has nothing left to count: invite to enter the grade instead
      const pending = diff => (diff <= -DAY_MS ? ['Add grade', 'text-slate-400 font-semibold'] : [formatCountdown(diff), '']);

      if (colEl) {
        if (grades.colloquium?.grade) {
          colEl.innerHTML = row('target', 'text-amber-400', 'Colloquium', grades.colloquium.grade, 'text-emerald-400');
        } else {
          const [value, cls] = pending(colDiff);
          colEl.innerHTML = row('zap', 'text-amber-400', 'Colloquium', value, cls || 'text-amber-400');
        }
      }

      if (midEl) {
        if (grades.midterm?.grade) {
          midEl.innerHTML = row('trophy', 'text-emerald-400', 'Midterm', grades.midterm.grade, 'text-emerald-400');
        } else {
          const [value, cls] = pending(midDiff);
          midEl.innerHTML = row('flame', 'text-rose-400', 'Midterm', value, cls || 'text-rose-400');
        }
      }

      // Countdowns in the profile window's Exams tab
      // Inner spans carry their own colour: a second text-* class on the element would fight its amber/rose one
      const cardTimer = (el, grade, diff) => {
        if (!el) return;
        if (grade) {
          el.innerHTML = `<span class="text-emerald-400">${icon('party-popper')} Done · </span>`;
          el.firstElementChild.append(grade); // user input: added as text, never as HTML
        } else if (diff <= 0) {
          el.innerHTML = '<span class="text-sm font-semibold text-slate-300">Finished · add your grade below</span>';
        } else {
          el.textContent = formatCountdown(diff);
        }
      };
      cardTimer(document.getElementById('colloquium-card-countdown'), grades.colloquium?.grade, colDiff);
      cardTimer(document.getElementById('midterm-card-countdown'), grades.midterm?.grade, midDiff);
    };

    updateTimer();
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(updateTimer, 1000);
  }

  renderDashboard() {
    this.renderDashboardScheduleOnly();
  }

  // --- STUDY PLAN: every task links to where it is done and checks off from the real result ---
  renderDashboardScheduleOnly() {
    const host = document.getElementById('dashboard-schedule-list');
    const days = window.PS_DATA?.SCHEDULE_DAYS;
    if (!host || !days || typeof StudyPlan === 'undefined') return;

    const ctx = StudyPlan.contextFromApp();
    const dates = StudyPlan.dayDates(StudyPlan.midtermDate(), days.map(d => d.day));
    const { state, focus } = StudyPlan.timeline(dates, StudyPlan.dateKey(new Date()));
    if (!this.planOpenDays) this.planOpenDays = new Set([focus]);
    const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const dateLabel = key => (key ? new Date(`${key}T12:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '');

    host.innerHTML = days.map(day => {
      const key = dates[day.day];
      const statuses = day.tasks.map(t => StudyPlan.status(t, ctx, key));
      const doneCount = statuses.filter(st => st.done).length;
      const allDone = doneCount === day.tasks.length;
      const when = state[day.day];
      const open = this.planOpenDays.has(day.day);
      const badge = allDone
        ? `<span class="plan-badge bg-emerald-600 text-white">${icon('check')} Done</span>`
        : when === 'today' ? `<span class="plan-badge bg-indigo-600 text-white">${icon('zap')} Today</span>`
        : when === 'past' ? `<span class="plan-badge bg-slate-800 text-slate-400">Past</span>`
        : `<span class="plan-badge bg-slate-800 text-slate-300">Day ${day.day}</span>`;

      const tasks = day.tasks.map((task, i) => {
        const link = StudyPlan.linkFor(task);
        const st = statuses[i];
        const manual = StudyPlan.isManual(link);
        const mark = manual
          ? `<button class="plan-check ${st.done ? 'is-checked' : ''}" role="checkbox" aria-checked="${st.done}" data-plan-check="${task.id}" title="${st.done ? 'Untick' : 'Mark as done'}">${st.done ? icon('check') : ''}</button>`
          : `<span class="plan-dot ${st.done ? 'is-done' : ''}" title="Ticks itself off from your results">${st.done ? icon('check') : ''}</span>`;
        const progress = st.need ? `<span class="plan-progress ${st.done ? 'text-emerald-400' : 'text-slate-400'}">${st.have}/${st.need}</span>`
          : st.left ? `<span class="plan-progress text-rose-400">${st.left}</span>` : '';
        return `
          <div class="plan-task">
            ${mark}
            <button class="plan-open" data-plan-open="${task.id}">
              <span class="plan-text ${st.done ? 'is-done' : ''}">${esc(task.text)}</span>
              <span class="plan-link">${esc(StudyPlan.linkLabel(link))} ${icon('arrow-right')}</span>
            </button>
            ${progress}
          </div>`;
      }).join('');

      return `
        <div class="plan-day ${when === 'today' ? 'is-today' : ''} ${allDone ? 'is-done' : ''}" data-plan-day="${day.day}">
          <button class="plan-day-head" data-plan-toggle="${day.day}" aria-expanded="${open}">
            ${badge}
            <span class="text-xs text-slate-400 whitespace-nowrap">${dateLabel(key)}</span>
            <span class="flex-1 min-w-0 text-sm font-bold text-slate-100 truncate">${esc(day.title)}</span>
            <span class="text-xs font-semibold tabular-nums ${allDone ? 'text-emerald-400' : 'text-slate-400'}">${doneCount}/${day.tasks.length}</span>
            <span class="plan-chevron ${open ? 'rotate-180' : ''}">${icon('chevron-down')}</span>
          </button>
          ${open ? `
            <div class="plan-day-body">
              <p class="text-xs text-slate-400 mb-3 leading-relaxed">${esc(day.description)}</p>
              <div class="space-y-1">${tasks}</div>
              <div class="mt-3 p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-xs text-amber-300/90 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span>${icon('flag')} <strong>Goal of the day:</strong> ${esc(day.colloquiumGoal)}</span>
                ${day.day <= StudyPlan.BONUS_DAYS ? `<span class="text-[11px] whitespace-nowrap ${allDone ? 'text-emerald-400 font-bold' : 'text-slate-400'}">${allDone ? `${icon('check')} +2% earned` : '+2% readiness once everything is done'}</span>` : ''}
              </div>
            </div>` : ''}
        </div>`;
    }).join('');

    host.querySelectorAll('[data-plan-toggle]').forEach(btn => btn.addEventListener('click', () => {
      const n = Number(btn.getAttribute('data-plan-toggle'));
      if (this.planOpenDays.has(n)) this.planOpenDays.delete(n);
      else this.planOpenDays.add(n);
      this.renderDashboardScheduleOnly();
    }));
    host.querySelectorAll('[data-plan-open]').forEach(btn => btn.addEventListener('click', () => this.openPlanTask(btn.getAttribute('data-plan-open'))));
    host.querySelectorAll('[data-plan-check]').forEach(btn => btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-plan-check');
      const rs = window.quizManager?.readinessState;
      if (!rs) return;
      rs.planChecks = { ...(rs.planChecks || {}) };
      if (rs.planChecks[id]) delete rs.planChecks[id];
      else rs.planChecks[id] = true;
      window.quizManager.saveReadiness(); // re-renders the plan and the readiness meter
    }));
    this.renderAllMath(host);
  }

  // Go to the exact place where a plan task is done (first unfinished item of it)
  openPlanTask(taskId) {
    const task = (window.PS_DATA?.SCHEDULE_DAYS || []).flatMap(d => d.tasks).find(t => t.id === taskId);
    if (!task) return;
    const link = StudyPlan.linkFor(task);
    const ctx = StudyPlan.contextFromApp();
    switch (link.kind) {
      case 'definitions':
        return this.openDefinition(link.ids.find(id => (ctx.defScores[id] || 0) < StudyPlan.PASS_SCORE) ?? link.ids[0]);
      case 'problems':
        return this.openProblem(link.ids.find(id => !ctx.problemsMastered[id]) ?? link.ids[0]);
      case 'quiz':
        return this.openQuizTopic(link.topics.find(t => !ctx.topicTests[t]?.solved) ?? link.topics[0]);
      case 'oral':
        this.switchTab('colloquium');
        return this.scrollToTarget('oral-questions-list');
      case 'drill':
      case 'ticket':
        this.switchTab('colloquium');
        this.setColloquiumMode(link.kind);
        return this.scrollToTarget('colloquium-modes');
      case 'exam': {
        window.rewards?.open('exams');
        const field = document.getElementById(`${link.exam}-grade-input`);
        return field?.offsetParent ? field.focus() : document.getElementById(`edit-${link.exam}-grade-btn`)?.focus();
      }
      case 'pomodoro':
        this.switchTab('dashboard');
        return this.scrollToTarget('pomodoro-card');
      case 'mistakes':
        this.switchTab('dashboard');
        return this.scrollToTarget('mistakes-card');
      case 'selftests':
        return this.switchTab('selftests');
      case 'mock':
        return this.switchTab('mock');
      case 'formulas':
        return this.switchTab('formulas');
      case 'topic':
        return this.openTopic(link.topic);
      default:
    }
  }

  // Smooth-scroll below the sticky top bar and briefly outline where the user landed
  scrollToTarget(target) {
    const el = typeof target === 'string' ? document.getElementById(target) : target;
    if (!el) return;
    requestAnimationFrame(() => {
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      el.classList.remove('nav-landed');
      void el.offsetWidth; // restart the highlight animation
      el.classList.add('nav-landed');
      setTimeout(() => el.classList.remove('nav-landed'), 1600);
    });
  }

  openDefinition(defId, { fromRoute = false } = {}) {
    const defs = window.PS_DATA?.DEFINITIONS_21 || [];
    const index = defs.findIndex(d => d.id === Number(defId));
    if (index < 0) return this.switchTab('colloquium', { fromRoute });
    this.switchTab('colloquium', { fromRoute });
    if (this.colloquiumMode !== 'browse') this.setColloquiumMode('browse');
    this.flashcardIndex = index;
    this.isCardFlipped = true;
    this.renderFlashcard();
    this.renderAllMath(document.getElementById('flashcard-container'));
    if (!fromRoute) this.setRoute(`colloquium/def/${defs[index].id}`, { replace: true });
    this.scrollToTarget('flashcard-container');
  }

  openQuizTopic(topicId, { fromRoute = false } = {}) {
    this.switchTab('quizzes', { fromRoute });
    window.quizManager?.startQuiz(Number(topicId));
    if (!fromRoute) this.setRoute(`quizzes/${topicId}`, { replace: true });
  }

  openTopic(topicId, { fromRoute = false } = {}) {
    this.switchTab('topics', { fromRoute });
    if (!fromRoute) this.setRoute(`topics/${topicId}`, { replace: true });
    this.scrollToTarget(`topic-card-${topicId}`);
  }

  // --- ROUTING: the address mirrors the section (and item), so back/forward, refresh and links work ---
  // #/dashboard · #/colloquium[/def/3] · #/problems[/7] · #/quizzes[/5] · #/selftests[/ST4-02] · #/topics[/topic-12] · #/formulas
  // #/getready[/c-moments] · #/mock[/2017] · #/formulas/sheet[-exam|-drill] (the exam formula sheet dialog)
  setRoute(route, { replace = false } = {}) {
    const hash = `#/${route}`;
    if (location.hash === hash) return;
    try { history[replace ? 'replaceState' : 'pushState'](null, '', hash); } catch (e) {}
  }

  applyRoute(hash = location.hash) {
    const [tab, a, b] = hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
    if (!tab || !document.getElementById(`tab-${tab}`)) return false;
    const opts = { fromRoute: true };
    if (tab === 'colloquium' && a === 'def' && b) this.openDefinition(b, opts);
    else if (tab === 'problems' && a) this.openProblem(a, opts);
    else if (tab === 'quizzes' && a) this.openQuizTopic(a, opts);
    else if (tab === 'topics' && a) this.openTopic(a, opts);
    else if (tab === 'selftests' && a) window.selfTestBank?.startTask(a, opts);
    else if (tab === 'getready' && a) window.getReady?.openItem(a, opts);
    else if (tab === 'mock' && a) window.mockMidterm?.openPaper(a, opts);
    else if (tab === 'formulas' && a) window.formulaSheet?.openRoute(a, opts);
    else this.switchTab(tab, opts);
    return true;
  }

  setupRouting() {
    window.addEventListener('popstate', () => this.applyRoute());
    if (!this.applyRoute()) this.setRoute(this.currentTab || 'dashboard', { replace: true });
  }

  renderColloquiumSection() {
    this.renderFlashcard();
    this.renderDefinitionsList();
    this.renderOralQuestionsList();
  }

  setupColloquiumModes() {
    document.querySelectorAll('[data-fc-mode]').forEach(btn => {
      btn.addEventListener('click', () => this.setColloquiumMode(btn.getAttribute('data-fc-mode')));
    });
  }

  // Flashcard hub has three modes: browse cards, random definition drill, exam ticket
  setColloquiumMode(mode) {
    this.colloquiumMode = mode;
    document.querySelectorAll('[data-fc-mode]').forEach(btn => {
      const active = btn.getAttribute('data-fc-mode') === mode;
      btn.classList.toggle('tab-active', active);
      btn.classList.toggle('tab-inactive', !active);
      btn.setAttribute('aria-pressed', String(active));
    });

    const panels = { browse: 'flashcard-container', drill: 'definition-drill-container', ticket: 'exam-ticket-container' };
    Object.entries(panels).forEach(([m, id]) => {
      document.getElementById(id)?.classList.toggle('hidden', m !== mode);
    });

    if (mode !== 'ticket') window.examTicket?.hide();

    if (mode === 'drill') {
      window.definitionDrill?.show();
    } else if (mode === 'ticket') {
      window.examTicket?.show();
    } else {
      this.renderFlashcard();
      this.renderAllMath(document.getElementById('flashcard-container'));
    }
  }

  renderFlashcard() {
    const cardContainer = document.getElementById('flashcard-container');
    if (!cardContainer || !window.PS_DATA?.DEFINITIONS_21) return;

    const defs = window.PS_DATA.DEFINITIONS_21;
    const def = defs[this.flashcardIndex];
    const score = window.quizManager?.readinessState?.definitionsScores?.[def.id] || 0;
    const isMastered = score >= 6;

    cardContainer.innerHTML = `
      <div class="flashcard-wrapper w-full max-w-2xl mx-auto perspective cursor-pointer" id="active-flashcard">
        <div class="flashcard-inner relative w-full min-h-[320px] rounded-2xl border ${isMastered ? 'border-emerald-500/50 bg-gradient-to-br from-slate-900 to-emerald-950/30' : 'border-indigo-500/40 bg-gradient-to-br from-slate-900 to-indigo-950/40'} p-6 shadow-2xl transition-all duration-300 flex flex-col justify-between">
          <div>
            <div class="flex justify-between items-center text-xs text-slate-400 mb-2">
              <span class="px-2 py-0.5 rounded bg-indigo-900/60 text-indigo-300 font-bold">Definition ${def.id} of 21</span>
              <span class="font-bold ${isMastered ? 'text-emerald-400' : 'text-amber-400'}">
                ${isMastered ? `${icon('star')} Mastered (${score}/10) +1%` : score > 0 ? `Score: ${score}/10 (Need ≥6 for 1%)` : `${icon('hourglass')} Not Yet Tested`}
              </span>
            </div>
            <h3 class="text-2xl font-extrabold text-slate-100 mb-1">${def.name}</h3>
            <div class="text-sm font-semibold text-indigo-400 mb-4">${def.nameUa}</div>

            <div class="p-4 rounded-xl bg-slate-950/80 border border-slate-800 text-center text-lg font-mono text-indigo-200 mb-4 overflow-x-auto">
              $$${def.latex}$$
            </div>

            <div id="flashcard-revealed-details" class="${this.isCardFlipped ? '' : 'hidden'} text-xs text-slate-300 space-y-3 mt-4 border-t border-slate-800 pt-4">
              <p><strong>Formal Definition:</strong> ${this.formatMd(def.definition)}</p>
              ${def.keyPoints?.length ? `
                <div class="p-3 rounded-lg bg-indigo-950/40 border border-indigo-600/60">
                  <div class="font-bold text-indigo-200 mb-1.5">${icon('pin')} Must know (${def.keyPoints.length})</div>
                  <ul class="list-disc pl-4 space-y-1 text-slate-200">
                    ${def.keyPoints.map(p => `<li>${this.formatMd(p)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              ${def.example ? `<p><strong>${icon('lightbulb')} Example:</strong> ${this.formatMd(def.example)}</p>` : ''}
              <div class="p-2.5 rounded bg-amber-950/30 border border-amber-800/50 text-amber-200">
                <strong>${icon('target')} Colloquium Oral Tip:</strong> ${this.formatMd(def.colloquiumTip)}
              </div>
              <div class="p-2.5 rounded bg-rose-950/30 border border-rose-800/50 text-rose-200">
                <strong>${icon('triangle-alert')} Professor Trap:</strong> ${this.formatMd(def.trap)}
              </div>
            </div>
          </div>

          <div class="pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>${this.isCardFlipped ? 'Click card to minimize' : `${icon('lightbulb')} Click card to reveal definition & traps`}</span>
            <button id="card-ai-test-btn" class="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition">
              ${icon('bot')} Test with Gemini (Grade ≥6 for 1%)
            </button>
          </div>
        </div>
      </div>

      <div class="flex justify-center items-center gap-4 mt-6">
        <button id="fc-prev-btn" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition">
          ${icon('chevron-left')} Previous
        </button>
        <button id="fc-self-pass-btn" class="px-5 py-2 rounded-lg ${isMastered ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-emerald-950 text-emerald-400 border border-emerald-600'} text-sm font-semibold transition">
          ${isMastered ? `${icon('check')} Scored ${score}/10 (+1% Readiness)` : 'Self-Check: Score 8/10 (+1%)'}
        </button>
        <button id="fc-next-btn" class="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition">
          Next ${icon('chevron-right')}
        </button>
      </div>
    `;

    document.getElementById('active-flashcard')?.addEventListener('click', (e) => {
      if (e.target.closest('#card-ai-test-btn')) return;
      this.isCardFlipped = !this.isCardFlipped;
      this.renderFlashcard();
      this.renderAllMath();
    });

    document.getElementById('card-ai-test-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openOralSimulatorModal(def.name, `Define ${def.name} rigorously with all measurability, integrability or support conditions and state its key properties.`, def.id);
    });

    document.getElementById('fc-self-pass-btn')?.addEventListener('click', () => {
      window.quizManager?.recordDefinitionScore(def.id, 8);
      this.renderFlashcard();
      this.renderDefinitionsList();
    });

    document.getElementById('fc-prev-btn')?.addEventListener('click', () => {
      this.flashcardIndex = (this.flashcardIndex - 1 + defs.length) % defs.length;
      this.isCardFlipped = false;
      this.renderFlashcard();
      this.renderAllMath();
    });

    document.getElementById('fc-next-btn')?.addEventListener('click', () => {
      this.flashcardIndex = (this.flashcardIndex + 1) % defs.length;
      this.isCardFlipped = false;
      this.renderFlashcard();
      this.renderAllMath();
    });
  }

  renderDefinitionsList() {
    const listContainer = document.getElementById('definitions-grid-list');
    if (!listContainer || !window.PS_DATA?.DEFINITIONS_21) return;

    listContainer.innerHTML = window.PS_DATA.DEFINITIONS_21.map(def => {
      const score = window.quizManager?.readinessState?.definitionsScores?.[def.id] || 0;
      const isMastered = score >= 6;

      return `
        <div class="def-card p-4 rounded-xl border ${isMastered ? 'border-emerald-600/50 bg-emerald-950/10' : 'border-slate-800 bg-slate-900/60'} hover:border-indigo-500 transition duration-150">
          <div class="flex justify-between items-start mb-2">
            <span class="text-xs font-bold px-2 py-0.5 rounded ${isMastered ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-indigo-300'}">#${def.id}</span>
            <span class="text-xs font-bold ${isMastered ? 'text-emerald-400' : 'text-slate-400'}">
              ${isMastered ? `${icon('check')} ${score}/10 (+1%)` : score > 0 ? `${score}/10` : 'Not Tested'}
            </span>
          </div>
          <h4 class="font-bold text-slate-100 text-sm mb-1">${def.name}</h4>
          <div class="text-xs text-slate-400 font-mono mb-2">$${def.latex}$</div>
          <p class="text-xs text-slate-300 line-clamp-3 mb-2">${this.formatMd(def.definition)}</p>
          ${def.keyPoints?.length ? `<div class="text-[11px] font-semibold text-indigo-300 mb-3">${icon('pin')} Must know: ${def.keyPoints.length}</div>` : ''}
          <div class="flex justify-between items-center text-[11px] pt-2 border-t border-slate-800/80">
            <span class="text-amber-400/90 font-medium truncate max-w-[160px]">${icon('triangle-alert')} ${this.formatMd(def.trap)}</span>
            <button class="def-jump-btn text-indigo-400 hover:text-indigo-300 font-semibold" data-def-index="${def.id - 1}">Test / Practice ${icon('arrow-right')}</button>
          </div>
        </div>
      `;
    }).join('');

    listContainer.querySelectorAll('.def-jump-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.flashcardIndex = parseInt(btn.getAttribute('data-def-index'), 10);
        this.isCardFlipped = true;
        if (this.colloquiumMode !== 'browse') this.setColloquiumMode('browse');
        this.renderFlashcard();
        this.renderAllMath();
        window.scrollTo({ top: 300, behavior: 'smooth' });
      });
    });
  }

  renderOralQuestionsList() {
    const container = document.getElementById('oral-questions-list');
    if (!container || !window.PS_DATA?.ORAL_QUESTIONS_12) return;

    container.innerHTML = window.PS_DATA.ORAL_QUESTIONS_12.map(oq => {
      const score = window.quizManager?.readinessState?.definitionsScores?.[`oral_${oq.id}`] || null;
      return `
        <div class="oral-card p-5 rounded-2xl border border-slate-800 bg-slate-900/70 mb-4 hover:border-slate-700 transition">
          <div class="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-2 mb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  Colloquium Question ${oq.id}
                </span>
                <span class="text-xs text-slate-400 font-mono">${icon('timer')} ${oq.time} presentation</span>
              </div>
              <h3 class="text-base font-bold text-slate-100 mt-1">${oq.title}</h3>
            </div>
            <div class="flex items-center gap-3">
              ${score !== null ? `<span class="px-2.5 py-1 rounded bg-indigo-950 text-indigo-300 font-bold text-xs border border-indigo-800">Score: ${score}/10</span>` : ''}
              <button class="oral-simulate-btn px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition" data-oq-id="${oq.id}">
                ${icon('mic')} Simulate Oral Defense
              </button>
            </div>
          </div>

          <div class="text-xs text-slate-300 space-y-2 mb-4">
            <div class="font-bold text-indigo-300">Recommended 4-Step Answer Flow:</div>
            <ul class="list-disc list-inside space-y-1 text-slate-300">
              ${oq.structure.map(s => `<li>${s}</li>`).join('')}
            </ul>
          </div>

          <details class="text-xs bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <summary class="font-semibold text-slate-300 cursor-pointer hover:text-indigo-400">${icon('book-open')} View Full Model Spoken Answer & Examiner Follow-Up Questions</summary>
            <div class="mt-3 space-y-3 pt-3 border-t border-slate-800 text-slate-300 leading-relaxed">
              <p><strong>Spoken Model Answer:</strong><br>${oq.speech}</p>
              <div>
                <strong>Key Formulas to Write on Board:</strong>
                <div class="p-2 rounded bg-slate-900 font-mono text-indigo-200 my-1 overflow-x-auto">
                  ${oq.keyFormulas.map(f => `<div>$$${f}$$</div>`).join('')}
                </div>
              </div>
              <div class="p-2.5 rounded bg-rose-950/30 border border-rose-800 text-rose-200">
                <strong>Tricky Follow-Up Questions:</strong>
                <ul class="list-disc list-inside mt-1">
                  ${oq.examinerQuestions.map(q => `<li>${q}</li>`).join('')}
                </ul>
              </div>
            </div>
          </details>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.oral-simulate-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.getAttribute('data-oq-id'), 10);
        const oq = window.PS_DATA.ORAL_QUESTIONS_12.find(q => q.id === id);
        if (oq) {
          this.openOralSimulatorModal(oq.title, oq.structure.join('\n'), `oral_${id}`);
        }
      });
    });
  }

  // Hint ladder: first a direction (which approach, no computations), then the dataset's step hints
  getHintSteps(prob) {
    const steps = [];
    const direction = window.PS_DATA?.PROBLEM_DIRECTIONS?.[prob.id];
    if (direction) {
      steps.push({
        label: `${icon('compass')} Where to start?`,
        html: `<strong>${icon('compass')} Direction:</strong> ${direction}`,
        cls: 'p-2.5 rounded-lg bg-amber-950/30 border border-amber-800/50 text-amber-100'
      });
    }
    const hints = prob.hints || [];
    hints.forEach((h, i) => steps.push({
      label: `${icon('lightbulb')} Hint ${i + 1} of ${hints.length}`,
      html: h,
      cls: 'text-slate-300'
    }));
    return steps;
  }

  renderHintLadder(prob) {
    const steps = this.getHintSteps(prob);
    if (!steps.length) return '';
    const shown = Math.min(this.hintLevels[prob.id] || 0, steps.length);
    const next = steps[shown];

    return `
      <div class="text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="font-semibold text-amber-300">${icon('lightbulb')} Hints${shown ? ` · ${shown} of ${steps.length} open` : ' — a nudge, not the solution'}</span>
          ${next
            ? `<button class="hint-next-btn px-3 py-1 rounded-lg bg-amber-950/60 hover:bg-amber-900 border border-amber-800 text-amber-200 font-semibold cursor-pointer transition" data-prob-id="${prob.id}">${next.label}</button>`
            : '<span class="text-[11px] text-slate-500">No more hints: the full solution is below</span>'}
        </div>
        ${shown ? `
          <div class="mt-2.5 pt-2.5 border-t border-slate-800 space-y-2">
            ${steps.slice(0, shown).map(s => `<div class="${s.cls}">${s.html}</div>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  // Quiz over the questions currently in the mistakes registry
  openMistakesPractice() {
    this.switchTab('quizzes');
    window.quizManager?.startQuiz('mistakes');
  }

  // Jump to a problem card from elsewhere (e.g. the dashboard mistakes panel)
  openProblem(probId, { fromRoute = false } = {}) {
    this.switchTab('problems', { fromRoute });
    if (!document.getElementById(`prob-card-${probId}`)) {
      document.querySelector('[data-prob-filter="all"]')?.click(); // card is hidden by the active filter
    }
    if (!fromRoute) this.setRoute(`problems/${probId}`, { replace: true });
    this.scrollToTarget(`prob-card-${probId}`);
  }

  // --- PROBLEM BANK WITH INTERACTIVE FINAL ANSWER SUBMISSION ---
  renderProblemsSection() {
    const container = document.getElementById('problems-list-container');
    if (!container || !window.PS_DATA?.PROBLEMS_BANK) return;

    let problems = window.PS_DATA.PROBLEMS_BANK;
    if (this.currentProbFilter !== 'all') {
      problems = problems.filter(p => 
        p.source.toLowerCase().includes(this.currentProbFilter.toLowerCase()) || 
        p.topic.toLowerCase().includes(this.currentProbFilter.toLowerCase())
      );
    }

    const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const defName = id => window.PS_DATA.DEFINITIONS_21.find(d => d.id === id)?.name || `Definition ${id}`;
    const notes = id => window.PS_DATA.TOPICS_NOTES.find(t => t.id === id);
    const linkCls = 'prob-theory-link inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-200 cursor-pointer transition';
    // Definitions and topic notes behind each problem (PROBLEM_THEORY in js/problem-directions.js)
    const theoryRow = prob => {
      const t = window.PS_DATA?.PROBLEM_THEORY?.[prob.id];
      if (!t) return '';
      const note = notes(t.notes);
      return `
        <div class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="font-semibold text-slate-400 mr-0.5">${icon('book-open')} Theory:</span>
          ${t.defs.map(id => `<button type="button" class="${linkCls}" data-def="${id}"><span class="font-bold text-indigo-400">#${id}</span> ${esc(defName(id))}</button>`).join('')}
          ${note ? `<button type="button" class="${linkCls}" data-notes="${note.id}" title="${esc(note.title)}">${icon('notebook-pen')} Topic ${note.number} notes</button>` : ''}
        </div>`;
    };

    container.innerHTML = problems.map(prob => {
      const isSolved = window.quizManager?.readinessState?.problemsMastered?.[prob.id] || false;

      return `
        <div class="problem-card p-5 rounded-2xl border ${isSolved ? 'border-emerald-600/50 bg-emerald-950/15 shadow-emerald-900/10' : 'border-slate-800 bg-slate-900/70'} mb-6 shadow-xl" id="prob-card-${prob.id}">
          <div class="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-slate-800 gap-2 mb-3">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-900/60 text-indigo-300">${prob.source}</span>
                <span class="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300">${prob.topic}</span>
                <span class="text-xs font-semibold ${prob.difficulty === 'Easy' ? 'text-emerald-400' : prob.difficulty === 'Medium' ? 'text-amber-400' : 'text-rose-400'}">
                  ${icon('circle-dot')} ${prob.difficulty}
                </span>
              </div>
              <h3 class="text-lg font-bold text-slate-100 mt-1">${prob.title}</h3>
            </div>
            <div>
              <span class="px-3 py-1 rounded-full text-xs font-bold ${isSolved ? 'bg-emerald-950 text-emerald-300 border border-emerald-700' : 'bg-slate-800 text-slate-400 border border-slate-700'}">
                ${isSolved ? `${icon('check')} Solved (+2.5% Readiness)` : 'Unsolved (+2.5% on Submit)'}
              </span>
            </div>
          </div>

          <!-- Problem Statement -->
          <div class="text-sm text-slate-200 mb-4 whitespace-pre-line leading-relaxed">
            ${prob.statement}
          </div>

          <!-- Interactive Final Answer Submission Box -->
          <div class="mb-5 p-4 rounded-xl bg-slate-950/90 border border-slate-800">
            <div class="text-xs font-bold text-indigo-400 mb-1.5 flex items-center justify-between">
              <span>${icon('pen-line')} Submit Final Answer for Readiness Credit:</span>
              <span class="text-[11px] font-mono text-emerald-400">+2.5% Readiness</span>
            </div>
            <p class="text-xs text-slate-300 mb-2">${prob.inputPrompt || 'Enter final answer:'}</p>
            <div class="flex flex-col sm:flex-row gap-2">
              <input type="text" id="prob-input-${prob.id}" placeholder="Your answer…"
                     value="${isSolved ? prob.expectedAnswer : ''}" ${isSolved ? 'disabled' : ''}
                     class="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500">
              <button class="prob-submit-btn px-5 py-2 rounded-lg ${isSolved ? 'bg-emerald-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-bold text-xs transition" 
                      data-prob-id="${prob.id}" ${isSolved ? 'disabled' : ''}>
                ${isSolved ? `${icon('check')} Verified Correct` : `Submit & Check ${icon('arrow-right')}`}
              </button>
            </div>
            <div id="prob-feedback-${prob.id}" class="${isSolved ? '' : 'hidden'} mt-2 text-xs font-semibold ${isSolved ? 'text-emerald-400' : ''}">
              ${isSolved ? `${icon('circle-check')} Verified! Correct Canonical Answer: ${prob.expectedAnswer}` : ''}
            </div>
          </div>

          <!-- Hints open one at a time; the full derivation stays collapsed until asked for -->
          <div class="space-y-3">
            ${theoryRow(prob)}
            <div id="hint-ladder-${prob.id}">${this.renderHintLadder(prob)}</div>

            <details class="text-xs bg-slate-950/80 p-4 rounded-xl border border-indigo-900/50">
              <summary class="font-bold text-indigo-400 cursor-pointer hover:underline text-sm">${icon('notebook-pen')} Complete Rigorous Step-by-Step Solution & Working</summary>
              <div class="mt-3 pt-3 border-t border-slate-800 text-slate-200 leading-relaxed space-y-2 whitespace-pre-line">
                ${prob.solution}
              </div>
            </details>
          </div>
        </div>
      `;
    }).join('');

    // One delegated listener survives the innerHTML re-renders of the problem list
    if (!container.dataset.hintsBound) {
      container.dataset.hintsBound = 'true';
      container.addEventListener('click', (e) => {
        const theory = e.target.closest('.prob-theory-link');
        if (theory) {
          if (theory.dataset.def) return this.openDefinition(Number(theory.dataset.def));
          return this.openTopic(theory.dataset.notes);
        }
        const btn = e.target.closest('.hint-next-btn');
        if (!btn) return;
        const pid = parseInt(btn.getAttribute('data-prob-id'), 10);
        this.hintLevels[pid] = (this.hintLevels[pid] || 0) + 1;
        const ladder = document.getElementById(`hint-ladder-${pid}`);
        const prob = window.PS_DATA.PROBLEMS_BANK.find(p => p.id === pid);
        if (ladder && prob) {
          ladder.innerHTML = this.renderHintLadder(prob);
          this.renderAllMath(ladder);
        }
      });
    }

    // Attach answer submission handlers
    container.querySelectorAll('.prob-submit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = parseInt(btn.getAttribute('data-prob-id'), 10);
        this.verifyProblemAnswer(pid);
      });
    });

    this.renderAllMath();
  }

  verifyProblemAnswer(probId) {
    const prob = window.PS_DATA?.PROBLEMS_BANK?.find(p => p.id === probId);
    if (!prob) return;

    const inputEl = document.getElementById(`prob-input-${probId}`);
    const feedbackEl = document.getElementById(`prob-feedback-${probId}`);
    if (!inputEl || !feedbackEl) return;

    const userVal = inputEl.value.trim().toLowerCase();
    if (!userVal) {
      alert("Please enter your final answer before submitting!");
      return;
    }

    const acceptable = (prob.acceptableAnswers || [prob.expectedAnswer]).map(a => a.toLowerCase().trim());
    
    // Check match directly or numeric closeness
    let isCorrect = acceptable.includes(userVal);
    if (!isCorrect) {
      const parsedUser = parseFloat(userVal);
      if (!isNaN(parsedUser)) {
        for (const a of acceptable) {
          const parsedAns = parseFloat(a);
          if (!isNaN(parsedAns) && Math.abs(parsedUser - parsedAns) < 0.02) {
            isCorrect = true;
            break;
          }
        }
      }
    }

    feedbackEl.classList.remove('hidden');
    if (isCorrect) {
      feedbackEl.className = 'mt-2 text-xs font-semibold text-emerald-400';
      feedbackEl.innerHTML = `${icon('circle-check')} Correct! Canonical answer: <strong>${prob.expectedAnswer}</strong>. (+2.5% Readiness awarded!)`;
      inputEl.disabled = true;
      const submitBtn = document.querySelector(`.prob-submit-btn[data-prob-id="${probId}"]`);
      if (submitBtn) {
        submitBtn.className = 'prob-submit-btn px-5 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs';
        submitBtn.disabled = true; // a solved problem's button is a status, not an action
        submitBtn.innerHTML = `${icon('check')} Verified Correct`;
      }
      window.quizManager?.recordProblemSolved(probId, true);
      window.userProfile?.recordSuccess(`prob_${probId}`);
    } else {
      feedbackEl.className = 'mt-2 text-xs font-semibold text-rose-400';
      feedbackEl.innerHTML = `${icon('circle-x')} Not quite. Compare with the hint or step-by-step solution below and try again!`;
      window.userProfile?.recordMistake(`prob_${probId}`, prob.title, prob.topic, 'problem');
    }
  }

  renderTopicsSection() {
    const container = document.getElementById('topics-notes-container');
    if (!container || !window.PS_DATA?.TOPICS_NOTES) return;

    container.innerHTML = window.PS_DATA.TOPICS_NOTES.map(t => {
      const testRecord = window.quizManager?.readinessState?.topicTestsSolved?.[t.id];
      const isSolved = testRecord?.solved;
      const score = testRecord?.score;
      const total = testRecord?.total || 50;
      const pct = score !== undefined ? Math.round((score / total) * 100) : null;

      return `
        <div id="topic-card-${t.id}" class="topic-note-card p-6 rounded-2xl border ${isSolved ? 'border-emerald-800/80 bg-slate-900/80 shadow-emerald-950/20' : 'border-slate-800 bg-slate-900/60'} mb-6 shadow-xl">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
            <h3 class="text-xl font-extrabold text-slate-100">${t.title}</h3>
            ${isSolved ? `
              <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-950 text-emerald-300 border border-emerald-700 shrink-0 self-start sm:self-center">
                ${icon('check')} Passed: ${score}/${total} (${pct}%)
              </span>
            ` : `
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-400 shrink-0 self-start sm:self-center">
                Not passed yet (50 Q)
              </span>
            `}
          </div>
          <p class="text-xs text-slate-400 mb-4 italic">${t.summary}</p>
          <div class="max-w-none text-xs text-slate-300 leading-relaxed space-y-2 border-t border-slate-800 pt-4">
            ${this.formatNotes(t.content)}
          </div>
          <div class="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
            <div class="text-xs text-slate-400">
              ${isSolved ? `<span class="text-emerald-400 font-semibold">${icon('check')} Counted towards readiness (+1%)</span>` : 'Pass the test to add +1% readiness'}
            </div>
            <button class="topic-quiz-btn px-4 py-2 rounded-lg ${isSolved ? 'bg-indigo-700 hover:bg-indigo-600' : 'bg-indigo-600 hover:bg-indigo-500'} text-white font-semibold text-xs transition flex items-center gap-1.5" data-topic-id="${t.id}">
              ${isSolved ? `${icon('rotate-ccw')} Retake (50 Q)` : `${icon('brain')} Quiz on this Topic (50 Q)`}
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('.topic-quiz-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const topicId = parseInt(btn.getAttribute('data-topic-id'), 10);
        this.switchTab('quizzes');
        window.quizManager?.startQuiz(topicId);
      });
    });

    this.renderAllMath(container);
  }

  renderFormulasSection() {
    window.formulaSheet?.init(); // the exam formula sheet card on top of the tab
    const tbody = document.getElementById('distributions-table-body');
    if (!tbody || !window.PS_DATA?.DISTRIBUTIONS_DATA) return;

    const wrapMath = (val) => {
      if (!val) return '';
      const str = String(val).trim();
      if (str.startsWith('$') || str.startsWith('\\[')) return str;
      return `$${str}$`;
    };

    const formatNuance = (text) => {
      if (!text) return '';
      if (text.includes('$')) return text;
      // Auto-wrap common LaTeX formulas and symbols if not already wrapped
      return text.replace(/(\\[a-zA-Z]+(?:\{[^}]*\})*|[NEPBGU]\([^)]+\)|\b[a-z]\s*~|\bX_[1-2]\b|\b\w+\^2\b)/g, m => `$${m}$`);
    };

    tbody.innerHTML = window.PS_DATA.DISTRIBUTIONS_DATA.map(d => {
      const pmf = d.pmf_pdf || d.pmf_or_pdf || '';
      const nuance = d.keyProperty || d.nuance || '';

      return `
      <tr class="hover:bg-slate-850/50 transition text-xs border-b border-slate-800/60">
        <td class="p-3 font-bold text-indigo-300 whitespace-nowrap">${d.name}</td>
        <td class="p-3 text-slate-300 font-mono">${wrapMath(d.support)}</td>
        <td class="p-3 text-slate-200 font-mono">${wrapMath(pmf)}</td>
        <td class="p-3 text-emerald-400 font-mono">${wrapMath(d.mean)}</td>
        <td class="p-3 text-amber-400 font-mono">${wrapMath(d.variance)}</td>
        <td class="p-3 text-cyan-300 font-mono">${wrapMath(d.pgf)}</td>
        <td class="p-3 text-violet-300 font-mono">${wrapMath(d.mgf)}</td>
        <td class="p-3 text-slate-400 text-[11px] leading-tight">${formatNuance(nuance)}</td>
      </tr>
    `}).join('');

    this.renderAllMath(tbody);
  }

  setupGeminiDrawer() {
    const drawer = document.getElementById('gemini-drawer');
    const openBtn = document.getElementById('gemini-open-drawer-btn');
    const closeBtn = document.getElementById('gemini-close-drawer-btn');
    const sendBtn = document.getElementById('gemini-chat-send-btn');
    const input = document.getElementById('gemini-chat-input');
    const messages = document.getElementById('gemini-chat-messages');

    openBtn?.addEventListener('click', () => {
      drawer?.classList.remove('translate-x-full');
      window.geminiMentor?.updateKeyStatusUI();
    });
    closeBtn?.addEventListener('click', () => drawer?.classList.add('translate-x-full'));

    const handleSend = async () => {
      const text = input?.value?.trim();
      if (!text) return;

      if (!window.geminiMentor?.hasValidApiKey()) {
        const botBubble = document.createElement('div');
        botBubble.className = 'p-3.5 rounded-xl bg-amber-950/80 text-amber-200 self-start max-w-[90%] text-xs border border-amber-800 leading-relaxed';
        botBubble.innerHTML = `
          <div class="font-bold text-amber-300 mb-1 flex items-center gap-1.5">
            ${icon('triangle-alert')} <span>Gemini API key needed:</span>
          </div>
          <div>To chat with the Gemini mentor, add your own Google AI Studio key. It is free and takes 10 seconds.</div>
          <button id="chat-need-key-btn" class="mt-2.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow transition">
            ${icon('key-round')} Set up API key
          </button>
        `;
        messages?.appendChild(botBubble);
        messages.scrollTop = messages.scrollHeight;
        document.getElementById('chat-need-key-btn')?.addEventListener('click', () => {
          document.getElementById('gemini-settings-modal')?.classList.remove('hidden');
        });
        return;
      }

      input.value = '';

      // User Message
      const userBubble = document.createElement('div');
      userBubble.className = 'p-3 rounded-xl bg-indigo-600 text-white self-end max-w-[85%] text-xs shadow-md';
      userBubble.textContent = text;
      messages?.appendChild(userBubble);
      messages.scrollTop = messages.scrollHeight;

      // Loading Bubble
      const botBubble = document.createElement('div');
      botBubble.className = 'p-3 rounded-xl bg-slate-800 text-slate-200 self-start max-w-[85%] text-xs border border-slate-700/80 leading-relaxed';
      botBubble.textContent = 'Thinking mathematically...';
      messages?.appendChild(botBubble);
      messages.scrollTop = messages.scrollHeight;

      const reply = await window.geminiMentor?.chat(text);
      botBubble.innerHTML = reply;
      this.renderAllMath(botBubble);
      messages.scrollTop = messages.scrollHeight;
    };

    sendBtn?.addEventListener('click', handleSend);
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSend();
    });
  }

  setupGeminiSettingsModal() {
    const modal = document.getElementById('gemini-settings-modal');
    const headerGearBtn = document.getElementById('open-api-key-settings');
    const drawerKeyBtn = document.getElementById('drawer-api-key-btn');
    const closeBtn = document.getElementById('close-gemini-settings-btn');
    const keyInput = document.getElementById('settings-api-key-input');
    const modelSelect = document.getElementById('settings-model-select');
    const testBtn = document.getElementById('settings-test-connection-btn');
    const saveBtn = document.getElementById('settings-save-btn');
    const clearBtn = document.getElementById('settings-clear-key-btn');
    const toggleVisBtn = document.getElementById('toggle-key-visibility-btn');
    const statusBox = document.getElementById('settings-test-status');

    const openSettings = () => {
      if (keyInput) keyInput.value = window.geminiMentor?.apiKey || '';
      if (modelSelect) modelSelect.value = window.geminiMentor?.selectedModel || 'gemini-3.8-flash';
      if (statusBox) statusBox.classList.add('hidden');
      modal?.classList.remove('hidden');
    };

    headerGearBtn?.addEventListener('click', openSettings);
    drawerKeyBtn?.addEventListener('click', openSettings);
    closeBtn?.addEventListener('click', () => modal?.classList.add('hidden'));

    toggleVisBtn?.addEventListener('click', () => {
      if (keyInput.type === 'password') {
        keyInput.type = 'text';
        toggleVisBtn.textContent = 'Hide';
      } else {
        keyInput.type = 'password';
        toggleVisBtn.textContent = 'Show';
      }
    });

    testBtn?.addEventListener('click', async () => {
      const candidate = keyInput?.value?.trim();
      if (!candidate) {
        if (statusBox) {
          statusBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-950/80 border border-rose-800 text-rose-300';
          statusBox.textContent = 'Enter an API key before testing.';
          statusBox.classList.remove('hidden');
        }
        return;
      }
      testBtn.innerHTML = `${icon('hourglass')} Checking…`;
      const res = await window.geminiMentor?.testConnection(candidate);
      testBtn.innerHTML = `${icon('zap')} Test Connection`;
      if (statusBox) {
        statusBox.classList.remove('hidden');
        if (res.success) {
          if (res.warning) {
            statusBox.className = 'p-3 rounded-xl text-xs font-semibold bg-amber-950/80 border border-amber-800 text-amber-300 leading-relaxed';
            statusBox.innerHTML = `${icon('triangle-alert')} ${res.message}`;
          } else {
            statusBox.className = 'p-3 rounded-xl text-xs font-semibold bg-emerald-950/80 border border-emerald-800 text-emerald-300 leading-relaxed';
            statusBox.innerHTML = `${icon('circle-check')} ${res.message}`;
          }
        } else {
          statusBox.className = 'p-3 rounded-xl text-xs font-semibold bg-rose-950/80 border border-rose-800 text-rose-300 leading-relaxed';
          statusBox.innerHTML = `${icon('circle-x')} ${res.message}`;
        }
      }
    });

    saveBtn?.addEventListener('click', () => {
      const key = keyInput?.value?.trim();
      const model = modelSelect?.value;
      if (model) window.geminiMentor?.setModel(model);
      window.geminiMentor?.setApiKey(key);
      modal?.classList.add('hidden');
      window.geminiMentor?.updateKeyStatusUI();
      alert('Gemini settings saved.');
    });

    clearBtn?.addEventListener('click', () => {
      if (confirm('Clear the saved API key?')) {
        window.geminiMentor?.setApiKey('');
        if (keyInput) keyInput.value = '';
        if (statusBox) {
          statusBox.className = 'p-3 rounded-xl text-xs font-semibold bg-amber-950/80 border border-amber-800 text-amber-300';
          statusBox.textContent = 'Key cleared.';
          statusBox.classList.remove('hidden');
        }
      }
    });
  }

  openOralSimulatorModal(title, rubric, defId = null) {
    const modal = document.getElementById('oral-simulator-modal');
    if (!modal) return;

    modal.classList.remove('hidden');
    document.getElementById('modal-oral-title').textContent = title;
    document.getElementById('modal-oral-rubric').textContent = rubric;
    const answerInput = document.getElementById('modal-oral-student-answer');
    const feedbackBox = document.getElementById('modal-oral-feedback-box');
    answerInput.value = '';
    feedbackBox.classList.add('hidden');

    const submitBtn = document.getElementById('modal-oral-submit-btn');
    submitBtn.onclick = async () => {
      const studentText = answerInput.value.trim();
      if (!studentText) {
        alert("Please speak or write your definition / proof first!");
        return;
      }

      if (!window.geminiMentor?.hasValidApiKey()) {
        const wantsKey = confirm("For a strict check by Gemini, connect your free API key.\nPress OK to enter a key, or Cancel to grade offline.");
        if (wantsKey) {
          document.getElementById('gemini-settings-modal')?.classList.remove('hidden');
          return;
        }
      }

      feedbackBox.classList.remove('hidden');
      feedbackBox.innerHTML = '<div class="p-4 text-center text-xs text-indigo-400">Evaluating against UCU Colloquium standards...</div>';

      const evalResult = await window.geminiMentor?.evaluateOralAnswer(title, studentText, rubric);
      feedbackBox.innerHTML = evalResult;
      this.renderAllMath(feedbackBox);

      // Extract score (e.g. Score: 8/10)
      const match = evalResult.match(/Score:\s*(\d+)\/10/i);
      const score = match ? parseInt(match[1], 10) : 7;
      
      if (defId) {
        window.quizManager?.recordDefinitionScore(defId, score);
        this.renderColloquiumSection();
      }
    };

    document.getElementById('modal-oral-close-btn').onclick = () => {
      modal.classList.add('hidden');
    };
  }

  setupProfileModal() {
    const modal = document.getElementById('user-profile-modal');
    const openBtn = document.getElementById('header-user-profile-btn');
    const closeBtn = document.getElementById('close-profile-modal-btn');
    const saveNameBtn = document.getElementById('profile-save-name-btn');
    const nameInput = document.getElementById('profile-name-input');
    const photoUploadInput = document.getElementById('profile-photo-upload');

    openBtn?.addEventListener('click', () => {
      if (nameInput && window.userProfile) {
        nameInput.value = window.userProfile.profile.name;
      }
      modal?.classList.remove('hidden');
      window.userProfile?.renderAvatar('modal-avatar-preview');
      window.userProfile?.renderWardrobeList();
      // Rendered at startup while hidden (width unknown) — re-render now so it fits the card on phones
      window.userProfile?.setupGoogleButton('google-signin-btn-container');
    });

    closeBtn?.addEventListener('click', () => {
      modal?.classList.add('hidden');
    });

    saveNameBtn?.addEventListener('click', () => {
      const newName = nameInput?.value?.trim();
      if (newName && window.userProfile) {
        window.userProfile.updateProfileDetails(newName, null);
        alert("Profile name updated!");
      }
    });

    photoUploadInput?.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file && window.userProfile) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          window.userProfile.updateProfileDetails(null, evt.target.result);
          alert("Custom profile photo uploaded!");
        };
        reader.readAsDataURL(file);
      }
    });

    document.getElementById('profile-reset-timer-btn')?.addEventListener('click', () => {
      if (confirm("Reset your study session timer back to 0:00?")) {
        window.userProfile?.resetStudyTimer();
      }
    });
  }

  setupEventListeners() {
    // Problem filter buttons
    document.querySelectorAll('[data-prob-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        // Swap the whole look: equal-specificity Tailwind colours must not coexist (the grey used to win)
        document.querySelectorAll('[data-prob-filter]').forEach(b => {
          const on = b === btn;
          ['bg-indigo-600', 'text-white'].forEach(c => b.classList.toggle(c, on));
          ['bg-slate-800', 'text-slate-300', 'hover:bg-slate-700'].forEach(c => b.classList.toggle(c, !on));
          b.setAttribute('aria-pressed', String(on));
        });
        this.currentProbFilter = btn.getAttribute('data-prob-filter');
        this.renderProblemsSection();
      });
    });

    // Pomodoro main controller
    document.getElementById('main-pomodoro-toggle')?.addEventListener('click', () => {
      if (window.pomodoroTimer?.isRunning) window.pomodoroTimer.pause();
      else window.pomodoroTimer.start();
    });

    document.getElementById('main-pomodoro-reset')?.addEventListener('click', () => {
      window.pomodoroTimer?.reset();
    });

    document.getElementById('pomodoro-toggle-btn')?.addEventListener('click', () => {
      if (window.pomodoroTimer?.isRunning) window.pomodoroTimer.pause();
      else window.pomodoroTimer.start();
    });
  }

  // Dataset strings mark the must-know terms with **bold** markdown
  formatMd(text = '') {
    return String(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }

  // Topic notes are light markdown: ### headings, -/* bullets, 1. lists, **bold**, one-line $$ formulas
  formatNotes(md = '') {
    const html = [];
    let list = null; // currently open 'ul' | 'ol'
    const closeList = () => {
      if (list) html.push(`</${list}>`);
      list = null;
    };

    String(md).split('\n').forEach(raw => {
      const line = raw.trim();
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      const item = line.match(/^(?:([-*])|\d+\.)\s+(.*)$/);

      if (!line) {
        closeList();
      } else if (heading) {
        closeList();
        html.push(`<h4 class="text-sm font-bold text-slate-100 pt-2">${this.formatMd(heading[1])}</h4>`);
      } else if (item) {
        const tag = item[1] ? 'ul' : 'ol';
        if (list !== tag) {
          closeList();
          html.push(`<${tag} class="${tag === 'ul' ? 'list-disc' : 'list-decimal'} pl-5 space-y-1">`);
          list = tag;
        }
        html.push(`<li>${this.formatMd(item[2])}</li>`);
      } else {
        closeList();
        html.push(`<p>${this.formatMd(line)}</p>`);
      }
    });
    closeList();
    return html.join('');
  }

  renderAllMath(targetElem = null) {
    const doRender = () => {
      if (typeof window.renderMathInElement === 'function') {
        try {
          window.renderMathInElement(targetElem || document.body, {
            macros: { '\\mbox': '\\text{#1}' },
            delimiters: [
              { left: "$$", right: "$$", display: true },
              { left: "$", right: "$", display: false },
              { left: "\\[", right: "\\]", display: true },
              { left: "\\(", right: "\\)", display: false }
            ],
            ignoredTags: ["script", "noscript", "style", "textarea", "option"],
            throwOnError: false
          });
        } catch (e) {
          console.warn('KaTeX render notice:', e);
        }
      } else {
        setTimeout(doRender, 100);
      }
    };
    doRender();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new AppController();
  window.app.init();
});
