# Gamification: points, stickers, shop

Light-hearted rewards on top of the real study progress. The goal is a small, pleasant reaction to real learning that never gets in the way. Nothing is paid for idle time or for clicking around.

## What the user sees
- **Dashboard card "My avatar"**: avatar, points balance (counts up, with a floating `+N`), streak, sticker count, the last 3 stickers, and links to the shop and the collection. With no stickers yet, it shows a call to action that opens the self-tests.
- **Profile modal** with four tabs: **Avatar** (what you wear, in 5 slots), **Shop** (try an item on, then buy it), **Stickers** (the collection, progress and how to earn each one), **Account** (Google sign-in, name, photo, timer). On phones it opens as a bottom sheet.
- **Toasts** appear in the bottom corner, hide themselves after a few seconds, and pause while hovered. Clicking one opens the matching tab. A points toast is plain; a sticker toast is bigger and shows the sticker art. Users can turn toasts off with the "Notifications" switch (saved in localStorage, per device). The `+N` on the card still shows when toasts are off. With `prefers-reduced-motion`, nothing animates.

## Research → principles applied
| Principle | Seen in | Applied as |
|---|---|---|
| Name each reward after the exact behaviour, with a pun | Monobank's award cats: "Laundromat" (big cash top-ups), "Thanos" (cashback from six partners), "What's this?" (first bookstore purchase) ([rates.fm](https://rates.fm/ua-uk/banks/nagorodi-vid-monobank-sho-voni-dayut-ta-yak-yih-otrimati/)) | "Memoryless" (the memorylessness task), "Expectations Met" (topic 5), "Poisson Fish" (poisson = fish in French) |
| Ladders: an easy first award, then harder tiers, then a meta-award | Monobank "Fellow Traveller → Passenger", "Collector" | First Tomato → Tomato Paste → Farmer; Bernoulli Start → Bernoulli Sniper; Collector |
| Secret awards, shown only as "N hidden left" | Monobank secret cats; Steam hidden achievements ([thread](https://steamcommunity.com/discussions/forum/0/3183487594852508694)) | 7 secret stickers; "5 secret ones are still waiting for the right moment" |
| Show progress partway, not only at the end | [Steamworks docs](https://partner.steamgames.com/doc/features/achievements) | `1/2`, `312/500` on locked stickers, plus a "How to get it" line |
| Celebrate once, in context, bigger for milestones; then a collection | [Duolingo streak post](https://blog.duolingo.com/how-duolingo-streak-builds-habit); Monobank's collection screen | Small toast for points, larger toast for a sticker, a collection tab |
| Forgive instead of punishing, and let people switch it off | Duolingo streak freeze; Monobank's "receive awards" switch | A broken streak never costs points; "Return of the Jedi" rewards coming back; "Notifications" switch |
| Points you can spend, plus themed sets | Ukrzaliznytsia's "hugs" points and its themed awards ([kosht.media](https://kosht.media/ukrzaliznytsia-dodala-systemu-nahorod-do-svoiei-bonusnoi-prohramy/), [shotam.info](https://shotam.info/ukrzaliznytsia-zapuskaie-onovlenu-prohramu-loialnosti-shcho-dodaly/)) | Points buy items in the shop; the catalog is keyed by module (`m2`, `general`) |

Rarity can't be shown as "% of users" the way Steam does it, because that needs an aggregate across all accounts. Rarity is a designed tier instead.

## Files
| File | What | Notes |
|---|---|---|
| `js/rewards-data.js` | Catalog: `POINTS`, `RARITY`, `STICKERS`, `SHOP`, `TIERS` (new art and copy for the readiness wardrobe) | data only |
| `js/rewards-art.js` | `RewardsArt`: avatar, item tiles and sticker SVG, built from a handful of shared shapes | DOM-free |
| `js/rewards.js` | `RewardsLogic`: points, sticker rules, buy/wear, `merge` | DOM-free, `node --test` |
| `js/rewards-ui.js` | `window.rewards`: card, modal, toasts, `notify()` | browser only |
| `tests/rewards.test.js` | rules, idempotency, purchases, merge, catalog integrity, size budget | |

Data and art together are about 35 KB raw (about 12 KB gzipped), and a test keeps them under 40 KB. There are no images, fonts or new requests. Colours reach the shapes as CSS variables (`--a`, `--b`, `--c` on a wrapper `<g>`), so one shape serves every colour variant.

## State: `profile.rewards`
It is synced with the cloud as part of the profile, so it holds **ids and numbers only**:
```
{ v: 1,
  pts:  { "st:ST4-12": 3, "st1:ST4-12": 2, "def:6": 8, "stk:m2_poisson": 25, … },  // every award once
  own:  { "m2_hoodie_exp": 260 },        // purchases (price paid)
  stk:  { "m2_poisson": 1760000000000 }, // sticker → first earned (ms)
  days: ["2026-10-14", "2026-10-15"],    // active study days, last 60 (streaks)
  n:    { fix: 3 },                      // counters
  eq:   { top: "m2_hoodie_exp", hat: null, … }, eqAt: …,  // what the avatar wears
  rmax: 40,                              // highest readiness % announced (tier unlock toasts)
  seen: …                                // last visit of the collection ("new" dots)
}
```
`balance = sum(pts) − sum(own)`. Each award has a unique key, so repeating an action pays only once.

### Merge (`RewardsLogic.merge`, called from `mergeUserProfiles`)
`pts`, `own` and `n` are unioned, taking the max per key. `stk` is unioned with the earliest date. `days` are unioned. `eq` comes from whichever side changed it last, and `rmax` and `seen` take the max. An award earned on two devices has the same key, so it is counted once, and no purchase is ever lost.

One edge case: if the same points are spent on two offline devices, the merged balance can go negative. The UI then shows 0, and new points pay off the difference.

## Points
| Action | Key | Points |
|---|---|---|
| LMS self-test task, first correct answer | `st:<id>` | easy 3 · medium 5 · hard 8 |
| …and correct on the very first attempt | `st1:<id>` | +2 |
| Self-test topic counted (80% solved) | `stt:<topic>` | 30 |
| Topic test passed (≥50%) / ≥80% / 100% | `tt` / `tt80` / `tt100:<topic>` | 20 / +10 / +20 |
| Definition graded ≥6/10 | `def:<id>` | 8 |
| Oral question graded ≥6/10 | `oral:<id>` | 12 |
| Exam problem solved | `pr:<id>` | 15 |
| Pomodoro work session | `pomo:<date>T<hhmm>` | 10, first 8 a day only |
| Active day with a streak of k ≥ 2 days | `day:<date>` | 5·(k−1), max 20 |
| Sticker | `stk:<id>` | common 10 · rare 25 · epic 50 · legendary 100 |

These points come from the readiness state the app already keeps (`selfTestStats`, `topicTestsSolved`, `definitionsScores`, `problemsMastered`). They are idempotent because of that, and the first load also pays for earlier progress, shown in a single toast. Only real progress counts as an active day: a correct answer, a grade of 6+, a solved problem, a finished test or a finished Pomodoro. Wrong answers don't count.

**Balance.** A diligent week (about 40 self-tests, 6 topic tests, 15 definitions, 8 problems and 15 Pomodoros) earns about 1,100–1,300 points including stickers. Items cost 60–350, so that buys 4–6 nice items. The full catalog costs 3,860.

## Stickers (37)
| | common | rare | epic | legendary |
|---|---|---|---|---|
| Module 2 (23) | 5 | 10 | 6 | 2 |
| General (14) | 6 | 5 | 3 | – |

7 of them are secret: Night Owl, Early Bird, Return of the Jedi, Saturday? Never Heard of It, Geometrically Stubborn (solved after three misses), Bernoulli Sniper (10 solved with no misses) and Beyond 3σ (100% readiness). Time-of-day and comeback stickers need a live action. They are never awarded by the silent catch-up.

Rule kinds are `st` (`n` / `ids` / `types`), `stFirst`, `stGrind`, `stt`, `tt` (`n` / `pct`), `def`, `oral`, `pr`, `pomo`, `pomoDay`, `streak`, `own`, `earned`, `stk`, `ready`, `fix`, `hour`, `weekend`, `gap`, and `all: [rules]`. They are defined in `RewardsLogic.progress()`, which also returns `{have, need}` for the progress shown in the UI.

## Shop and wardrobe
- **5 slots**: `top` (Clothes), `hat` (Hats), `face` (Face), `prop` (Props), `bg` (Backgrounds).
- **25 shop items**: 13 for Module 2 (for example the Memoryless Hoodie, the Three Sigma Sweater, the Gaussian Beanie, the Poisson Fish, the 1_A Lamp, the Graph Paper background) and 12 general ones (for example the Shoulder Cat, 3 a.m. Coffee, the Wizard Hat). An item can require a sticker first (`needs`). For example, the Poisson Fish needs the "Poisson Fish" sticker.
- **The readiness tiers** (`WARDROBE_ITEMS` in `js/user.js`) are free unlocks at their readiness %. They use the new art, English name and description from `TIERS`. A tier without a `TIERS` entry keeps its legacy `renderSvg`, name and description. The old `profile.equippedOutfit` is still honoured until a slot is set.
- A purchased item is worn straight away.

## Hooks (one line each, marked `// rewards:`)
| Where | Call |
|---|---|
| `SelfTestBank.check()` (`js/selftest-bank.js`) | `rewards.notify('selftest', {id, correct})` |
| `QuizManager.recordDefinitionScore` (`js/quiz.js`) | `notify('definition', {id, score})`. This covers the definition drill, the exam ticket, flashcards and the oral simulator. |
| `QuizManager.recordProblemSolved` | `notify('problem', {id})` |
| `QuizManager.recordTopicTestSolved` | `notify('topicTest', {id, score, total})` |
| `PomodoroTimer.completeSession` (`js/pomodoro.js`) | `notify('pomodoro')` |
| `UserProfileManager.recordSuccess` (`js/user.js`) | `notify('fix')`, when a mistake leaves the registry |
| `UserProfileManager.updateUserUI` | `rewards.onProfileLoaded()` (silent catch-up after login or a cloud merge) |
| `mergeUserProfiles` | `RewardsLogic.merge(local.rewards, cloud.rewards)` |
| `renderAvatar`, `renderWardrobeList` | delegate to `window.rewards` |

## Entry points
- `window.rewards.open('avatar' | 'shop' | 'stickers' | 'account')`, or any element with `data-rewards-open="shop"`.
- A bottom navigation bar can lift the toasts with `--rw-toast-offset: 64px` on `:root`.

## Adding module 3
Add stickers and shop items with `m: 'm3'` to `rewards-data.js`, and add `m3` to `MODULES`. New art means adding a glyph or shape to `rewards-art.js`, a few paths at most. No logic changes are needed: the tabs, filters and groups are built from the data. `tests/rewards.test.js` checks that every id, rule, task, definition, problem and art reference exists.
