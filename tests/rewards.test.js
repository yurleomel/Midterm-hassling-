// Run with: node --test tests/*.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { RewardsLogic: R } = require('../js/rewards.js');
const { REWARDS_DATA: D } = require('../js/rewards-data.js');
const { RewardsArt: Art } = require('../js/rewards-art.js');
const { SELFTEST_BANK } = require('../js/selftest-data.js');

global.window = global.window || {};
require('../js/data.js');
const PS = global.window.PS_DATA;

const P = D.POINTS;
const at = (d, h = 12, m = 0) => new Date(2026, 9, d, h, m).getTime(); // 2026-10-<d>, local time
const tasks = SELFTEST_BANK.tasks.map(t => ({ id: t.id, topic: t.topic, type: t.type, difficulty: t.difficulty }));
const task = id => tasks.find(t => t.id === id);
const tiers = [{ id: 'freshman_tee', min: 0 }, { id: 'ucu_hoodie', min: 35 }, { id: 'champion_crown', min: 100 }];

// A learning context like the one js/rewards-ui.js builds from the readiness state
function ctx(over = {}) {
  return {
    stats: {}, tasks, stPassed: [], tests: {}, defs: {}, defIds: PS.DEFINITIONS_21.map(d => d.id), probs: {}, mocks: [],
    readiness: 0, tiers, now: at(15), action: null, ...over
  };
}
const live = (kind, now, extra = {}) => ({ kind, productive: true, hour: new Date(now).getHours(), dow: new Date(now).getDay(), ...extra });
const ptsOf = (events, prefix) => events.filter(e => e.t === 'pts' && e.key.startsWith(prefix)).reduce((a, e) => a + e.n, 0);

// --- points rules ---

test('a solved self-test task pays by difficulty, plus a bonus only for a first-attempt solve', () => {
  const s = R.empty();
  const easy = tasks.find(t => t.difficulty === 'easy');
  const hard = tasks.find(t => t.difficulty === 'hard');
  const ev = R.evaluate(s, ctx({ stats: {
    [easy.id]: { attempts: 1, correct: 1, solved: true },
    [hard.id]: { attempts: 3, correct: 1, solved: true }
  } }), D);
  assert.equal(s.pts['st:' + easy.id], P.st.easy);
  assert.equal(s.pts['st1:' + easy.id], P.stFirstTry);
  assert.equal(s.pts['st:' + hard.id], P.st.hard);
  assert.equal(s.pts['st1:' + hard.id], undefined);
  assert.equal(ptsOf(ev, 'st:') + ptsOf(ev, 'st1:'), P.st.easy + P.stFirstTry + P.st.hard);
});

test('wrong answers and unsolved tasks pay nothing', () => {
  const s = R.empty();
  R.evaluate(s, ctx({ stats: { [tasks[0].id]: { attempts: 4, correct: 0, solved: false } } }), D);
  assert.equal(R.earned(s), 0);
});

test('topic tests, definitions, oral questions, problems and self-test topics pay their own rates', () => {
  const s = R.empty();
  R.evaluate(s, ctx({
    tests: { 4: { solved: true, score: 50, total: 50 }, 5: { solved: true, score: 30, total: 50 }, 6: { solved: false, score: 10, total: 50 } },
    defs: { 6: 8, 7: 5, oral_3: 6 },
    probs: { 12: true, 14: false },
    stPassed: [4]
  }), D);
  assert.equal(s.pts['tt:4'], P.topicTest);
  assert.equal(s.pts['tt80:4'], P.topicTest80);
  assert.equal(s.pts['tt100:4'], P.topicTest100);
  assert.equal(s.pts['tt:5'], P.topicTest);
  assert.equal(s.pts['tt80:5'], undefined);
  assert.equal(s.pts['tt:6'], undefined);
  assert.equal(s.pts['def:6'], P.definition);
  assert.equal(s.pts['def:7'], undefined, 'a definition below 6/10 does not pay');
  assert.equal(s.pts['oral:3'], P.oral);
  assert.equal(s.pts['pr:12'], P.problem);
  assert.equal(s.pts['pr:14'], undefined);
  assert.equal(s.pts['stt:4'], P.selfTestTopic);
});

