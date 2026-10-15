# 🎓 UCU StatHustle: Probability & Statistics Midterm 2 & Colloquium Mastery Platform

> **Target:** Maximum score (100% / Top Grade) on **Colloquium II (Wednesday)** & **Midterm 2 (Friday)**.  
> **Course:** Probability and Statistics (UCU 3rd Semester, "Бабілка").  
> **Built for:** Ihor

---

## ⚡ Quick Start

You can open the platform in any browser in two ways:

### Option 1: Direct File Open (Instant, No terminal required)
Double-click `index.html` or open it directly in Chrome/Safari:
```bash
open "/Users/ihor/Studing/UCU/3 semestr/бабілка/мідтерм хаслінг/midterm2/index.html"
```

### Option 2: Local Server (Recommended)
Run the built-in python launcher to start a local server and auto-open your browser:
```bash
python3 server.py
```
Open **`http://localhost:8080`**.

### Tests
Pure logic (drill queue, ticket picker, self-test grading, rewards points/stickers/shop/merge) and the self-test bank data are covered by Node's built-in test runner — no dependencies:
```bash
node --test tests/*.test.js
```

**UI audit (contrast + buttons, both themes)** — needs Google Chrome, still no npm dependencies:
```bash
node tools/ui-audit.mjs                  # both themes, every section and key state, 1440px + 390px
node tools/ui-audit.mjs --themes light --only quiz,selftest   # quick partial run
```
* It serves a temporary copy of the site with the cloud-sync URL (`CLOUD_SYNC_ENDPOINT` in `js/user.js`) rewritten to an unroutable local port, runs its own headless Chrome with a fresh profile, lets only local + CDN GET requests out, and fails if anything ever tries to reach `amazonaws`. It never touches the real backend.
* Logs in as guest and walks every sidebar section plus the key states (flashcard, definition drill, exam ticket, hints, filtered problems, quiz feedback, self-test type window and checks of every task format, running Pomodoro, Gemini drawer/key modal, mistakes panel, every tab of the profile & rewards modal and a reward toast, phone drawer).
* Checks every visible text node against its composited background (WCAG AA 4.5:1, 3:1 for large text and for unavailable `disabled` + `cursor-not-allowed` controls, also while hovered), icon-only buttons and form-field outlines (3:1), `cursor: pointer`, a visible hover change, a visible focus indicator, labels touching/spilling out of buttons, mismatched button heights in a row and horizontal scrolling.
* Writes `ui-audit-out/report.txt`, `report.json` and screenshots (`ui-audit-out/shots/<theme>/`). Exit code 1 when something is not covered by `tools/ui-audit-allowlist.json` — keep that list short, every entry needs a `reason`.

---

## 🌟 Key Features Built From Scratch

### 1. 🎯 Colloquium Center (Focus First!)
* **All 21 Official Colloquium Definitions**:
  * Interactive 3D Flashcards with tap-to-flip mode.
  * Exact mathematical definitions with measurability and integrability conditions.
  * Colloquium tips and **Professor Traps** (the exact nuances examiners check).
  * Direct "Mark as Mastered" checkboxes that feed into your Readiness Meter.
* **🎲 Random Definition Drill (Quizlet-style)** — toggle "Рандомний тест" above the flashcards:
  * Definitions come in shuffled order: type (or say) the definition, reveal the reference, tick the key points you actually covered and grade yourself ✗ / ~ / ✓ (keys `1` `2` `3`, `Ctrl/⌘+Enter` to reveal).
  * "Didn't know" cards come back 3 cards later, "partially" ones go to the end of the queue; the round ends with a summary and a one-click re-run of the weak ones.
  * Scope: all 21 or only the ones not yet scored ≥6/10. Grades feed the same readiness score as the flashcards.
* **🎟️ Colloquium Exam Ticket** — third mode of the same toggle:
  * Draws 1 random oral question (never the same one twice in a row) + 2 random definitions and starts a stopwatch against the question's time hint.
  * "Показати еталон" freezes the clock and shows the answer plan, board formulas, examiner follow-ups, the full model answer and both definitions with their must-know points; each of the 3 items gets its own ✗ / ~ / ✓ grade.
