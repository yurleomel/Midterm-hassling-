// ========================================================
// Rewards UI: the dashboard card, the profile modal (Avatar · Shop · Stickers · Account),
// toasts, and notify() — the hook the study features call after saving progress.
// Logic: js/rewards.js · catalog: js/rewards-data.js · art: js/rewards-art.js
// Public: window.rewards.open('avatar'|'shop'|'stickers'|'exams'|'account'), .notify(kind, detail), .render()
// Any element with data-rewards-open="<section>" opens the modal there.
// ========================================================

(() => {
class RewardsUI {
  constructor(data, wardrobe) {
    this.data = data;
    this.items = RewardsLogic.catalog(data, wardrobe);
    this.itemById = new Map(this.items.map(i => [i.id, i]));
    this.stickerById = new Map(data.STICKERS.map(s => [s.id, s]));
    this.tab = 'avatar';
    this.slot = 'top';        // wardrobe filter
    this.shopModule = 'all';  // shop filter
    this.tryOn = null;        // shop item shown on the preview avatar
    this.detail = null;       // sticker shown in the detail bar
    this.seenBefore = 0;      // "new" dots stay visible during the visit that clears them
    this.avatarCache = new Map();

    this.toastHost = document.createElement('div');
    this.toastHost.className = 'rw-toasts';
    this.toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(this.toastHost);

    this.modal = document.getElementById('user-profile-modal');
    document.addEventListener('click', e => this.onClick(e));
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.isOpen()) this.close();
    });
  }

  // --- state ---
  get profile() { return window.userProfile?.profile || null; }
  get state() {
    const p = this.profile;
    if (!p) return RewardsLogic.empty();
    if (!p.rewards || p.rewards.v !== 1) p.rewards = RewardsLogic.normalize(p.rewards);
    return p.rewards;
  }
  get readiness() { return window.quizManager?.readinessState?.overallPercent || 0; }
  get quiet() { try { return localStorage.getItem('stathustle_rewards_quiet') === '1'; } catch (e) { return false; } }
  get reduced() { return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; }

  persist() { window.userProfile?.saveProfile(); }

  // Everything the rules read, taken from the readiness state the app already keeps
  context(action = null) {
    const rs = window.quizManager?.readinessState || {};
    const bank = window.SELFTEST_BANK;
    const stPassed = bank && typeof SelfTestLogic !== 'undefined'
      ? SelfTestLogic.topicProgress(bank.tasks, bank.topics, rs.selfTestStats || {}).filter(p => p.passed).map(p => p.topic)
      : [];
    return {
      stats: rs.selfTestStats || {}, tasks: bank?.tasks || [], stPassed,
      tests: rs.topicTestsSolved || {}, defs: rs.definitionsScores || {},
      defIds: (window.PS_DATA?.DEFINITIONS_21 || []).map(d => d.id), probs: rs.problemsMastered || {},
      readiness: rs.overallPercent || 0,
      tiers: this.items.filter(i => i.tier && i.min > 0).map(i => ({ id: i.id, min: i.min })),
      now: Date.now(), action
    };
  }

  // --- hooks ---
  // kind: 'selftest' {id, correct} | 'definition' {id, score} | 'problem' {id} | 'topicTest' {id, score, total}
  //       | 'pomodoro' | 'fix' (a mistake left the registry). Only real progress counts as a study day.
  notify(kind, detail = {}) {
    if (!window.userProfile?.isLoggedIn) return;
    const productive = { selftest: detail.correct === true, definition: detail.score >= 6 }[kind]
      ?? ['problem', 'topicTest', 'pomodoro', 'fix'].includes(kind);
    const now = new Date();
    const action = { kind, productive, hour: now.getHours(), dow: now.getDay() };
    const events = RewardsLogic.evaluate(this.state, this.context(action), this.data);
    if (events.length || productive) this.persist();
    this.announce(events);
    this.render();
  }

  // A profile was loaded or merged with the cloud: catch up silently on earlier progress, say it once
  onProfileLoaded() {
    if (window.userProfile?.isLoggedIn) {
      const events = RewardsLogic.evaluate(this.state, this.context(null), this.data);
      if (events.length) {
        this.persist();
        this.announce(events, true);
      }
    }
    this.render();
  }

  // --- rendering ---
  render() {
    this.renderCard();
    ['user-avatar-display', 'modal-avatar-preview', 'rewards-modal-mini'].forEach(id => {
      const el = document.getElementById(id);
      if (el) this.renderAvatarInto(el);
    });
    if (this.isOpen()) this.renderModal();
  }

  worn(extra) {
    const w = RewardsLogic.worn(this.state, this.items, this.profile?.equippedOutfit);
    return extra ? { ...w, [extra.slot]: extra } : w;
  }

  renderAvatarInto(el, parts = this.worn()) {
    const svg = RewardsArt.avatar(parts);
    if (this.avatarCache.get(el) !== svg || !el.firstChild) {
      el.innerHTML = svg;
      this.avatarCache.set(el, svg);
    }
  }

  renderCard() {
    const bal = document.getElementById('rewards-balance');
    if (!bal) return;
    const s = this.state;
    const balance = Math.max(0, RewardsLogic.balance(s));
    this.countTo(bal, balance);
    document.getElementById('rewards-balance-label').textContent = points(balance, false);

    const streak = this.currentStreak();
    const got = Object.keys(s.stk).filter(id => this.stickerById.has(id)).length;
    document.getElementById('rewards-meta').innerHTML =
      `${icon('flame', streak ? 'text-orange-500' : 'text-slate-400')} ${streak ? `${streak}-day streak` : 'Start a streak today'}` +
      ` · ${got}/${this.data.STICKERS.length} stickers`;

    const recent = this.earnedStickers().slice(0, 3);
    const html = recent.length
      ? recent.map(st => `<button type="button" data-rewards-open="stickers" data-rw-sticker="${st.id}" class="w-10 h-10 cursor-pointer transition hover:scale-110 hover:-rotate-6" title="${esc(st.n)}" aria-label="Sticker: ${esc(st.n)}">${this.stickerSvg(st)}</button>`).join('')
        + `<span class="text-[11px] text-slate-400 leading-tight ml-1 hidden sm:block">Latest:<br><strong class="text-slate-300">${esc(recent[0].n)}</strong></span>`
      : `<span class="text-[11px] text-slate-400 leading-snug">Your first sticker is one correct self-test answer away.
           <button type="button" data-rw-go="selftests" class="font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer">Solve one ${icon('arrow-right')}</button></span>`;
    const recentEl = document.getElementById('rewards-recent');
    if (this.recentHtml !== html || !recentEl.firstChild) { // re-rendered on every save; touch the DOM only on change
      recentEl.innerHTML = html;
      this.recentHtml = html;
    }

    const hasNew = Object.values(s.stk).some(t => t > s.seen);
    document.getElementById('rewards-new-dot')?.classList.toggle('hidden', !hasNew);
  }

  isOpen() { return this.modal && !this.modal.classList.contains('hidden'); }

  // section: 'avatar' | 'shop' | 'stickers' | 'exams' | 'account' (default: the last one); sticker: show its details
  open(section, sticker = null) {
    if (!this.modal) return;
    if (section && ['avatar', 'shop', 'stickers', 'exams', 'account'].includes(section)) this.tab = section;
    this.detail = sticker || null;
    const nameInput = document.getElementById('profile-name-input');
    if (nameInput && this.profile) nameInput.value = this.profile.name || '';
    this.tryOn = null;
    this.modal.classList.remove('hidden');
    this.renderModal();
    document.getElementById('rewards-dialog')?.focus({ preventScroll: true });
  }

  close() {
    this.modal?.classList.add('hidden');
    this.tryOn = null;
    this.detail = null;
    this.visiting = false;
  }

  setTab(tab, sticker = null) {
    this.tab = tab;
    this.detail = sticker || null;
    if (tab !== 'stickers') this.visiting = false;
    this.renderModal();
  }

  renderModal() {
    const s = this.state;
    const got = Object.keys(s.stk).filter(id => this.stickerById.has(id)).length;
    setText('rewards-modal-balance', points(Math.max(0, RewardsLogic.balance(s))));
    setText('rewards-modal-count', `${got} of ${this.data.STICKERS.length} stickers`);
    this.modal.querySelectorAll('[data-rewards-tab]').forEach(b => {
      const on = b.dataset.rewardsTab === this.tab;
      b.setAttribute('aria-selected', String(on));
      b.className = `py-2 rounded-lg cursor-pointer transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${on ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`;
    });
    this.modal.querySelectorAll('[data-rewards-panel]').forEach(p => p.classList.toggle('hidden', p.dataset.rewardsPanel !== this.tab));
    // Entering the collection clears its "new" dots — they stay visible until the next visit
    if (this.tab === 'stickers' && !this.visiting) {
      this.visiting = true;
      this.seenBefore = s.seen;
      if (Object.values(s.stk).some(t => t > s.seen)) {
        s.seen = Date.now();
        this.persist();
        this.renderCard();
      }
    }
    if (this.tab === 'avatar') this.renderWardrobe();
    if (this.tab === 'shop') this.renderShop();
    if (this.tab === 'stickers') this.renderStickers();
    if (this.tab === 'exams') window.userProfile?.renderExamScheduleAndGrades?.(); // badges follow the clock and the saved grades
  }

  chip(attr, value, label, on) {
    return `<button type="button" ${attr}="${value}" aria-pressed="${on}" class="px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer transition ${on
      ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-indigo-500 hover:text-slate-100'}">${label}</button>`;
  }

  tile({ attrs = '', art, name, badge = '', on = false, locked = false }) {
    const tag = locked ? 'div' : 'button type="button"';
    return `<${tag} ${attrs} ${locked ? '' : `aria-pressed="${on}"`} class="rw-tile relative flex flex-col items-center gap-1 p-2 rounded-2xl border text-center ${on
      ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500/50'
      : locked ? 'border-slate-800 bg-slate-950/40' : 'border-slate-800 bg-slate-950/60 hover:border-indigo-500 hover:-translate-y-0.5 cursor-pointer'} transition">
      <span class="rw-art block w-full aspect-square p-1 rounded-xl ${locked ? 'opacity-40 grayscale' : ''}">${art}</span>
      <span class="text-[11px] leading-tight font-semibold text-slate-200 line-clamp-2">${esc(name)}</span>
      ${badge}
    </${locked ? 'div' : 'button'}>`;
  }

  renderWardrobe() {
    const s = this.state;
    const ready = this.readiness;
    const worn = this.worn();
    const mine = this.items.filter(i => i.tier || s.own[i.id] !== undefined);
    document.getElementById('rewards-slot-filter').innerHTML = this.data.SLOTS
      .map(sl => this.chip('data-rw-slot', sl.id, `${sl.n} <span class="opacity-80">${mine.filter(i => i.slot === sl.id && RewardsLogic.canWear(s, i, ready)).length}</span>`, sl.id === this.slot))
      .join('');

    // bought first, then the readiness tiers you have, then the ones still locked
    const rank = i => (!i.tier ? 0 : RewardsLogic.canWear(s, i, ready) ? 1 : 2) + (i.min || 0) / 1000;
    const list = mine.filter(i => i.slot === this.slot).sort((a, b) => rank(a) - rank(b));
    const tiles = list.map(it => {
      const can = RewardsLogic.canWear(s, it, ready);
      const on = worn[this.slot]?.id === it.id;
      const badge = on ? `<span class="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-500 text-white text-[11px] flex items-center justify-center" aria-label="Wearing">${icon('check')}</span>`
        : !can ? `<span class="text-[10px] font-bold text-slate-400">${icon('lock')} at ${it.min}% readiness</span>`
        : it.tier ? `<span class="text-[10px] text-slate-400">free at ${it.min}%</span>` : '';
      return this.tile({ attrs: can ? `data-rw-wear="${it.id}" title="${esc(it.d || '')}"` : `title="Unlocks at ${it.min}% readiness"`, art: RewardsArt.part(it), name: it.n, badge, on, locked: !can });
    });
    if (this.slot !== 'top') {
      tiles.unshift(this.tile({ attrs: 'data-rw-wear="" title="Take it off"', art: `<span class="flex w-full h-full items-center justify-center text-2xl text-slate-500">${icon('ban')}</span>`, name: 'Nothing', on: !worn[this.slot] }));
    }
    const forSale = this.data.SHOP.filter(i => i.slot === this.slot && s.own[i.id] === undefined).length;
    document.getElementById('rewards-wardrobe').innerHTML = tiles.join('') + (forSale
      ? `<button type="button" data-rewards-tab="shop" data-rw-shop-slot="${this.slot}" class="flex flex-col items-center justify-center gap-1 p-2 rounded-2xl border border-dashed border-slate-700 text-indigo-400 hover:border-indigo-500 hover:text-indigo-300 cursor-pointer transition text-[11px] font-bold">
          <span class="text-2xl">${icon('shopping-bag')}</span>${forSale} more in the shop</button>` : '');
  }

  renderShop() {
    const s = this.state;
    const bal = RewardsLogic.balance(s);
    const worn = this.worn();
    const filters = [['all', 'All'], ...Object.entries(this.data.MODULES)];
    document.getElementById('rewards-shop-filter').innerHTML = filters.map(([id, n]) => this.chip('data-rw-module', id, esc(n), id === this.shopModule)).join('');

    const order = this.data.SLOTS.map(sl => sl.id);
    const list = this.data.SHOP.filter(i => this.shopModule === 'all' || i.m === this.shopModule)
      .sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot) || a.p - b.p);
    document.getElementById('rewards-shop-grid').innerHTML = list.map(it => {
      const owned = s.own[it.id] !== undefined;
      const lockedBy = it.needs && !s.stk[it.needs];
      const badge = owned
        ? `<span class="text-[10px] font-bold text-emerald-400">${icon('check')} ${worn[it.slot]?.id === it.id ? 'wearing' : 'yours'}</span>`
        : lockedBy ? `<span class="text-[10px] font-bold text-slate-400">${icon('lock')} needs a sticker</span>`
        : `<span class="text-[11px] font-extrabold tabular-nums ${bal >= it.p ? 'text-amber-400' : 'text-slate-400'}">${coin()} ${it.p}</span>`;
      return this.tile({ attrs: `data-rw-pick="${it.id}" title="Try on: ${esc(it.n)}"`, art: RewardsArt.part(it), name: it.n, badge, on: this.tryOn === it.id });
    }).join('');

    const it = this.tryOn ? this.itemById.get(this.tryOn) : null;
    this.renderAvatarInto(document.getElementById('rewards-shop-preview'), this.worn(it));
    const detail = document.getElementById('rewards-shop-detail');
    if (!it) {
      detail.innerHTML = `<div class="text-sm font-bold text-slate-100">Try it on before you buy</div>
        <p class="text-xs text-slate-400 mt-1">Tap an item to see it on your avatar. Points come from self-tests, topic tests, definitions, problems and pomodoros.</p>
        <div class="text-xs font-bold text-amber-400 mt-2 tabular-nums">${coin()} ${points(Math.max(0, bal))} to spend</div>`;
      return;
    }
    const owned = s.own[it.id] !== undefined;
    const lockedBy = it.needs && !s.stk[it.needs] ? this.stickerById.get(it.needs) : null;
    const btn = 'inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer transition';
    let action;
    if (owned) {
      action = worn[it.slot]?.id === it.id
        ? `<span class="text-xs font-bold text-emerald-400">${icon('check')} You’re wearing it</span>`
        : `<button type="button" data-rw-wear="${it.id}" class="${btn} bg-emerald-600 hover:bg-emerald-500 text-white">${icon('shirt')} Wear it</button>`;
    } else if (lockedBy) {
      action = `<p class="text-xs text-slate-400 mb-2">${icon('lock')} Earn the “${esc(lockedBy.n)}” sticker first.</p>
        <button type="button" data-rewards-tab="stickers" data-rw-sticker="${lockedBy.id}" class="${btn} bg-slate-800 hover:bg-slate-700 text-slate-200">See the sticker ${icon('arrow-right')}</button>`;
    } else if (bal >= it.p) {
      action = `<button type="button" data-rw-buy="${it.id}" class="${btn} bg-amber-500 hover:bg-amber-600 text-slate-950">${coin()} Buy for ${it.p}</button>`;
    } else {
      const missing = it.p - Math.max(0, bal);
      action = `<p class="text-xs text-slate-400 mb-2"><strong class="text-slate-200">${points(missing)}</strong> short — a few self-tests and it’s yours.</p>
        <button type="button" data-rw-go="selftests" class="${btn} bg-indigo-600 hover:bg-indigo-500 text-white">Go to self-tests ${icon('arrow-right')}</button>`;
    }
    detail.innerHTML = `<div class="flex items-start justify-between gap-2">
        <div class="min-w-0"><div class="text-sm font-bold text-slate-100">${esc(it.n)}</div>
        <p class="text-xs text-slate-400 mt-0.5">${esc(it.d)}</p></div>
        <button type="button" data-rw-pick="" class="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer transition" title="Stop trying on" aria-label="Stop trying on">${icon('x')}</button>
      </div><div class="mt-2">${action}</div>`;
  }

  renderStickers() {
    const s = this.state;
    const ctx = this.context();
    const all = this.data.STICKERS;
    const got = all.filter(st => s.stk[st.id]);
    const hidden = all.filter(st => st.s && !s.stk[st.id]).length;
    const quiet = this.quiet;

    const groups = Object.entries(this.data.MODULES).map(([m, title]) => {
      const list = all.filter(st => st.m === m);
      if (!list.length) return '';
      return `<h4 class="flex items-baseline justify-between text-sm font-bold text-slate-200 mt-5 mb-2">${esc(title)}
          <span class="text-xs font-semibold text-slate-400 tabular-nums">${list.filter(st => s.stk[st.id]).length}/${list.length}</span></h4>
        <div class="grid grid-cols-3 sm:grid-cols-5 gap-x-2 gap-y-3">${list.map(st => {
          const has = !!s.stk[st.id];
          const secret = st.s && !has;
          const p = has || secret ? null : RewardsLogic.progress(st.rule, ctx, s);
          const isNew = has && s.stk[st.id] > this.seenBefore;
          return `<button type="button" data-rw-sticker="${st.id}" aria-pressed="${this.detail === st.id}" class="relative flex flex-col items-center gap-1 p-1.5 rounded-2xl cursor-pointer transition hover:bg-slate-800/70 ${this.detail === st.id ? 'bg-slate-800/70 ring-1 ring-indigo-500/60' : ''}" aria-label="${secret ? 'Secret sticker' : esc(st.n)}${has ? '' : ' (not earned yet)'}">
            <span class="block w-14 h-14 sm:w-16 sm:h-16 ${has ? 'rw-stuck' : 'opacity-40 grayscale'}" style="--rw-tilt:${tilt(st.id)}deg">${this.stickerSvg(st, secret)}</span>
            <span class="text-[11px] leading-tight font-semibold ${has ? 'text-slate-200' : 'text-slate-400'} line-clamp-2">${secret ? 'Secret' : esc(st.n)}</span>
            ${p && p.need > 1 ? `<span class="text-[10px] text-slate-400 tabular-nums">${Math.min(p.have, p.need)}/${p.need}</span>` : ''}
            ${isNew ? '<span class="absolute top-1 right-2 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-slate-900" title="New"></span>' : ''}
          </button>`;
        }).join('')}</div>`;
    }).join('');

    document.getElementById('rewards-stickers').innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="text-sm font-bold text-slate-100">${got.length} of ${all.length} stickers</div>
          <div class="text-xs text-slate-400">${hidden ? `${hidden} secret ${hidden === 1 ? 'one is' : 'ones are'} still waiting for the right moment` : 'All secrets found'}</div>
        </div>
        <button type="button" data-rw-quiet role="switch" aria-checked="${!quiet}" class="shrink-0 inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-slate-100 cursor-pointer transition" title="Pop-ups when you earn points or stickers">
          Notifications
          <span class="relative w-9 h-5 rounded-full transition ${quiet ? 'bg-slate-700' : 'bg-emerald-500'}"><span class="absolute top-0.5 ${quiet ? 'left-0.5' : 'left-[1.125rem]'} w-4 h-4 rounded-full bg-white shadow transition-all"></span></span>
        </button>
      </div>
      <div class="mt-2 h-1.5 rounded-full bg-slate-800 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-amber-400 to-rose-500" style="width:${Math.round((got.length / all.length) * 100)}%"></div></div>
      ${groups}
      ${this.detail ? this.stickerDetail(this.stickerById.get(this.detail), ctx) : ''}`;
  }

  stickerDetail(st, ctx) {
    if (!st) return '';
    const s = this.state;
    const has = !!s.stk[st.id];
    const secret = st.s && !has;
    const r = this.data.RARITY[st.r];
    const p = RewardsLogic.progress(st.rule, ctx, s);
    const when = has ? new Date(s.stk[st.id]).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
    return `<div class="sticky bottom-0 -mx-4 sm:-mx-6 -mb-5 mt-5 px-4 sm:px-6 py-4 bg-slate-900 border-t border-slate-700 shadow-[0_-8px_24px_rgba(15,23,42,.12)]">
      <div class="flex items-start gap-3">
        <span class="block w-16 h-16 shrink-0 ${has ? '' : 'opacity-50 grayscale'}">${this.stickerSvg(st, secret)}</span>
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span class="text-sm font-bold text-slate-100">${secret ? 'Secret sticker' : esc(st.n)}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold border border-slate-700 text-slate-300">${r.n} · +${r.pts}</span>
          </div>
          <p class="text-xs text-slate-300 mt-1">${secret ? 'You’ll learn the condition when you earn it. Just keep studying — it will find you.' : esc(st.d)}</p>
          <p class="text-[11px] text-slate-400 mt-1">${has ? `${icon('check')} Earned on ${when}` : secret ? '' : `How to get it: ${esc(this.howTo(st.rule))}${p.need > 1 ? ` · ${Math.min(p.have, p.need)}/${p.need}` : ''}`}</p>
        </div>
        <button type="button" data-rw-sticker="" class="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 cursor-pointer transition" title="Close" aria-label="Close">${icon('x')}</button>
      </div>
    </div>`;
  }

  // Human wording of a rule, for "How to get it"
  howTo(r) {
    const bank = window.SELFTEST_BANK;
    const typeTasks = types => (bank?.tasks || []).filter(t => types.includes(t.type)).map(t => t.id);
    const defName = id => window.PS_DATA?.DEFINITIONS_21.find(d => d.id === id)?.name || `#${id}`;
    const probName = id => window.PS_DATA?.PROBLEMS_BANK.find(p => String(p.id) === String(id))?.title || `problem ${id}`;
    const n = r.n;
    switch (r.k) {
      case 'st':
        if (r.ids) return `solve self-test ${r.ids.join(', ')}`;
        if (r.types) return `solve self-test ${typeTasks(r.types).join(', ')}`;
        return n === 1 ? 'solve any self-test task' : `solve ${n} self-test tasks`;
      case 'stFirst': return `${n} self-test tasks without a single miss`;
      case 'stGrind': return 'crack a task after three misses';
      case 'stt': return r.topic ? `solve 80% of the topic ${r.topic} self-tests` : `get the self-tests of ${n} topics counted`;
      case 'tt': return r.pct ? 'score 100% on a topic test' : `pass ${n} topic tests (50%+)`;
      case 'def': return r.ids ? `get “${r.ids.map(defName).join('”, “')}” to 6+` : `get ${n} definitions to 6+`;
      case 'oral': return `get ${n} oral questions to 6+`;
      case 'pr': return r.ids ? `solve ${r.ids.map(probName).join('; ')}` : `solve ${n} problems`;
      case 'pomo': return n === 1 ? 'finish one pomodoro (25 min of focus)' : `finish ${n} pomodoros`;
      case 'pomoDay': return `${n} pomodoros in one day`;
      case 'streak': return `study ${n} days in a row`;
      case 'own': return n === 1 ? 'buy something in the shop' : `own ${n} items from the shop`;
      case 'earned': return `earn ${n} points`;
      case 'stk': return `collect ${n} stickers`;
      case 'ready': return `reach ${n}% readiness`;
      case 'fix': return `fix ${n} mistakes from your mistakes list`;
      case 'all': return r.of.map(x => this.howTo(x)).join(' + ');
      default: return '';
    }
  }

  stickerSvg(st, secret = false) {
    return RewardsArt.sticker(st, { rim: this.data.RARITY[st.r]?.rim, secret });
  }

  earnedStickers() {
    const s = this.state;
    return this.data.STICKERS.filter(st => s.stk[st.id]).sort((a, b) => s.stk[b.id] - s.stk[a.id]);
  }

  currentStreak() {
    const days = this.state.days;
    const today = RewardsLogic.dayKey(Date.now());
    const yesterday = RewardsLogic.dayKey(Date.now() - 864e5);
    return RewardsLogic.streak(days, today) || RewardsLogic.streak(days, yesterday);
  }

  // --- actions ---
  onClick(e) {
    const el = e.target.closest('[data-rewards-open],[data-rewards-tab],[data-rw-slot],[data-rw-wear],[data-rw-pick],[data-rw-buy],[data-rw-sticker],[data-rw-module],[data-rw-go],[data-rw-quiet],#close-profile-modal-btn');
    if (!el) {
      if (e.target === this.modal) this.close();
      return;
    }
    const d = el.dataset;
    if (el.id === 'close-profile-modal-btn') return this.close();
    if (d.rwGo !== undefined) {
      this.close();
      window.app?.switchTab(d.rwGo);
      return;
    }
    if (d.rewardsOpen !== undefined) return this.open(d.rewardsOpen, d.rwSticker);
    if (d.rewardsTab !== undefined) {
      if (d.rwShopSlot) this.shopModule = 'all';
      return this.setTab(d.rewardsTab, d.rwSticker);
    }
    if (d.rwSlot !== undefined) { this.slot = d.rwSlot; return this.renderWardrobe(); }
    if (d.rwModule !== undefined) { this.shopModule = d.rwModule; return this.renderShop(); }
    if (d.rwPick !== undefined) { this.tryOn = d.rwPick || null; return this.renderShop(); }
    if (d.rwSticker !== undefined) {
      this.detail = d.rwSticker && d.rwSticker !== this.detail ? d.rwSticker : null;
      return this.renderStickers();
    }
    if (d.rwQuiet !== undefined) {
      try { localStorage.setItem('stathustle_rewards_quiet', this.quiet ? '0' : '1'); } catch (err) {}
      return this.renderStickers();
    }
    if (d.rwWear !== undefined) return this.wear(d.rwWear);
    if (d.rwBuy !== undefined) return this.buy(d.rwBuy);
  }

  wear(id) {
    const s = this.state;
    const item = id ? this.itemById.get(id) : null;
    const slot = item ? item.slot : this.slot;
    const worn = this.worn();
    const takeOff = item && worn[slot]?.id === item.id && slot !== 'top' && this.tab === 'avatar';
    if (!RewardsLogic.wear(s, slot, takeOff ? null : item, this.readiness, Date.now())) return;
    if (slot === 'top' && item?.tier && this.profile) this.profile.equippedOutfit = item.id; // keep the legacy field meaningful
    this.persist();
    this.render();
  }

  buy(id) {
    const s = this.state;
    const item = this.itemById.get(id);
    const res = RewardsLogic.buy(s, item);
    if (!res.ok) return this.renderShop();
    RewardsLogic.wear(s, item.slot, item, this.readiness, Date.now()); // a new thing goes straight on
    const events = RewardsLogic.evaluate(s, this.context(null), this.data);
    this.persist();
    if (!this.quiet) {
      this.toast({ art: `<span class="block w-full h-full p-0.5">${RewardsArt.part(item)}</span>`, title: `New: ${item.n}`, sub: `−${points(item.p)} · on your avatar now`, go: 'avatar' });
    }
    this.announce(events);
    this.render();
  }

  // --- feedback ---
  announce(events, catchUp = false) {
    const sum = RewardsLogic.summarize(events);
    if (!sum.total && !sum.stickers.length && !sum.unlocks.length) return;
    if (sum.total > 0) this.bump(sum.total);
    if (this.quiet) return;
    if (catchUp) {
      const n = sum.stickers.length;
      this.toast({
        art: coinArt(), go: n ? 'stickers' : 'shop',
        title: `+${points(sum.total)} for what you’ve already done`,
        sub: n ? `and ${n} sticker${n === 1 ? '' : 's'} — see the collection` : 'Have a look at the shop'
      });
      return;
    }
    if (sum.points > 0) this.toast({ art: coinArt(), title: `+${points(sum.points)}`, sub: this.reason(sum.keys), go: 'shop', ms: 3200 });
    sum.stickers.slice(0, 2).forEach(id => {
      const st = this.stickerById.get(id);
      const r = this.data.RARITY[st.r];
      this.toast({ art: `<span class="rw-pop block w-full h-full">${this.stickerSvg(st)}</span>`, title: `New sticker: ${st.n}`, sub: `${r.n} · +${points(r.pts)}`, go: 'stickers', sticker: id, ms: 5200 });
    });
    const more = sum.stickers.length - 2;
    if (more > 0) this.toast({ art: coinArt(), title: `And ${more} more sticker${more === 1 ? '' : 's'}`, sub: 'See the collection', go: 'stickers' });
    sum.unlocks.slice(0, 1).forEach(id => {
      const it = this.itemById.get(id);
      this.toast({ art: `<span class="block w-full h-full p-0.5">${RewardsArt.part(it)}</span>`, title: `Unlocked: ${it.n}`, sub: `Free at ${it.min}% readiness`, go: 'avatar', ms: 5200 });
    });
  }

  reason(keys) {
    const main = keys.find(k => !/^(day|st1|tt80|tt100):/.test(k)) || keys[0] || '';
    const [type, id] = main.split(':');
    const def = () => window.PS_DATA?.DEFINITIONS_21.find(d => String(d.id) === id)?.name;
    const prob = () => window.PS_DATA?.PROBLEMS_BANK.find(p => String(p.id) === id)?.title;
    const topic = () => window.PS_DATA?.TOPICS_LIST.find(t => String(t.id) === id)?.title;
    const base = {
      st: `Self-test ${id}`, stt: `Topic ${id} self-tests counted`, tt: topic() || `Topic test ${id}`,
      tt80: 'Topic test at 80%+', tt100: 'Topic test at 100%', def: `Definition: ${def() || id}`, oral: `Oral question ${id}`,
      pr: prob() || `Problem ${id}`, pomo: 'Pomodoro finished', day: 'Study streak'
    }[type] || 'Progress';
    const extra = [];
    if (keys.some(k => k.startsWith('st1:'))) extra.push('first try');
    if (keys.some(k => k.startsWith('day:')) && type !== 'day') extra.push(`${this.currentStreak()}-day streak`);
    return [base, ...extra].join(' · ');
  }

  toast({ art, title, sub, go, sticker, ms = 4200 }) {
    const t = document.createElement('button');
    t.type = 'button';
    t.className = 'rw-toast w-full flex items-center gap-3 p-2.5 pr-4 rounded-2xl border border-slate-700 bg-slate-900 shadow-xl text-left cursor-pointer hover:border-indigo-500 transition-colors';
    t.innerHTML = `<span class="block w-10 h-10 shrink-0">${art}</span>
      <span class="min-w-0"><span class="block text-sm font-bold text-slate-100 truncate">${esc(title)}</span>
      <span class="block text-xs text-slate-400 truncate">${esc(sub || '')}</span></span>`;
    let timer;
    const hide = () => {
      clearTimeout(timer);
      if (!t.isConnected) return;
      t.classList.add('rw-out');
      setTimeout(() => t.remove(), this.reduced ? 0 : 220);
    };
    t.addEventListener('click', () => {
      hide();
      this.open(go, sticker);
    });
    t.addEventListener('mouseenter', () => clearTimeout(timer));
    t.addEventListener('mouseleave', () => { timer = setTimeout(hide, 1500); });
    this.toastHost.appendChild(t);
    while (this.toastHost.children.length > 3) this.toastHost.firstElementChild.remove();
    timer = setTimeout(hide, ms);
  }

  // "+N" next to the balance on the dashboard
  bump(n) {
    const el = document.getElementById('rewards-plus');
    if (!el) return;
    el.textContent = `+${n}`;
    el.classList.remove('rw-float');
    void el.offsetWidth; // restart the animation
    el.classList.add('rw-float');
    clearTimeout(this.bumpTimer);
    this.bumpTimer = setTimeout(() => el.classList.remove('rw-float'), 1600);
  }

  countTo(el, value) {
    const from = Number(el.dataset.v ?? value);
    el.dataset.v = value;
    cancelAnimationFrame(this.countRaf);
    if (from === value || this.reduced) { el.textContent = value.toLocaleString('en-US'); return; }
    const t0 = performance.now();
    const step = t => {
      const k = Math.min(1, (t - t0) / 700);
      el.textContent = Math.round(from + (value - from) * (1 - (1 - k) ** 3)).toLocaleString('en-US');
      if (k < 1) this.countRaf = requestAnimationFrame(step);
    };
    this.countRaf = requestAnimationFrame(step);
  }
}

// --- small helpers ---
// "12 points" (or just "points" for a label next to a big number)
function points(n, withNumber = true) {
  const word = Math.abs(n) === 1 ? 'point' : 'points';
  return withNumber ? `${n.toLocaleString('en-US')} ${word}` : word;
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
}
function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}
function coin() {
  return `<svg viewBox="0 0 64 64" class="inline-block w-3.5 h-3.5 -mt-0.5" aria-hidden="true" style="--a:#fbbf24;--b:#b45309">${RewardsArt.glyph('coin')}</svg>`;
}
function coinArt() {
  return `<svg viewBox="0 0 64 64" class="rw-pop w-full h-full" aria-hidden="true" style="--a:#fbbf24;--b:#b45309">${RewardsArt.glyph('coins')}</svg>`;
}
// A stable little tilt per sticker, so the collection looks stuck on by hand
function tilt(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 11) - 5;
}

window.rewards = new RewardsUI(window.REWARDS_DATA, typeof WARDROBE_ITEMS !== 'undefined' ? WARDROBE_ITEMS : []);
})();