test('idempotent: re-evaluating or re-solving the same things never pays twice', () => {
  const s = R.empty();
  const id = tasks[0].id;
  const c1 = ctx({ stats: { [id]: { attempts: 1, correct: 1, solved: true } }, defs: { 1: 8 }, probs: { 7: true } });
  R.evaluate(s, c1, D);
  const before = R.earned(s);
  assert.deepEqual(R.evaluate(s, c1, D), []);
  // solving it again later (more attempts) and grading the definition higher changes nothing
  R.evaluate(s, ctx({ stats: { [id]: { attempts: 3, correct: 3, solved: true } }, defs: { 1: 10 }, probs: { 7: true } }), D);
  assert.equal(R.earned(s), before);
});

test('a saved mock midterm pays once per attempt and earns Dress Rehearsal', () => {
  const s = R.empty();
  assert.deepEqual(R.progress(D.STICKERS.find(st => st.id === 'm2_rehearsal').rule, ctx(), s), { have: 0, need: 1 });
  const ev = R.evaluate(s, ctx({ mocks: ['mm-a'], now: at(15), action: live('mock', at(15)) }), D);
  assert.equal(s.pts['mock:mm-a'], P.mock);
  assert.ok(s.stk.m2_rehearsal, 'the first finished mock earns the sticker');
  assert.ok(ev.some(e => e.t === 'stk' && e.id === 'm2_rehearsal'));
  const before = R.earned(s);
  assert.deepEqual(R.evaluate(s, ctx({ mocks: ['mm-a'] }), D), [], 'the same attempt never pays twice');
  R.evaluate(s, ctx({ mocks: ['mm-a', 'mm-b'] }), D);
  assert.equal(R.earned(s), before + P.mock, 'a second attempt pays again');
});

test('pomodoro: every session is kept, only the first N a day pay', () => {
  const s = R.empty();
  for (let i = 0; i < P.pomodoroDailyCap + 2; i++) {
    R.evaluate(s, ctx({ now: at(15, 8 + i), action: live('pomodoro', at(15, 8 + i)) }), D);
  }
  assert.equal(ptsOf(Object.entries(s.pts).map(([key, n]) => ({ t: 'pts', key, n })), 'pomo:'), P.pomodoro * P.pomodoroDailyCap);
  assert.deepEqual(R.pomodoros(s), { total: P.pomodoroDailyCap + 2, bestDay: P.pomodoroDailyCap + 2 });
  R.evaluate(s, ctx({ now: at(16, 9), action: live('pomodoro', at(16, 9)) }), D);
  assert.equal(s.pts['pomo:2026-10-16T0900'], P.pomodoro, 'the cap resets the next day');
});

test('streak bonus: grows by day, paid once per day, capped', () => {
  const s = R.empty();
  const bonus = [];
  for (let d = 10; d <= 16; d++) {
    R.evaluate(s, ctx({ now: at(d), action: live('selftest', at(d)) }), D);
    R.evaluate(s, ctx({ now: at(d, 13), action: live('selftest', at(d, 13)) }), D); // second action the same day
    bonus.push(s.pts['day:' + R.dayKey(at(d))] || 0);
  }
  assert.deepEqual(bonus, [0, 5, 10, 15, 20, 20, 20]);
  assert.equal(R.streak(s.days, R.dayKey(at(16))), 7);
});

test('a non-productive action (wrong answer) neither marks the day nor pays a streak', () => {
  const s = R.empty();
  R.evaluate(s, ctx({ now: at(15), action: { kind: 'selftest', productive: false, hour: 12, dow: 4 } }), D);
  assert.deepEqual(s.days, []);
});

// --- stickers ---

test('stickers unlock from progress and pay by rarity', () => {
  const s = R.empty();
  const ev = R.evaluate(s, ctx({ stats: { 'ST6-15': { attempts: 1, correct: 1, solved: true } } }), D);
  const ids = ev.filter(e => e.t === 'stk').map(e => e.id);
  assert.ok(ids.includes('m2_bernoulli'), 'first solved task');
  assert.ok(ids.includes('m2_memoryless'), 'the memorylessness task');
  assert.equal(s.pts['stk:m2_memoryless'], D.RARITY.rare.pts);
  assert.equal(s.pts['stk:m2_bernoulli'], D.RARITY.common.pts);
});

