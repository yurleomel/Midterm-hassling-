// ========================================================
// Rewards logic: points, stickers, shop purchases, wardrobe and the
// local ⇄ cloud merge. DOM-free so it runs under `node --test`.
// Catalog: js/rewards-data.js · Art: js/rewards-art.js · UI and hooks: js/rewards-ui.js
//
// State = profile.rewards (synced with the cloud, so only ids and numbers):
//   pts:  { awardKey: points }   every award exactly once → repeating an action never pays twice
//   own:  { itemId: pricePaid }  purchases;  balance = sum(pts) − sum(own)
//   stk:  { stickerId: firstEarnedAt }
//   days: ['YYYY-MM-DD', …]      active study days (last 60), for streaks
//   n:    { fix: count }         counters
//   eq:   { slot: itemId|null }, eqAt   what the avatar wears (latest change wins on merge)
//   rmax: highest readiness % already announced · seen: last visit of the sticker collection
// ========================================================

const RewardsLogic = {
  DAYS_KEPT: 60,
  SLOTS: ['bg', 'top', 'hat', 'face', 'prop'],

  empty() {
    return { v: 1, pts: {}, own: {}, stk: {}, days: [], n: {}, eq: {}, eqAt: 0, rmax: 0, seen: 0 };
  },

  // Anything (missing, old or damaged cloud data) → a well-formed state
  normalize(s) {
    if (!s || typeof s !== 'object') return this.empty();
    const obj = o => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    const nums = o => Object.fromEntries(Object.entries(obj(o)).filter(([, v]) => Number.isFinite(v)));
    const days = Array.isArray(s.days) ? s.days.filter(d => /^\d{4}-\d\d-\d\d$/.test(d)) : [];
    return {
      v: 1,
      pts: nums(s.pts),
      own: nums(s.own),
      stk: nums(s.stk),
      days: [...new Set(days)].sort().slice(-this.DAYS_KEPT),
      n: nums(s.n),
      eq: Object.fromEntries(Object.entries(obj(s.eq)).filter(([, v]) => v === null || typeof v === 'string')),
      eqAt: Number(s.eqAt) || 0,
      rmax: Number(s.rmax) || 0,
      seen: Number(s.seen) || 0
    };
  },

  earned(s) { return Object.values(s.pts).reduce((a, b) => a + b, 0); },
  spent(s) { return Object.values(s.own).reduce((a, b) => a + b, 0); },
  balance(s) { return this.earned(s) - this.spent(s); },

  // The only way points are added: once per key
  award(s, key, n, events) {
    if (key in s.pts) return false;
    s.pts[key] = n;
    events.push({ t: 'pts', key, n });
    return true;
  },

  // --- calendar helpers (local dates, so "a day" is the student's day) ---
  dayKey(t) {
    const d = new Date(t);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  },
  dayNum(key) {
    const [y, m, d] = key.split('-').map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 864e5);
  },
  streak(days, today) {
    const set = new Set(days.map(d => this.dayNum(d)));
    let n = 0;
    for (let d = this.dayNum(today); set.has(d); d--) n++;
    return n;
  },
  bestStreak(days) {
    let best = 0, run = 0, prev = null;
    for (const d of [...new Set(days)].sort()) {
      const n = this.dayNum(d);
      run = prev !== null && n === prev + 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = n;
    }
    return best;
  },
  pomodoros(s) {
    const perDay = {};
    for (const k of Object.keys(s.pts)) {
      if (k.startsWith('pomo:')) perDay[k.slice(5, 15)] = (perDay[k.slice(5, 15)] || 0) + 1;
    }
    const counts = Object.values(perDay);
    return { total: counts.reduce((a, b) => a + b, 0), bestDay: Math.max(0, ...counts) };
  },

  // A productive action now: remember the day and pay the streak bonus once per day.
  // Returns { gap: days since the previous active day, streak }
  recordActivity(s, now, events, P) {
    const today = this.dayKey(now);
    const prev = s.days.filter(d => d < today).pop();
    const gap = prev ? this.dayNum(today) - this.dayNum(prev) : 0;
    if (!s.days.includes(today)) s.days = [...s.days, today].sort().slice(-this.DAYS_KEPT);
    const streak = this.streak(s.days, today);
    if (streak >= 2) this.award(s, 'day:' + today, Math.min(P.streakStep * (streak - 1), P.streakMax), events);
    return { gap, streak };
  },

  // Every finished focus session is kept (key = its minute); only the first N a day pay points
  recordPomodoro(s, now, events, P) {
    const day = this.dayKey(now);
    const d = new Date(now);
    const key = `pomo:${day}T${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const today = Object.keys(s.pts).filter(k => k.startsWith('pomo:' + day)).length;
    this.award(s, key, today < P.pomodoroDailyCap ? P.pomodoro : 0, events);
  },

  // Points for learning progress, read from the readiness state (so they are idempotent by construction)
  awardProgress(s, ctx, events, P) {
    const stats = ctx.stats || {};
    for (const t of ctx.tasks || []) {
      const st = stats[t.id];
      if (!st || !st.solved) continue;
      if (this.award(s, 'st:' + t.id, P.st[t.difficulty] || P.st.easy, events) && st.attempts === 1) {
        this.award(s, 'st1:' + t.id, P.stFirstTry, events);
      }
    }
    for (const topic of ctx.stPassed || []) this.award(s, 'stt:' + topic, P.selfTestTopic, events);
    for (const [id, t] of Object.entries(ctx.tests || {})) {
      if (!t || !t.solved) continue;
      this.award(s, 'tt:' + id, P.topicTest, events);
      const share = (t.score || 0) / (t.total || 50);
      if (share >= 0.8) this.award(s, 'tt80:' + id, P.topicTest80, events);
      if (share >= 1) this.award(s, 'tt100:' + id, P.topicTest100, events);
    }
    const defIds = new Set((ctx.defIds || []).map(String));
    for (const [id, score] of Object.entries(ctx.defs || {})) {
      if (!(score >= 6)) continue;
      if (defIds.has(id)) this.award(s, 'def:' + id, P.definition, events);
      else if (id.startsWith('oral_')) this.award(s, 'oral:' + id.slice(5), P.oral, events);
    }
    for (const [id, ok] of Object.entries(ctx.probs || {})) {
      if (ok) this.award(s, 'pr:' + id, P.problem, events);
    }
    for (const id of ctx.mocks || []) this.award(s, 'mock:' + id, P.mock || 0, events); // a saved mock midterm attempt
  },

  // How far a sticker rule is: { have, need } (done when have >= need) — also drives "7/10" in the UI
  progress(rule, ctx, s) {
    const stats = ctx.stats || {};
    const tasks = ctx.tasks || [];
    const solved = id => !!(stats[id] && stats[id].solved);
    const count = (list, pred) => list.filter(pred).length;
    const flag = ok => ({ have: ok ? 1 : 0, need: 1 });
    const a = ctx.action;
    switch (rule.k) {
      case 'st': {
        const ids = rule.ids || (rule.types ? tasks.filter(t => rule.types.includes(t.type)).map(t => t.id) : null);
        return ids ? { have: count(ids, solved), need: ids.length } : { have: count(tasks, t => solved(t.id)), need: rule.n };
      }
      case 'stFirst': return { have: count(Object.values(stats), x => x.solved && x.correct === x.attempts), need: rule.n };
      case 'stGrind': return flag(Object.values(stats).some(x => x.solved && x.attempts - x.correct >= rule.n));
      case 'stt': return rule.topic
        ? flag((ctx.stPassed || []).includes(rule.topic))
        : { have: (ctx.stPassed || []).length, need: rule.n };
      case 'tt': {
        const passed = Object.values(ctx.tests || {}).filter(t => t && t.solved);
        return rule.pct
          ? flag(passed.some(t => (t.score || 0) >= (t.total || 50) * rule.pct / 100))
          : { have: passed.length, need: rule.n };
      }
      case 'def': {
        const ok = id => ((ctx.defs || {})[id] || 0) >= 6;
        return rule.ids ? { have: count(rule.ids, ok), need: rule.ids.length } : { have: count(ctx.defIds || [], ok), need: rule.n };
      }
      case 'oral': return { have: count(Object.entries(ctx.defs || {}), ([k, v]) => k.startsWith('oral_') && v >= 6), need: rule.n };
      case 'pr': {
        const probs = ctx.probs || {};
        return rule.ids ? { have: count(rule.ids, id => !!probs[id]), need: rule.ids.length } : { have: count(Object.values(probs), Boolean), need: rule.n };
      }
      case 'mock': return { have: (ctx.mocks || []).length, need: rule.n };
      case 'pomo': return { have: this.pomodoros(s).total, need: rule.n };
      case 'pomoDay': return { have: this.pomodoros(s).bestDay, need: rule.n };
      case 'streak': return { have: this.bestStreak(s.days), need: rule.n };
      case 'own': return { have: Object.keys(s.own).length, need: rule.n };
      case 'earned': return { have: this.earned(s), need: rule.n };
      case 'stk': return { have: Object.keys(s.stk).length, need: rule.n };
      case 'ready': return { have: ctx.readiness || 0, need: rule.n };
      case 'fix': return { have: s.n.fix || 0, need: rule.n };
      // Moments: only a productive action happening right now counts
      case 'hour': return flag(a && a.productive && a.hour >= rule.from && a.hour < rule.to);
      case 'weekend': return flag(a && a.productive && (a.dow === 0 || a.dow === 6));
      case 'gap': return flag(a && a.productive && a.gap >= rule.n);
      case 'all': {
        const parts = rule.of.map(r => this.progress(r, ctx, s));
        return { have: count(parts, p => p.have >= p.need), need: parts.length };
      }
      default: return { have: 0, need: 1 };
    }
  },

  // Brings the state up to date and returns what was newly earned: [{t:'pts',key,n} | {t:'stk',id} | {t:'unlock',id}]
  // ctx: { stats, tasks, stPassed, tests, defs, defIds, probs, mocks:[attempt ids], readiness, tiers:[{id,min}], now,
  //        action: { kind, productive, hour, dow } for a live action, null for a silent catch-up }
  evaluate(s, ctx, data) {
    const P = data.POINTS;
    const events = [];
    let c = ctx;
    if (ctx.action) {
      if (ctx.action.kind === 'pomodoro') this.recordPomodoro(s, ctx.now, events, P);
      if (ctx.action.kind === 'fix') s.n.fix = (s.n.fix || 0) + 1;
      if (ctx.action.productive) c = { ...ctx, action: { ...ctx.action, ...this.recordActivity(s, ctx.now, events, P) } };
    }
    this.awardProgress(s, c, events, P);

    // Stickers can unlock each other (collector, points milestones): repeat until nothing changes
    for (let pass = 0; pass < 5; pass++) {
      let changed = false;
      for (const st of data.STICKERS) {
        if (s.stk[st.id]) continue;
        const p = this.progress(st.rule, c, s);
        if (p.have < p.need) continue;
        s.stk[st.id] = c.now;
        events.push({ t: 'stk', id: st.id });
        this.award(s, 'stk:' + st.id, (data.RARITY[st.r] || {}).pts || 0, events);
        changed = true;
      }
      if (!changed) break;
    }

    // Readiness tiers (free wardrobe items): announce each threshold once
    const ready = c.readiness || 0;
    if (ready > s.rmax) {
      for (const t of c.tiers || []) if (t.min > s.rmax && t.min <= ready) events.push({ t: 'unlock', id: t.id });
      s.rmax = ready;
    }
    return events;
  },

  // events → what a toast needs
  summarize(events) {
    const pts = events.filter(e => e.t === 'pts');
    return {
      points: pts.filter(e => !e.key.startsWith('stk:')).reduce((a, e) => a + e.n, 0),
      total: pts.reduce((a, e) => a + e.n, 0),
      keys: pts.filter(e => !e.key.startsWith('stk:')).map(e => e.key),
      stickers: events.filter(e => e.t === 'stk').map(e => e.id),
      unlocks: events.filter(e => e.t === 'unlock').map(e => e.id)
    };
  },

  // --- shop & wardrobe ---
  // → { ok } or { ok: false, error: 'unknown' | 'free' | 'owned' | 'locked' | 'insufficient', missing }
  buy(s, item) {
    if (!item) return { ok: false, error: 'unknown' };
    if (!item.p) return { ok: false, error: 'free' };
    if (s.own[item.id] !== undefined) return { ok: false, error: 'owned' };
    if (item.needs && !s.stk[item.needs]) return { ok: false, error: 'locked' };
    const bal = this.balance(s);
    if (bal < item.p) return { ok: false, error: 'insufficient', missing: item.p - bal };
    s.own[item.id] = item.p;
    return { ok: true };
  },

  canWear(s, item, readiness = 0) {
    if (!item) return false;
    return item.tier ? readiness >= item.min : s.own[item.id] !== undefined;
  },

  // Put an item on (or take a slot off with item = null); false when it is not yours yet
  wear(s, slot, item, readiness, now) {
    if (item && (item.slot !== slot || !this.canWear(s, item, readiness))) return false;
    s.eq = { ...s.eq, [slot]: item ? item.id : null };
    s.eqAt = now;
    return true;
  },

  // What the avatar wears, resolved against the catalog. Until something is equipped the
  // legacy single outfit (profile.equippedOutfit) or the default tee is worn.
  worn(s, items, legacyOutfit, defaultTop = 'freshman_tee') {
    const byId = id => items.find(i => i.id === id) || null;
    const out = {};
    for (const slot of this.SLOTS) out[slot] = s.eq[slot] ? byId(s.eq[slot]) : null;
    const legacy = byId(legacyOutfit);
    if (legacy && !(legacy.slot in s.eq)) out[legacy.slot] = legacy;
    if (!('top' in s.eq) && !out.top) out.top = byId(defaultTop);
    return out;
  },

  // Shop items + readiness tiers (WARDROBE_ITEMS from js/user.js) as one list
  catalog(data, wardrobe = []) {
    const tiers = wardrobe.map(w => {
      const art = data.TIERS[w.id];
      const base = { id: w.id, tier: true, min: w.minReadiness || 0, m: 'general' };
      return art
        ? { ...art, ...base, n: art.n || w.name, d: art.d || w.description }
        : { ...base, n: w.name, d: w.description, slot: 'top', legacy: () => w.renderSvg(w.color) };
    });
    return [...tiers, ...data.SHOP];
  },

  // Local ⇄ cloud: union everything, never lose points, purchases or stickers, never count twice
  merge(a, b) {
    const x = this.normalize(a), y = this.normalize(b);
    if (!a) return y;
    if (!b) return x;
    const pick = (p, q, fn) => {
      const o = { ...p };
      for (const [k, v] of Object.entries(q)) o[k] = k in o ? fn(o[k], v) : v;
      return o;
    };
    const newer = y.eqAt > x.eqAt ? y : x;
    return {
      v: 1,
      pts: pick(x.pts, y.pts, Math.max),
      own: pick(x.own, y.own, Math.max),
      stk: pick(x.stk, y.stk, Math.min),
      days: [...new Set([...x.days, ...y.days])].sort().slice(-this.DAYS_KEPT),
      n: pick(x.n, y.n, Math.max),
      eq: { ...newer.eq },
      eqAt: newer.eqAt,
      rmax: Math.max(x.rmax, y.rmax),
      seen: Math.max(x.seen, y.seen)
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RewardsLogic };
} else {
  window.RewardsLogic = RewardsLogic;
}