* **The 12 Colloquium Oral Questions & Defense Guides**:
  * Structured 4-step oral answer templates (Definition -> Axioms -> Proof/Formulas -> Counterexample).
  * Key formulas to write down on the board immediately.
  * Examiner follow-up questions and traps.
* **🎙️ Oral Defense Simulator with Gemini**:
  * Speak or type your answer to any oral exam question.
  * Gemini evaluates your answer on a strict 10-point scale, identifies missing mathematical conditions, and calculates your readiness boost!

### 2. 📊 Dynamic Readiness Engine (0% – 100%)
Tracks your real progress across 4 weighted pillars:
1. **21 Definitions Mastery (35%)** — Essential for Wednesday's Colloquium.
2. **Formula & Quiz Mastery (25%)** — Tests understanding of distributions and properties.
3. **Seminar & Colloquium Problems (25%)** — Problem-solving capability for Midterm 2.
4. **Oral Defense & Gemini Evaluations (15%)** — Oral articulation and proof rigor.
* Bonus readiness awarded for completing Pomodoro study sessions!

### 3. 📅 Structured Day-by-Day Study Roadmap (Sunday → Friday)
* **Day 1 (Sunday - Today):** Discrete RVs & Colloquium Core Definitions (Defs 1–6, Seminar 4 problems).
* **Day 2 (Monday):** Expectation, Variance, Covariance, Correlation & PGF (Defs 12–16, 20, Seminar 5).
* **Day 3 (Tuesday):** Continuous RVs, Transformations & Full Oral Colloquium Mock Simulation (Defs 7–11, 17–19, 21, Seminar 6).
* **Day 4 (Wednesday):** **COLLOQUIUM DAY** (Crush oral exam in morning, Midterm 2017 exam in afternoon).
* **Day 5 (Thursday):** Midterm 2 Hardcore Problem Solving (Poisson thinning, Gambler's ruin, Helicopter, timed mock exam).
* **Day 6 (Friday):** **MIDTERM 2 EXAM DAY** (Formula sheet refresh & maximum score victory!).

### 4. 🧠 Interactive Quizzes & Automated Problem Solver
* High-yield multiple choice and calculation questions with KaTeX formula rendering.
* **Practice modes** above the topic grid: "🔁 Мої помилки" re-asks only the questions you got wrong (a correct answer clears them from the dashboard's mistakes panel, which also has a one-click CTA), "🎲 Мікс" serves 20 random questions across all 12 topics. Neither counts as a topic test.
* "Retake Topic Test" starts a clean attempt — previously every saved answer stayed locked, so a retake couldn't be answered.
* Instant visual feedback (green/red) with complete step-by-step mathematical proofs.
* **Hint ladder on every problem**: first a "🧭 Куди рухатись?" nudge (which approach makes it easy — no computations), then the step hints one at a time. The full solution stays collapsed until you open it, and answer prompts no longer show the answer as an "e.g." example.
* Complete problem bank covering:
  * Seminar 4 (Discrete, Rankings, Dice, Redundancy Channel).
  * Seminar 5 (Expectation algebra, Waiting for HH, Geometric tail sum, Urn indicators).
  * Seminar 6 (Normal transformations, Min/Max uniform extremes, Shopping exponential times, Triangle joint density).
  * Colloquium 2022 New Problems (Multinomial covariance $-n/36$, Poisson thinning independence, Gambler's ruin difference equations, Helicopter rescue distance, Mixed traffic light distribution).
  * Midterm 2017 Exam Paper (Problems 1 to 6 complete solutions).

### 4b. 📋 LMS Self-test Bank (Topics 4–6) — tab "LMS Self-tests"
* The tasks from the Moodle self-tests on topics 4, 5 and 6, word for word (formulas, options, correct answers), with exact duplicates and a repeated numeric variant removed: **69 unique tasks** (topic 4: 30, topic 5: 19, topic 6: 20).
* Every task is tagged with its **topic**, one of **14 task types** (e.g. "Впізнати розподіл за описом експерименту", "Нормальний: ймовірності через Φ"; each type lists the lecture slides it relies on) and a **difficulty** (легка / середня / складна).
* Pick a topic, a task type, a difficulty and how many tasks you want (or "only the ones I haven't solved yet") and drill a random set. All Moodle formats work: single and multiple choice (our own partial credit: right picks minus wrong picks), true/false, numeric answers (`0.5`, `0,5` and `1/2` all count), matching and gap-select.
* After each check: the correct answer, Moodle's own hints, a short explanation and the lecture pages. The summary breaks the score down by task type and re-runs the wrong ones in one click. Also reachable from the "Topic Tests" tab.
* **Progress & gamification (kept small):** progress per task lives in the readiness state (`readinessState.selfTestStats`, merged task-by-task with the cloud copy). A topic whose self-test tasks are ≥80% solved adds **+1% Readiness** (3% max, shown as "LMS Self-tests" on the dashboard Mastery Meter; Exam Problems went from 57% to 54% so the total stays 100%). Wrong answers go to the dashboard mistakes panel ("Прорішати помилки з self-тестів LMS"), a correct answer clears them; time spent in the tab shows up in the focus-time analytics. The setup screen shows each topic's progress towards its +1% and a "Мої помилки" shortcut; the summary announces a newly counted topic.
* `js/selftest-data.js` is generated from a local extraction of the LMS review pages (kept out of the repo); edit the generator, not the file.

### 5. 🤖 Gemini AI Mentor Integration
* Dedicated slide-over AI tutor drawer available on every page.
* Integrated with Google Gemini 2.0 Flash / 1.5 Flash.
* Pre-configured with UCU Probability curriculum and grading criteria.
* Supports your custom API key (saved securely in your browser's `localStorage`).
* **Intelligent Offline Fallback**: If no API key is provided yet, a built-in smart tutor knowledge base still evaluates your answers and provides hints!

### 6. ⏱️ Built-in Pomodoro Focus Station
* 25-minute focus sessions with 5-minute short breaks and 15-minute long breaks.
* Synthesized Web Audio chime (works 100% offline, no external audio files required).
* Persistent session tracking across days.

### 6b. 🧭 Navigation & Mobile
* **Sidebar grouped by purpose** — Головне (Огляд) · Колоквіум 2 (Означення й усні) · Мідтерм 2 · практика (Задачі з іспитів, Тести за темами, Self-тести LMS) · Довідник (Теорія, Формули). Exam countdowns sit on top of it (click → schedule & grades); sync status, Gemini key and logout at the bottom.
* **Slim top bar**: logo + current section, then only live widgets — Pomodoro, Readiness (click → Огляд), Gemini mentor, theme, profile.
* **Phones**: the sidebar becomes a drawer (☰, closes on pick / backdrop / Esc), the Mastery Meter stacks, no horizontal scrolling at 390px. KaTeX's hidden MathML is kept inside `.katex` (`position: relative`), otherwise it widened pages on phones.
* **Addresses**: the URL mirrors where you are — `#/problems/28`, `#/colloquium/def/3`, `#/quizzes/5`, `#/selftests/ST4-02`, `#/topics/topic-12` — so browser back/forward, refresh and shared links all land in the same place.
* **Clickable study plan** (dashboard, `js/study-plan.js`): every day-by-day task opens the exact definition / problem / topic test / timer / grade form and checks itself off from the matching result (unmeasurable tasks get a manual tick). Days are dated back from your midterm date, so "Сьогодні" is the real today and opens by default. A day's +2% readiness bonus uses the same "all tasks done" rule.

### 7. 🌗 Light & Dark Themes
* Follows the system theme on first visit; the 🌙/☀️ button in the header switches and remembers the choice.
* Tailwind colors resolve through `--surface-*` / `--text-*` / `--line-*` CSS variables (config in `index.html`); the light remapping lives in `css/style.css`. Dark mode renders Tailwind's palette except the shades that fail WCAG AA in both themes ("Both themes" block in `css/style.css`): muted `text-slate-500/600` become slate-400, white labels on `bg-emerald-600` / `bg-amber-600` and the `hover:bg-indigo-500` of indigo buttons step one shade darker, and form fields get a 3:1 outline.
* Buttons: `.btn` + `.btn-lg` + `.btn-primary` / `.btn-secondary` / `.btn-warning` (used by the Pomodoro card) are complete on their own, so swapping the variant never changes the size. Utility-styled buttons that show a selected state carry `aria-pressed`.
* `node tools/ui-audit.mjs` (see Tests) checks contrast, hover/focus/cursor feedback and button shape in both themes.

### 8. 🧩 Icon System
* UI icons are [Lucide](https://lucide.dev) (ISC license, v0.468.0 from jsDelivr) rendered as inline SVG — no emoji stickers in the interface.
* In JS templates: `${icon('dices')}` or `${icon('trophy', 'text-amber-400')}`; in static `index.html` markup: `<i data-icon="dices"></i>` (always with a closing tag), hydrated on load by `js/icons.js`.
* Icons are `1em` and use `currentColor`, so they follow the text size and both themes. If the CDN is unreachable, `icon()` returns an empty string and the UI keeps working without icons.

### 9. 📐 Master Distribution & Formula Matrix
* Complete reference table for discrete ($B(1,p), B(n,p), G(p), P(\lambda)$) and continuous ($U(a,b), E(\lambda), N(\mu, \sigma^2), \text{Laplace}$) distributions.
* Includes Supports, PMF/PDF, Means, Variances, PGFs, MGFs, and key exam pitfalls.

### 10. 🏅 Points, Stickers & Shop
* **Points** come only from real learning: the first correct answer to a self-test task, passed topic tests, definitions and oral questions graded 6+, solved problems, finished Pomodoros (8 a day pay), and a small bonus for a streak of study days. Each award is paid once, so repeating something never earns more.
* **37 stickers**: 23 for Module 2 (for example "Memoryless", "Poisson Fish", "Cov = 0, but…", "68 · 95 · 99.7") and 14 general ones. They come in four rarities, and 7 are secret. All art is tiny inline SVG.
* **Shop**: 25 items for the layered avatar (clothes, hats, glasses, props, backgrounds). The readiness tiers are still free unlocks. You can try an item on before buying it.
* The dashboard card "My avatar" shows the avatar, balance, streak and latest stickers. The profile modal has the tabs **Avatar · Shop · Stickers · Account** and can be opened anywhere with `window.rewards.open('shop')` or `data-rewards-open="shop"`. Toasts are small and hide themselves (they can be switched off), and nothing animates with reduced motion.
* The state is stored as ids and numbers in the profile and merged with the cloud without counting anything twice. Details, the points table and how to add module 3 are in [`docs/gamification.md`](docs/gamification.md).

---

## 🗂️ File Structure
```
midterm2/
├── index.html            # Main web application
├── server.py             # One-click local Python server
├── README.md             # This guide
├── css/
│   └── style.css         # Layout styles + light-theme color remapping
├── js/
│   ├── data.js           # 137KB verified course dataset (definitions, problems, schedule)
│   ├── problem-directions.js # "Куди рухатись" direction hints, one per problem (kept out of generated data.js)
│   ├── gemini.js         # Gemini AI Mentor & oral evaluator
│   ├── pomodoro.js       # Pomodoro timer with Web Audio synthesizer
│   ├── quiz.js           # Interactive quiz manager & readiness engine
│   ├── definition-drill.js # Random definition drill (shuffled recall + self-grading)
│   ├── exam-ticket.js    # Colloquium ticket: random oral question + 2 definitions + stopwatch
│   ├── selftest-data.js  # Generated: 69 unique LMS self-test tasks (topic, type, difficulty)
│   ├── selftest-bank.js  # Self-test drill: filters, random sets, grading for every Moodle format
│   ├── icons.js          # icon('name') helper + <i data-icon> hydration (Lucide inline SVG)
│   ├── rewards-data.js   # Rewards catalog: points rules, stickers, shop items, tier art (data only)
│   ├── rewards-art.js    # Avatar, item and sticker inline SVG from shared shapes (DOM-free)
│   ├── rewards.js        # Rewards logic: points, sticker rules, buy/wear, local⇄cloud merge (DOM-free)
│   ├── rewards-ui.js     # Dashboard card, Avatar · Shop · Stickers modal, toasts, notify() hooks
│   └── app.js            # UI controller, routing & event handling
├── docs/gamification.md  # Rewards design: principles, points table, state, hooks, adding a module
├── tests/                # node --test unit tests for pure logic
├── tools/                # ui-audit.mjs: contrast & button audit in headless Chrome (+ its allowlist)
├── vendor/
│   └── katex/            # Offline KaTeX assets (css, js, auto-render)
└── extracted_text/       # Clean text extractions from course PDFs
```

Good luck on Wednesday and Friday — go get that maximum score! 🚀