test('combined rules need every part: Poisson needs the task and the definition', () => {
  const s = R.empty();
  R.evaluate(s, ctx({ stats: { 'ST4-22': { attempts: 1, correct: 1, solved: true } } }), D);
  assert.equal(s.stk.m2_poisson, undefined);
  const rule = D.STICKERS.find(st => st.id === 'm2_poisson').rule;
  assert.deepEqual(R.progress(rule, ctx({ stats: { 'ST4-22': { attempts: 1, correct: 1, solved: true } } }), s), { have: 1, need: 2 });
  R.evaluate(s, ctx({ stats: { 'ST4-22': { attempts: 1, correct: 1, solved: true } }, defs: { 6: 8 } }), D);
  assert.ok(s.stk.m2_poisson);
});

test('type rules cover every task of the type: all normal-distribution tasks for 68·95·99.7', () => {
  const normal = tasks.filter(t => t.type === 'normal-phi' || t.type === 'normal-linear');
  const stats = Object.fromEntries(normal.slice(1).map(t => [t.id, { attempts: 1, correct: 1, solved: true }]));
  const s = R.empty();
  R.evaluate(s, ctx({ stats }), D);
  assert.equal(s.stk.m2_sigma, undefined);
  stats[normal[0].id] = { attempts: 2, correct: 1, solved: true };
  R.evaluate(s, ctx({ stats }), D);
  assert.ok(s.stk.m2_sigma);
});

test('time-of-day and comeback stickers need a live productive action, never a silent catch-up', () => {
  const night = at(15, 3);
  const s = R.empty();
  R.evaluate(s, ctx({ now: night }), D);
  assert.equal(s.stk.g_owl, undefined);
  R.evaluate(s, ctx({ now: night, action: { ...live('selftest', night), productive: false } }), D);
  assert.equal(s.stk.g_owl, undefined, 'a wrong answer at night does not count');
  R.evaluate(s, ctx({ now: night, action: live('selftest', night) }), D);
  assert.ok(s.stk.g_owl);

  const t = R.empty();
  R.evaluate(t, ctx({ now: at(10), action: live('definition', at(10)) }), D);
  R.evaluate(t, ctx({ now: at(12), action: live('definition', at(12)) }), D);
  assert.equal(t.stk.g_comeback, undefined, 'a 2-day gap is not a comeback');
  R.evaluate(t, ctx({ now: at(15), action: live('definition', at(15)) }), D);
  assert.ok(t.stk.g_comeback);
});

test('stickers chain within one evaluation (collector counts the ones just earned)', () => {
  const s = R.empty();
  for (let i = 0; i < 14; i++) s.stk['fake' + i] = 1;
  R.evaluate(s, ctx({ stats: { 'ST4-01': { attempts: 1, correct: 1, solved: true } } }), D);
  assert.ok(s.stk.m2_bernoulli);
  assert.ok(s.stk.g_collector, '14 + Bernoulli Start = 15');
});

test('readiness tiers are announced once when the threshold is crossed', () => {
  const s = R.empty();
  assert.deepEqual(R.evaluate(s, ctx({ readiness: 20 }), D).filter(e => e.t === 'unlock'), []);
  assert.deepEqual(R.evaluate(s, ctx({ readiness: 40 }), D).filter(e => e.t === 'unlock').map(e => e.id), ['ucu_hoodie']);
  assert.deepEqual(R.evaluate(s, ctx({ readiness: 40 }), D).filter(e => e.t === 'unlock'), []);
});

// --- shop & wardrobe ---

const shopItem = id => D.SHOP.find(i => i.id === id);

test('buying: insufficient points, success, already owned', () => {
  const s = R.empty();
  const tee = shopItem('g_tee_mint');
  s.pts.x = tee.p - 1;
  assert.deepEqual(R.buy(s, tee), { ok: false, error: 'insufficient', missing: 1 });
  s.pts.y = 1;
  assert.deepEqual(R.buy(s, tee), { ok: true });
  assert.equal(R.balance(s), 0);
  assert.equal(R.buy(s, tee).error, 'owned');
  assert.equal(R.balance(s), 0, 'a refused purchase costs nothing');
});

test('buying: sticker-locked items, free tiers and unknown items are refused', () => {
  const s = R.empty();
  s.pts.x = 10000;
  assert.equal(R.buy(s, shopItem('m2_fish')).error, 'locked');
  s.stk.m2_poisson = 1;
  assert.ok(R.buy(s, shopItem('m2_fish')).ok);
  assert.equal(R.buy(s, { id: 'freshman_tee', tier: true, min: 0 }).error, 'free');
  assert.equal(R.buy(s, undefined).error, 'unknown');
});

