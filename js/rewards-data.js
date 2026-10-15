// ========================================================
// Rewards catalog: points rules, stickers, shop items and the art of the readiness
// wardrobe tiers. Data only — logic lives in js/rewards.js, art in js/rewards-art.js.
// To add module 3: add stickers / items with m: 'm3' and a MODULES entry. No code changes.
//
// Sticker: { id, m: module, r: rarity, n: name, d: one-liner, a: glyph (or 'T:text'), h: hue,
//            l?: corner label, s?: 1 = secret, rule }   — rule kinds: see RewardsLogic.progress()
// Item:    { id, m, slot, n, d, p: price, art: shape, c: [main, accent, ink?], t?/t2?: chest print,
//            needs?: sticker id required before buying }
// ========================================================

const REWARDS_DATA = {
  // Points per learning action. Every award has a unique key, so repeating an action never pays twice.
  POINTS: {
    st: { easy: 3, medium: 5, hard: 8 }, // LMS self-test task, first time solved
    stFirstTry: 2,       // ...and it was solved on the very first attempt
    selfTestTopic: 30,   // a self-test topic counted towards readiness (80% solved)
    topicTest: 20,       // topic test passed (>=50%)
    topicTest80: 10,     // ...with >=80%
    topicTest100: 20,    // ...with 100%
    definition: 8,       // a definition graded >=6/10
    oral: 12,            // an oral question graded >=6/10
    problem: 15,         // an exam problem solved
    mock: 40,            // a mock midterm finished, graded and saved (once per attempt)
    pomodoro: 10,        // a finished 25-min focus session...
    pomodoroDailyCap: 8, // ...paid at most this many times a day
    streakStep: 5,       // active day with a streak of k>=2 days: +5*(k-1)...
    streakMax: 20        // ...capped
  },

  RARITY: {
    common:    { n: 'common',    pts: 10,  rim: '#ffffff' },
    rare:      { n: 'rare',      pts: 25,  rim: '#bae6fd' },
    epic:      { n: 'epic',      pts: 50,  rim: '#ddd6fe' },
    legendary: { n: 'legendary', pts: 100, rim: '#fde68a' }
  },

  MODULES: { m2: 'Module 2 · Random variables', general: 'General' },

  SLOTS: [
    { id: 'top', n: 'Clothes' }, { id: 'hat', n: 'Hats' }, { id: 'face', n: 'Face' },
    { id: 'prop', n: 'Props' }, { id: 'bg', n: 'Backgrounds' }
  ],

  STICKERS: [
    // --- Module 2: discrete & continuous r.v., expectation, variance, p.g.f. ---
    { id: 'm2_bernoulli', m: 'm2', r: 'common', n: 'Bernoulli Start', d: 'First correct self-test task. A success with probability p — and it happened!', a: 'coin', h: '#f59e0b', l: 'p', rule: { k: 'st', n: 1 } },
    { id: 'm2_indicator', m: 'm2', r: 'common', n: 'Indicator On', d: 'Both indicator-of-success tasks solved. 1_A = 1.', a: 'bulb', h: '#eab308', rule: { k: 'st', ids: ['ST4-07', 'ST4-08'] } },
    { id: 'm2_dice', m: 'm2', r: 'common', n: 'Fair Die', d: 'The two-dice tasks are solved. No cheating detected.', a: 'die', h: '#0ea5e9', rule: { k: 'st', ids: ['ST4-13', 'ST4-14'] } },
    { id: 'm2_urn', m: 'm2', r: 'common', n: 'Urn With Attitude', d: 'A hundred balls, two tasks, zero panic.', a: 'urn', h: '#8b5cf6', rule: { k: 'st', ids: ['ST4-04', 'ST4-30'] } },
    { id: 'm2_poisson', m: 'm2', r: 'rare', n: 'Poisson Fish', d: 'Poisson is French for “fish”. Rare successes: caught.', a: 'fish', h: '#06b6d4', rule: { k: 'all', of: [{ k: 'st', ids: ['ST4-22'] }, { k: 'def', ids: [6] }] } },
    { id: 'm2_memoryless', m: 'm2', r: 'rare', n: 'Memoryless', d: 'P(X≥5 | X≥3) = P(X≥2). The exponential forgot everything. You didn’t.', a: 'clock', h: '#14b8a6', rule: { k: 'st', ids: ['ST6-15'] } },
    { id: 'm2_cov0', m: 'm2', r: 'rare', n: 'Cov = 0, but…', d: 'Uncorrelated ≠ independent. The oldest colloquium trap didn’t get you.', a: 'T:≠', h: '#f43f5e', rule: { k: 'st', ids: ['ST5-12'] } },
    { id: 'm2_sigma', m: 'm2', r: 'epic', n: '68 · 95 · 99.7', d: 'Every normal-distribution task solved. You’re within normal limits — in a good way.', a: 'bell', h: '#6366f1', rule: { k: 'st', types: ['normal-phi', 'normal-linear'] } },
    { id: 'm2_pgf', m: 'm2', r: 'rare', n: 'Generator in Your Pocket', d: 'p.g.f. conquered: G′(1) = EX, and the points are yours.', a: 'T:G(s)', h: '#10b981', rule: { k: 'all', of: [{ k: 'st', types: ['pgf-factorial'] }, { k: 'def', ids: [20] }] } },
    { id: 'm2_discrete', m: 'm2', r: 'rare', n: 'Discretely Happy', d: 'Topic 4 self-tests counted. Happiness: countable, but there.', a: 'T:Σ', h: '#0284c7', rule: { k: 'stt', topic: 4 } },
    { id: 'm2_expect', m: 'm2', r: 'rare', n: 'Expectations Met', d: 'Topic 5 self-tests counted. E[effort] paid off.', a: 'T:E', h: '#d97706', rule: { k: 'stt', topic: 5 } },
    { id: 'm2_continuous', m: 'm2', r: 'rare', n: 'Continuous Progress', d: 'Topic 6 self-tests counted. Progress is continuous — even differentiable.', a: 'T:∫', h: '#7c3aed', rule: { k: 'stt', topic: 6 } },
    { id: 'm2_rehearsal', m: 'm2', r: 'rare', n: 'Dress Rehearsal', d: 'A full mock midterm: timed, handed in and graded. Friday is only the premiere.', a: 'clock', h: '#7c3aed', l: '50', rule: { k: 'mock', n: 1 } },
    { id: 'm2_hh', m: 'm2', r: 'rare', n: 'Waiting for HH', d: 'The two-heads-in-a-row problem is solved. The coin is in shock.', a: 'coin', h: '#ca8a04', l: 'HH', rule: { k: 'pr', ids: [12] } },
    { id: 'm2_ruin', m: 'm2', r: 'epic', n: 'Not Ruined', d: 'Gambler’s ruin: the gambler — yes. You — no.', a: 'coins', h: '#059669', rule: { k: 'pr', ids: [28] } },
    { id: 'm2_thinning', m: 'm2', r: 'epic', n: 'The Thinner', d: 'Split a Poisson stream into two independent ones. The canteen queue is next.', a: 'fish', h: '#0891b2', l: '×2', rule: { k: 'pr', ids: [6, 26] } },
    { id: 'm2_defs', m: 'm2', r: 'epic', n: '21 Without a Cheat Sheet', d: 'All 21 definitions at 6+. Colloquium, here we come.', a: 'T:21', h: '#4f46e5', rule: { k: 'def', n: 21 } },
    { id: 'm2_oral', m: 'm2', r: 'epic', n: 'Silver Tongue', d: 'Six oral questions at 6+. The board and the chalk are nervous.', a: 'bubble', h: '#e11d48', rule: { k: 'oral', n: 6 } },
    { id: 'm2_perfect', m: 'm2', r: 'rare', n: 'Perfect Sample', d: '100% on a topic test. Not a single outlier.', a: 'star', h: '#16a34a', l: '100', rule: { k: 'tt', pct: 100 } },
    { id: 'm2_lln', m: 'm2', r: 'epic', n: 'Law of Large Numbers', d: 'All 12 topic tests passed. Your success frequency converged to 1.', a: 'star', h: '#9333ea', l: '12', rule: { k: 'tt', n: 12 } },
    { id: 'm2_boss', m: 'm2', r: 'legendary', n: 'Module 2 Boss', d: 'Self-tests, 12 topic tests and 15 problems. Module 2 is yours.', a: 'crown', h: '#f59e0b', rule: { k: 'all', of: [{ k: 'stt', n: 3 }, { k: 'tt', n: 12 }, { k: 'pr', n: 15 }] } },
    { id: 'm2_3sigma', m: 'm2', r: 'legendary', s: 1, n: 'Beyond 3σ', d: '100% readiness. You are an event with probability 0.3%.', a: 'T:3σ', h: '#b45309', rule: { k: 'ready', n: 100 } },
    { id: 'm2_stubborn', m: 'm2', r: 'common', s: 1, n: 'Geometrically Stubborn', d: 'A task gave in after three misses. The geometric distribution is proud of you.', a: 'target', h: '#ea580c', rule: { k: 'stGrind', n: 3 } },
    { id: 'm2_sniper', m: 'm2', r: 'rare', s: 1, n: 'Bernoulli Sniper', d: '10 self-test tasks without a single miss. Your p is clearly above ½.', a: 'target', h: '#dc2626', l: '10', rule: { k: 'stFirst', n: 10 } },

    // --- General: habits, time of day, shop ---
    { id: 'g_streak3', m: 'general', r: 'common', n: 'Three Days Straight', d: 'Unlike a Markov chain, a streak remembers its past.', a: 'flame', h: '#f97316', l: '3', rule: { k: 'streak', n: 3 } },
    { id: 'g_streak7', m: 'general', r: 'epic', n: 'A Week Without Gaps', d: 'Seven days in a row. That’s a pattern, not a coincidence.', a: 'flame', h: '#dc2626', l: '7', rule: { k: 'streak', n: 7 } },
    { id: 'g_owl', m: 'general', r: 'rare', s: 1, n: 'Night Owl', d: 'Distributions between midnight and 5 a.m. The owl approves; your sleep does not.', a: 'owl', h: '#4338ca', rule: { k: 'hour', from: 0, to: 5 } },
    { id: 'g_lark', m: 'general', r: 'rare', s: 1, n: 'Early Bird', d: 'Studying before 8 a.m. The probability of that was close to zero.', a: 'sun', h: '#f59e0b', rule: { k: 'hour', from: 5, to: 8 } },
    { id: 'g_comeback', m: 'general', r: 'common', s: 1, n: 'Return of the Jedi', d: 'Three days off — and you’re back. We weren’t counting (we were).', a: 'back', h: '#0d9488', rule: { k: 'gap', n: 3 } },
    { id: 'g_weekend', m: 'general', r: 'common', s: 1, n: 'Saturday? Never Heard of It', d: 'Studying on a weekend. A deadline must be near.', a: 'T:Sat', h: '#0284c7', rule: { k: 'weekend' } },
    { id: 'g_pomo1', m: 'general', r: 'common', n: 'First Tomato', d: '25 minutes of pure focus. A tomato has been grown.', a: 'tomato', h: '#22c55e', rule: { k: 'pomo', n: 1 } },
    { id: 'g_pomo4', m: 'general', r: 'rare', n: 'Tomato Paste', d: 'Four pomodoros in one day — that’s a sauce now.', a: 'tomato', h: '#ef4444', l: '×4', rule: { k: 'pomoDay', n: 4 } },
    { id: 'g_pomo20', m: 'general', r: 'epic', n: 'Farmer', d: '20 pomodoros. Time to open a vegetable stand.', a: 'tomato', h: '#65a30d', l: '20', rule: { k: 'pomo', n: 20 } },
    { id: 'g_shop1', m: 'general', r: 'common', n: 'First Outfit', d: 'Points turned into merch. The economy works.', a: 'bag', h: '#ec4899', rule: { k: 'own', n: 1 } },
    { id: 'g_shop5', m: 'general', r: 'rare', n: 'Fashion Verdict', d: 'Five things in your wardrobe. The Collegium will notice.', a: 'hanger', h: '#a855f7', rule: { k: 'own', n: 5 } },
    { id: 'g_pts500', m: 'general', r: 'rare', n: 'Point Break', d: '500 points earned. Surf’s up.', a: 'coins', h: '#d97706', rule: { k: 'earned', n: 500 } },
    { id: 'g_collector', m: 'general', r: 'epic', n: 'Collector', d: '15 stickers. Your laptop lid is officially full.', a: 'star', h: '#db2777', l: '15', rule: { k: 'stk', n: 15 } },
    { id: 'g_fixer', m: 'general', r: 'common', n: 'Error Correction', d: 'Five mistakes fixed. Only those who solve things make mistakes.', a: 'check', h: '#16a34a', rule: { k: 'fix', n: 5 } }
  ],

  SHOP: [
    // --- Module 2 ---
    { id: 'm2_tee_cov0', m: 'm2', slot: 'top', n: 'Cov = 0 Tee', d: 'For those who know the counterexample by heart.', p: 150, art: 'tee', c: ['#f43f5e', '#9f1239'], t: 'Cov=0' },
    { id: 'm2_hoodie_exp', m: 'm2', slot: 'top', n: 'Memoryless Hoodie', d: 'However long you’ve studied, the remaining wait is the same.', p: 260, art: 'hoodie', c: ['#0d9488', '#134e4a'], t: 'E(λ)' },
    { id: 'm2_sweater_3s', m: 'm2', slot: 'top', n: 'Three Sigma Sweater', d: 'Keeps you warm 99.7% of the time.', p: 320, art: 'sweater', c: ['#4338ca', '#c7d2fe'], t: '3σ' },
    { id: 'm2_gauss_hat', m: 'm2', slot: 'hat', n: 'Gaussian Beanie', d: 'Symmetric, unimodal. Tails tucked in.', p: 220, art: 'gauss', c: ['#f59e0b', '#b45309'] },
    { id: 'm2_pgf_hat', m: 'm2', slot: 'hat', n: 'G(s) Party Hat', d: 'Celebrating, because G′(1) = EX.', p: 140, art: 'party', c: ['#a855f7', '#fde047'] },
    { id: 'm2_sigma_glasses', m: 'm2', slot: 'face', n: '±σ Glasses', d: 'Everything within one sigma, crystal clear.', p: 120, art: 'round', c: ['#1e293b', '#38bdf8'] },
    { id: 'm2_fish', m: 'm2', slot: 'prop', n: 'Poisson Fish', d: 'Swims by λ times an hour, on average.', p: 200, art: 'fish', c: ['#22d3ee', '#0e7490'], needs: 'm2_poisson' },
    { id: 'm2_urn_balls', m: 'm2', slot: 'prop', n: 'Urn of Balls', d: 'Draw without replacement.', p: 150, art: 'urn', c: ['#a78bfa', '#f43f5e'] },
    { id: 'm2_die', m: 'm2', slot: 'prop', n: 'Seminar Die', d: 'Fair. Probably.', p: 90, art: 'die', c: ['#ffffff', '#1e293b'] },
    { id: 'm2_bulb', m: 'm2', slot: 'prop', n: '1_A Lamp', d: 'Lights up when event A happens.', p: 120, art: 'bulb', c: ['#fde047', '#a16207'], needs: 'm2_indicator' },
    { id: 'm2_bg_bell', m: 'm2', slot: 'bg', n: 'Bell Curve Background', d: 'You’re right at the centre of attention.', p: 160, art: 'bell', c: ['#e0f2fe', '#7dd3fc'] },
    { id: 'm2_bg_poisson', m: 'm2', slot: 'bg', n: 'Poisson Starfall Background', d: 'Stars fall at rate λ.', p: 220, art: 'dots', c: ['#1e1b4b', '#fde68a'] },
    { id: 'm2_bg_grid', m: 'm2', slot: 'bg', n: 'Graph Paper Background', d: 'A seminar classic.', p: 80, art: 'grid', c: ['#ffffff', '#93c5fd'] },
    // --- General ---
    { id: 'g_tee_mint', m: 'general', slot: 'top', n: 'Mint Tee', d: 'Fresh and formula-free.', p: 60, art: 'tee', c: ['#34d399', '#047857'] },
    { id: 'g_tee_peach', m: 'general', slot: 'top', n: 'Peach Tee', d: 'Warm, like a 10 out of 10.', p: 60, art: 'tee', c: ['#fdba74', '#c2410c'] },
    { id: 'g_wizard_hat', m: 'general', slot: 'hat', n: 'Wizard Hat', d: 'Turns formulas into points.', p: 200, art: 'wizard', c: ['#6d28d9', '#fde047'] },
    { id: 'g_beanie', m: 'general', slot: 'hat', n: 'Pom-pom Beanie', d: 'For long walks to the Collegium.', p: 110, art: 'beanie', c: ['#ef4444', '#ffffff'] },
    { id: 'g_phones', m: 'general', slot: 'hat', n: 'Headphones', d: 'Lectures at 2x sound like motivation.', p: 180, art: 'phones', c: ['#334155', '#f43f5e'] },
    { id: 'g_shades', m: 'general', slot: 'face', n: 'Sunglasses', d: 'For when your readiness is blinding.', p: 140, art: 'shades', c: ['#0f172a', '#ffffff'] },
    { id: 'g_mustache', m: 'general', slot: 'face', n: 'Grad Student Mustache', d: '+10 gravitas at the oral exam.', p: 90, art: 'mustache', c: ['#3f2d26'] },
    { id: 'g_coffee', m: 'general', slot: 'prop', n: '3 a.m. Coffee', d: 'Sleep distribution: degenerate.', p: 100, art: 'cup', c: ['#ffffff', '#78350f'] },
    { id: 'g_cat', m: 'general', slot: 'prop', n: 'Shoulder Cat', d: 'Doesn’t explain anything, but very supportive.', p: 350, art: 'cat', c: ['#fb923c', '#1e293b'] },
    { id: 'g_bg_mint', m: 'general', slot: 'bg', n: 'Mint Background', d: 'Calm before the colloquium.', p: 60, art: 'plain', c: ['#d1fae5'] },
    { id: 'g_bg_sunset', m: 'general', slot: 'bg', n: 'Sunset Background', d: 'Like walking out of the midterm.', p: 120, art: 'sunset', c: ['#fed7aa', '#fb7185'] },
    { id: 'g_bg_night', m: 'general', slot: 'bg', n: 'Night Shift Background', d: 'The moon has seen your solutions.', p: 160, art: 'night', c: ['#0f172a', '#fde68a'] }
  ],

  // New art and English copy for the readiness tiers (WARDROBE_ITEMS in js/user.js stays the source
  // of ids and thresholds). A tier without an entry here keeps its legacy renderSvg, name and description.
  TIERS: {
    freshman_tee: { slot: 'top', art: 'tee', c: ['#3b82f6', '#1e3a8a'], t: 'UCU', n: 'Freshman Tee', d: 'The classic blue UCU freshman tee — where colloquium prep begins.' },
    focus_cap: { slot: 'hat', art: 'cap', c: ['#10b981', '#065f46'], n: 'Focus Cap', d: 'Keeps the formulas in and the distractions out.' },
    apps_cs_hoodie: { slot: 'top', art: 'hoodie', c: ['#1e1b4b', '#312e81', '#38bdf8'], t: '</>', n: 'APPS Hoodie', d: 'The Faculty of Applied Sciences (CS@UCU) hoodie with the </> logo.' },
    ucu_hoodie: { slot: 'top', art: 'hoodie', c: ['#4f46e5', '#3730a3', '#fbbf24'], t: 'UCU', n: 'UCU Hoodie', d: 'A warm indigo hoodie with the UCU crest. Made for long days in the Collegium.' },
    velykogo_raglan: { slot: 'top', art: 'raglan', c: ['#18181b', '#52525b'], t: 'DESIRE', t2: 'GREAT THINGS!', n: 'Desire Great Things Raglan', d: 'Black raglan with Patriarch Josyf Slipyj’s motto “Desire great things!”' },
    colloquium_suit: { slot: 'top', art: 'suit', c: ['#1e293b', '#e11d48'], n: 'Colloquium Suit', d: 'Suit and tie for defending your oral questions at Colloquium 2.' },
    ucu_shmot_sweatshirt: { slot: 'top', art: 'sweater', c: ['#881337', '#fda4af'], t: 'SHMOT', n: 'Shmot Sweatshirt', d: 'The burgundy “Shmot” sweatshirt from the UCU store.' },
    sheptytsky_blanket_socks: { slot: 'top', art: 'blanket', c: ['#047857', '#fbbf24'], n: 'Sheptytsky Blanket', d: 'A cosy blanket and wool socks from the Sheptytsky Center. Long-night survival kit.' },
    tech_lab_vest: { slot: 'top', art: 'vest', c: ['#0f172a', '#cbd5e1', '#38bdf8'], t: 'APPS', n: 'APPS Lab Vest', d: 'An engineer’s vest from the Sheptytsky Tech Lab / APPS, with the lab patch.' },
    wizard_robe: { slot: 'top', art: 'robe', c: ['#581c87', '#fbbf24'], t: 'E[X]', n: 'Markov Robe', d: 'A purple robe with density and expectation runes, for masters of Markov chains.' },
    champion_crown: { slot: 'hat', art: 'crown', c: ['#eab308', '#a16207'], n: 'Champion Crown', d: 'For whoever reaches 100% readiness for Midterm 2 and Colloquium 2.' }
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { REWARDS_DATA };
} else {
  window.REWARDS_DATA = REWARDS_DATA;
}