test('the first purchase earns its sticker on the next evaluation', () => {
  const s = R.empty();
  s.pts.x = 500;
  R.buy(s, shopItem('m2_die'));
  const ev = R.evaluate(s, ctx(), D);
  assert.ok(ev.some(e => e.t === 'stk' && e.id === 'g_shop1'));
});

test('wearing needs ownership (shop) or readiness (tiers); worn() falls back to the legacy outfit', () => {
  const items = R.catalog(D, [
    { id: 'freshman_tee', minReadiness: 0, name: 'T', description: '' },
    { id: 'ucu_hoodie', minReadiness: 35, name: 'H', description: '' },
    { id: 'focus_cap', minReadiness: 15, name: 'C', description: '' }
  ]);
  const byId = id => items.find(i => i.id === id);
  const s = R.empty();
  assert.equal(R.wear(s, 'top', byId('m2_hoodie_exp'), 100, 1), false, 'not bought yet');
  assert.equal(R.wear(s, 'top', byId('ucu_hoodie'), 20, 1), false, 'below the threshold');
  assert.equal(R.wear(s, 'hat', byId('ucu_hoodie'), 100, 1), false, 'wrong slot');
  // legacy single outfit is honoured until the slot is set
  assert.equal(R.worn(s, items, 'focus_cap').hat.id, 'focus_cap');
  assert.equal(R.worn(s, items, 'focus_cap').top.id, 'freshman_tee');
  assert.ok(R.wear(s, 'top', byId('ucu_hoodie'), 40, 2));
  assert.ok(R.wear(s, 'hat', null, 40, 3));
  const w = R.worn(s, items, 'focus_cap');
  assert.equal(w.top.id, 'ucu_hoodie');
  assert.equal(w.hat, null, 'taking the hat off beats the legacy outfit');
});

// --- merge ---

test('merge: no double counting, no lost purchases, stickers keep the first date', () => {
  const a = R.empty(), b = R.empty();
  a.pts = { 'st:ST4-01': 3, 'def:6': 8 };
  b.pts = { 'st:ST4-01': 3, 'pr:12': 15 };
  a.own = { g_tee_mint: 60 };
  b.own = { m2_die: 90 };
  a.stk = { m2_bernoulli: 200 };
  b.stk = { m2_bernoulli: 100, g_pomo1: 300 };
  a.days = ['2026-10-14', '2026-10-15'];
  b.days = ['2026-10-15', '2026-10-16'];
  a.eq = { top: 'g_tee_mint' }; a.eqAt = 5;
  b.eq = { top: 'ucu_hoodie' }; b.eqAt = 9;
  a.n = { fix: 2 }; b.n = { fix: 4 };
  a.rmax = 40; b.rmax = 20;
  const m = R.merge(a, b);
  assert.equal(R.earned(m), 3 + 8 + 15, 'the shared award counts once');
  assert.deepEqual(m.own, { g_tee_mint: 60, m2_die: 90 });
  assert.deepEqual(m.stk, { m2_bernoulli: 100, g_pomo1: 300 });
  assert.deepEqual(m.days, ['2026-10-14', '2026-10-15', '2026-10-16']);
  assert.equal(m.eq.top, 'ucu_hoodie', 'the latest outfit change wins');
  assert.equal(m.n.fix, 4);
  assert.equal(m.rmax, 40);
  assert.deepEqual(R.merge(m, m), m, 'merging with itself changes nothing');
  assert.deepEqual(R.merge(b, a).pts, m.pts, 'order does not matter for points');
});

test('merge and normalize survive missing or damaged data', () => {
  const s = R.empty();
  s.pts.x = 5;
  assert.deepEqual(R.merge(s, undefined), s);
  assert.deepEqual(R.merge(undefined, s), s);
  assert.deepEqual(R.merge(undefined, undefined), R.empty());
  const n = R.normalize({ pts: { a: 1, b: 'x', c: null }, own: [], days: ['2026-10-15', 'nope', '2026-10-15'], eq: { top: 5, hat: 'h' } });
  assert.deepEqual(n.pts, { a: 1 });
  assert.deepEqual(n.own, {});
  assert.deepEqual(n.days, ['2026-10-15']);
  assert.deepEqual(n.eq, { hat: 'h' });
});

// --- catalog integrity: a typo in rewards-data.js should fail here, not silently in the UI ---

test('catalog: unique ids, known rarities, rule kinds and art', () => {
  const ids = [...D.STICKERS.map(s => s.id), ...D.SHOP.map(i => i.id), ...Object.keys(D.TIERS)];
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  const ruleKinds = new Set(['st', 'stFirst', 'stGrind', 'stt', 'tt', 'def', 'oral', 'pr', 'mock', 'pomo', 'pomoDay', 'streak',
    'own', 'earned', 'stk', 'ready', 'fix', 'hour', 'weekend', 'gap', 'all']);
  const rules = r => (r.k === 'all' ? r.of.flatMap(rules) : [r]);
  for (const st of D.STICKERS) {
    assert.ok(D.RARITY[st.r], `${st.id}: rarity`);
    assert.ok(D.MODULES[st.m], `${st.id}: module`);
    assert.ok(st.a.startsWith('T:') || Art.GLYPHS[st.a], `${st.id}: glyph ${st.a}`);
    for (const r of rules(st.rule)) assert.ok(ruleKinds.has(r.k), `${st.id}: rule ${r.k}`);
  }
  const shapes = { top: Art.TOPS, hat: Art.HATS, face: Art.FACES, prop: Art.GLYPHS, bg: Art.BGS };
  for (const it of [...D.SHOP, ...Object.values(D.TIERS)]) {
    assert.ok(shapes[it.slot] && shapes[it.slot][it.art], `${it.n}: art ${it.slot}/${it.art}`);
  }
  for (const it of D.SHOP) {
    assert.ok(D.MODULES[it.m] && it.p > 0, `${it.id}: module and price`);
    if (it.needs) assert.ok(D.STICKERS.some(s => s.id === it.needs), `${it.id}: needs ${it.needs}`);
  }
});

test('catalog: sticker rules point at tasks, types, definitions and problems that exist', () => {
  const taskIds = new Set(tasks.map(t => t.id));
  const types = new Set(tasks.map(t => t.type));
  const defIds = new Set(PS.DEFINITIONS_21.map(d => d.id));
  const probIds = new Set(PS.PROBLEMS_BANK.map(p => p.id));
  const rules = r => (r.k === 'all' ? r.of.flatMap(rules) : [r]);
  for (const st of D.STICKERS) {
    for (const r of rules(st.rule)) {
      if (r.k === 'st') (r.ids || []).forEach(id => assert.ok(taskIds.has(id), `${st.id}: task ${id}`));
      if (r.k === 'st') (r.types || []).forEach(t => assert.ok(types.has(t), `${st.id}: type ${t}`));
      if (r.k === 'def') (r.ids || []).forEach(id => assert.ok(defIds.has(id), `${st.id}: definition ${id}`));
      if (r.k === 'pr') (r.ids || []).forEach(id => assert.ok(probIds.has(id), `${st.id}: problem ${id}`));
      if (r.k === 'stt' && r.topic) assert.ok(SELFTEST_BANK.topics.some(t => t.id === r.topic), `${st.id}: topic ${r.topic}`);
    }
  }
});

test('every sticker and item renders as a small inline SVG with no external references', () => {
  const items = R.catalog(D, []);
  const svgs = [
    ...D.STICKERS.map(st => Art.sticker(st, { rim: D.RARITY[st.r].rim })),
    Art.sticker(D.STICKERS[0], { secret: true }),
    ...items.map(it => Art.part(it)),
    Art.avatar({ top: items.find(i => i.id === 'm2_hoodie_exp'), hat: items.find(i => i.id === 'g_wizard_hat') })
  ];
  for (const svg of svgs) {
    assert.match(svg, /^<svg [^>]*viewBox="[^"]+"/);
    assert.ok(svg.endsWith('</svg>'));
    assert.doesNotMatch(svg, /href|url\(|<image|undefined|NaN/);
    assert.ok(svg.length < 4000, `svg too big: ${svg.length}`);
  }
});

test('size budget: rewards data + art stay well under 40 KB', () => {
  const size = f => fs.statSync(path.join(__dirname, '..', 'js', f)).size;
  assert.ok(size('rewards-data.js') + size('rewards-art.js') < 40 * 1024);
});
