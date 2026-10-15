// ========================================================
// Mock midterm: a timed simulation of Midterm 2 (module 2: topics 4–6) in the format of the 2017 paper —
// 6 problems, 50 points, closed book, solutions on paper. Two papers: the 2017 practice paper word for word
// (js/midterm-papers.js) and a new mock assembled from the real module-2 materials (LMS self-tests, the 21
// colloquium definitions with verbatim lecture quotes, exam problems). After the exam the student grades
// the written work against our worked solutions; the result is kept in readinessState.mockAttempts.
// Public: window.mockMidterm.init() · .show() · .openPaper(id, { fromRoute, problem })
// ========================================================

// Pure logic — DOM-free so it can be unit-tested with `node --test`.
const MockMidtermLogic = {
  TOTAL_POINTS: 50,
  DURATIONS: [60, 80, 90, 120],
  DEFAULT_DURATION: 80,            // one UCU class slot
  WARNINGS: [10, 1],               // minutes left at which the timer warns, once each
  CHOICE_FORMATS: ['single', 'multi', 'tf', 'numeric'],
  CHOICE_COUNT: 5,
  DEF_COUNT: 5,
  WRITTEN_POINTS: 10,

  // Problems 3–6 of a new mock: one exam problem per block. The 2017 paper's own problems (37, 39–42) stay out,
  // so the new mock is fresh even after sitting the 2017 paper.
  SLOTS: [
    { id: 'A', title: 'Normal distribution & transformations', ids: [19, 32] },
    { id: 'B', title: 'Discrete laws & generating functions', ids: [3, 6, 14, 25, 26] },
    { id: 'C', title: 'Exponential & continuous laws, mixtures', ids: [20, 23, 33] },
    { id: 'D', title: 'Joint distributions & conditioning', ids: [1, 2, 7, 18, 24] }
  ],
  PAPER_2017_PROBLEMS: [37, 39, 40, 41, 42],

  // Problem 2 of a new mock: the sentence to complete for each of the 21 colloquium definitions (PS_DATA.DEFINITIONS_21)
  DEF_PROMPTS: {
    1: 'A <b>r.v.</b> \\(X\\) is <i>discrete</i> if …',
    2: 'The <i>probability mass function</i> of a discrete <b>r.v.</b> \\(X\\) is …',
    3: 'The <i>cumulative distribution function</i> of a <b>r.v.</b> \\(X\\) is given by …',
    4: 'A <b>r.v.</b> \\(X\\) has the <i>binomial</i> distribution \\(\\mathscr B(n,p)\\) if …',
    5: 'A <b>r.v.</b> \\(X\\) has the <i>geometric</i> distribution \\(\\mathscr G(p)\\) if …',
    6: 'A <b>r.v.</b> \\(X\\) has the <i>Poisson</i> distribution \\(\\mathscr P(\\lambda)\\) if …',
    7: 'A <b>r.v.</b> \\(X\\) is <i>continuous</i> if …',
    8: 'The <i>probability density function</i> of a continuous <b>r.v.</b> \\(X\\) is …',
    9: 'A <b>r.v.</b> \\(X\\) has the <i>uniform</i> distribution \\(\\mathscr U(a,b)\\) if …',
    10: 'A <b>r.v.</b> \\(X\\) has the <i>exponential</i> distribution \\(\\mathscr E(\\lambda)\\) if …',
    11: 'A <b>r.v.</b> \\(Y\\) has the <i>normal</i> distribution \\(\\mathscr N(\\mu,\\sigma^2)\\) if …',
    12: 'The <i>expected value</i> of a discrete <b>r.v.</b> \\(X\\) with values \\(x_1,x_2,\\dots\\) is …',
    13: 'The <i>covariance</i> of <b>r.v.</b>’s \\(X\\) and \\(Y\\) is …',
    14: 'The <i>correlation</i> of <b>r.v.</b>’s \\(X\\) and \\(Y\\) is …',
    15: 'The <i>joint probability mass function</i> of discrete <b>r.v.</b>’s \\(X\\) and \\(Y\\) is …',
    16: 'The <i>marginal</i> distributions of \\(X\\) and \\(Y\\) in a joint distribution of \\((X,Y)\\) are given by …',
    17: 'Given a joint p.d.f. \\(f_{X,Y}\\), the <i>conditional</i> p.d.f. of \\(X\\) given that \\(Y=y\\) is …',
    18: 'If \\(Y=g(X)\\) for a strictly monotonic differentiable \\(g\\), the p.d.f. of \\(Y\\) is …',
    19: 'The distribution of the <i>sum</i> \\(X+Y\\) of independent <b>r.v.</b>’s \\(X\\) and \\(Y\\) is given by …',
    20: 'The <i>probability generating function</i> of an integer-valued <b>r.v.</b> \\(X\\) is …',
    21: 'The <i>moment generating function</i> of a <b>r.v.</b> \\(X\\) is …'
  },

  // Where the lecturer defines each of them: the Definition quote of the matching "Get ready" checklist item
  // (MIDTERM_PREP). 16, 18 and 19 have no Definition quote there; they fall back to the colloquium card.
  DEF_REFS: {
    1: { item: 'd-discrete-rv', lecture: 'L4', page: 10, has: '<b>discrete</b>' },
    2: { item: 'd-pmf', lecture: 'L4', page: 14 },
    3: { item: 'd-cdf', lecture: 'L4', page: 19 },
    4: { item: 'x-binomial', lecture: 'L4', page: 25 },
    5: { item: 'x-geometric', lecture: 'L4', page: 27 },
    6: { item: 'x-poisson', lecture: 'L4', page: 30 },
    7: { item: 'd-continuous-rv', lecture: 'L6', page: 6 },
    8: { item: 'd-pdf', lecture: 'L6', page: 6 },
    9: { item: 'x-uniform', lecture: 'L6', page: 17 },
    10: { item: 'x-exponential', lecture: 'L6', page: 27 },
    11: { item: 'x-normal', lecture: 'L6', page: 24 },
    12: { item: 'd-moments', lecture: 'L5', page: 6 },
    13: { item: 'n-cov-corr', lecture: 'L6', page: 37 },
    14: { item: 'n-cov-corr', lecture: 'L6', page: 38 },
    15: { item: 'n-joint', lecture: 'L4', page: 37 },
    17: { item: 'n-conditional', lecture: 'L6', page: 47 },
    20: { item: 'd-pgf-mgf', lecture: 'L5', page: 28 },
    21: { item: 'd-pgf-mgf', lecture: 'L6', page: 14 }
  },

  // The self-test grader (js/selftest-bank.js): a global in the browser, required under node
  get selfTest() {
    if (typeof SelfTestLogic !== 'undefined') return SelfTestLogic;
    return typeof require === 'function' ? require('./selftest-bank.js').SelfTestLogic : null;
  },

  // --- randomness: seeded, so a mock can be rebuilt and tests are deterministic ---
  rng(seed) {
    let a = (Number(seed) >>> 0) || 1;
    return () => { // mulberry32
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  shuffle(items, rand) {
    const arr = items.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // 10 points over n parts: equal integer shares, the remainder goes to the last part
  splitPoints(total, n) {
    const parts = Math.max(1, n);
    const base = Math.floor(total / parts);
    const out = Array(parts).fill(base);
    out[parts - 1] += total - base * parts;
    return out;
  },

  // --- the bank problems' light markdown (with $…$ TeX) → HTML ---
  esc(s) {
    return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  },

  // "| a | $|x|$ |" → ['a', '$|x|$']: pipes inside $…$ do not split cells
  tableCells(row) {
    const cells = [];
    let cur = '';
    let math = false;
    for (const ch of row.trim().replace(/^\|/, '').replace(/\|$/, '')) {
      if (ch === '$') math = !math;
      if (ch === '|' && !math) { cells.push(cur.trim()); cur = ''; } else cur += ch;
    }
    cells.push(cur.trim());
    return cells;
  },

  mdToHtml(md = '') {
    const inline = s => this.esc(s).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    const lines = String(md).split('\n');
    const out = [];
    let list = null;
    const close = () => { if (list) out.push(`</${list}>`); list = null; };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { close(); continue; }
      if (line.startsWith('|')) {
        close();
        const rows = [];
        for (; i < lines.length && lines[i].trim().startsWith('|'); i++) rows.push(lines[i].trim());
        i--;
        const body = rows.filter(r => !/^\|[\s|:-]+\|?$/.test(r)).map(r => this.tableCells(r));
        const [head, ...rest] = body;
        out.push(`<div class="mm-table-wrap"><table class="mm-table"><thead><tr>${(head || []).map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>` +
          `<tbody>${rest.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
        continue;
      }
      const bullet = line.match(/^[-*]\s+(.*)$/);
      const numbered = line.match(/^\d+\.\s+(.*)$/);
      if (bullet || numbered) {
        const tag = bullet ? 'ul' : 'ol';
        if (list !== tag) { close(); out.push(`<${tag} class="mm-list">`); list = tag; }
        out.push(`<li>${inline((bullet || numbered)[1])}</li>`);
        continue;
      }
      close();
      out.push(`<p>${inline(line)}</p>`);
    }
    close();
    return out.join('');
  },

  // A bank statement → its preamble and the parts "(a) …", "(b) …" (each starting a line)
  parseParts(statement = '') {
    const intro = [];
    const parts = [];
    for (const line of String(statement).split('\n')) {
      const m = line.trim().match(/^\(([a-z])\)\s*(.*)$/);
      if (m) parts.push({ label: m[1], text: m[2] });
      else if (parts.length) parts[parts.length - 1].text += '\n' + line;
      else intro.push(line);
    }
    return { intro: intro.join('\n').trim(), parts: parts.map(p => ({ label: p.label, text: p.text.trim() })) };
  },

  // A bank solution → a shared setup and one chunk per part, split at the "**(a) Title:**" headers
  parseSolution(solution = '') {
    const intro = [];
    const parts = {};
    let cur = null;
    for (const line of String(solution).split('\n')) {
      const m = line.trim().match(/^\*\*\(([a-z])\)\s*(.*?)\*\*\s*(.*)$/);
      if (m) {
        cur = parts[m[1]] = { title: m[2].trim().replace(/:$/, ''), body: m[3] ? [m[3]] : [] };
        continue;
      }
      (cur ? cur.body : intro).push(line);
    }
    return {
      intro: intro.join('\n').trim(),
      parts: Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, { title: v.title, body: v.body.join('\n').trim() }]))
    };
  },

  // --- assembling a new mock ---
  prepItems(prep) {
    return (prep?.groups || []).flatMap(g => g.items || []);
  },

  // The lecturer's own wording for a definition, else the colloquium card (clearly not a lecture quote)
  defReference(defId, data = {}) {
    const ref = this.DEF_REFS[defId];
    if (ref) {
      const item = this.prepItems(data.prep).find(i => i.id === ref.item);
      const quote = (item?.quotes || []).find(q => q.kind === 'Definition' && q.lecture === ref.lecture &&
        q.page === ref.page && (!ref.has || q.text.includes(ref.has)));
      if (quote) return { kind: 'lecture', text: quote.text, lecture: quote.lecture, page: quote.page };
    }
    const def = (data.defs || []).find(d => d.id === defId);
    if (!def) return null;
    return {
      kind: 'colloquium',
      defId,
      name: def.name,
      text: this.mdToHtml(def.definition) + (def.latexFull ? `<p>$$${this.esc(def.latexFull)}$$</p>` : '')
    };
  },

  // "Lecture 6 · slide 5"
  citation(ref) {
    if (!ref?.lecture) return '';
    return `Lecture ${String(ref.lecture).replace(/^L/, '')}${ref.page ? ` · slide ${ref.page}` : ''}`;
  },

  // Problem 1: five auto-gradable self-test tasks of five different types, one true/false at least
  // (like the paper's T/F items), every module-2 topic covered; T/F items go last, as on the paper.
  pickChoice(tasks, rand, n = this.CHOICE_COUNT) {
    const pool = this.shuffle((tasks || []).filter(t => this.CHOICE_FORMATS.includes(t.format)), rand);
    const picked = [];
    const usedTypes = new Set();
    const take = pred => {
      const t = pool.find(x => !usedTypes.has(x.type) && pred(x));
      if (t && picked.length < n) { picked.push(t); usedTypes.add(t.type); }
    };
    take(t => t.format === 'tf');
    for (const topic of [...new Set(pool.map(t => t.topic))].sort((a, b) => a - b)) {
      if (!picked.some(t => t.topic === topic)) take(t => t.topic === topic);
    }
    while (picked.length < n && pool.some(x => !usedTypes.has(x.type))) take(() => true);
    return [...picked.filter(t => t.format !== 'tf'), ...picked.filter(t => t.format === 'tf')];
  },

  // Problem 2: five of the 21 definitions, in the order of the course
  pickDefinitions(defs, rand, n = this.DEF_COUNT) {
    const ids = (defs || []).map(d => d.id).filter(id => this.DEF_PROMPTS[id]);
    return this.shuffle(ids, rand).slice(0, n).sort((a, b) => a - b);
  },

  // Problems 3–6: one problem per block (ids missing from the bank are skipped)
  pickProblems(problems, rand) {
    const have = new Set((problems || []).map(p => p.id));
    return this.SLOTS.map(slot => {
      const ids = slot.ids.filter(id => have.has(id) && !this.PAPER_2017_PROBLEMS.includes(id));
      return ids.length ? ids[Math.floor(rand() * ids.length)] : null;
    }).filter(id => id !== null);
  },

  // Everything a new mock needs to be rebuilt exactly later (stored with the attempt)
  pickMock(seed, data = {}) {
    const rand = this.rng(seed);
    const tasks = data.bank?.tasks || [];
    const st = this.selfTest;
    return {
      seed: Number(seed) >>> 0,
      choice: this.pickChoice(tasks, rand).map(t => ({ id: t.id, order: st ? st.optionOrder(t, rand) : (t.options || []).map((_, i) => i) })),
      defs: this.pickDefinitions(data.defs, rand),
      problems: this.pickProblems(data.problems, rand)
    };
  },

  // A bank problem as a written problem of the paper: verbatim statement, parts with points, per-part solutions
  writtenFromBank(prob, n, data = {}) {
    const { intro, parts } = this.parseParts(prob.statement);
    const sol = this.parseSolution(prob.solution);
    const list = parts.length ? parts : [{ label: '', text: prob.statement }];
    const points = this.splitPoints(this.WRITTEN_POINTS, list.length);
    const split = list.every(p => sol.parts[p.label]);
    const theory = data.theory?.[prob.id];
    const slot = this.SLOTS.find(s => s.ids.includes(prob.id));
    return {
      n,
      points: this.WRITTEN_POINTS,
      kind: 'written',
      statement: parts.length ? this.mdToHtml(intro) : '',
      parts: list.map((p, i) => ({
        label: p.label,
        points: points[i],
        text: this.mdToHtml(p.text),
        solution: split ? this.mdToHtml(sol.parts[p.label].body) : '',
        solutionTitle: split ? sol.parts[p.label].title : ''
      })),
      // the setup before part (a), or the whole worked solution when it does not split by part
      solutionIntro: split ? this.mdToHtml(sol.intro) : this.mdToHtml(prob.solution),
      defs: theory?.defs || [],
      notes: theory?.notes ? [theory.notes] : [],
      bankId: prob.id,
      source: prob.source,
      origin: String(prob.title || '').replace(/^Problem \d+:\s*/, ''),
      block: slot?.title || ''
    };
  },

  // picks → a paper in the schema of MIDTERM_PAPERS (plus `task` on the self-test items)
  paperFromPicks(picks, data = {}) {
    const tasks = new Map((data.bank?.tasks || []).map(t => [t.id, t]));
    const types = new Map((data.bank?.types || []).map(t => [t.id, t]));
    const problems = new Map((data.problems || []).map(p => [p.id, p]));
    const choice = (picks?.choice || []).filter(c => tasks.has(c.id));
    const defs = (picks?.defs || []).filter(id => this.DEF_PROMPTS[id]);
    const written = (picks?.problems || []).filter(id => problems.has(id));
    return {
      id: 'new',
      generated: true,
      title: 'New mock paper',
      course: 'Probability and Statistics',
      totalPoints: this.TOTAL_POINTS,
      pointsNote: 'Problem points follow the 2017 paper; the points of each part are split evenly (our rubric).',
      solutionsNote: 'Problem 1 is from the LMS self-tests, problems 3–6 are real exam and seminar problems. The worked solutions are ours.',
      problems: [
        {
          n: 1, points: choice.length, title: 'Multiple choice and true/false questions', kind: 'choice',
          items: choice.map((c, i) => {
            const task = tasks.get(c.id);
            return { id: `1.${i + 1}`, points: 1, task, order: c.order, defs: types.get(task.type)?.defs || [], typeLabel: types.get(task.type)?.label || '' };
          })
        },
        {
          n: 2, points: defs.length, title: 'Complete the following definitions/statements', kind: 'definitions',
          items: defs.map((id, i) => ({ id: `2.${i + 1}`, points: 1, prompt: this.DEF_PROMPTS[id], reference: this.defReference(id, data), defs: [id] }))
        },
        ...written.map((id, i) => this.writtenFromBank(problems.get(id), i + 3, data))
      ]
    };
  },

  // --- answers ---
  // Problem 1 response: { pick, other } — pick is an option index, 'other' ("(d) your variant") or true/false;
  // for a self-test task it is that task's response (index, [indices], bool or the typed number)
  itemAnswered(item, resp) {
    const pick = resp?.pick;
    if (item.task) return !!this.selfTest?.isAnswered(item.task, pick);
    if (pick === 'other') return String(resp.other || '').trim() !== '';
    return pick !== undefined && pick !== null;
  },

  // { done, total } for the problem chips
  progress(problem, answers = {}) {
    if (problem.kind === 'choice') {
      return { done: problem.items.filter(it => this.itemAnswered(it, answers.choice?.[it.id])).length, total: problem.items.length };
    }
    if (problem.kind === 'definitions') {
      return { done: problem.items.filter(it => String(answers.defs?.[it.id] || '').trim()).length, total: problem.items.length };
    }
    const done = !!answers.done?.[problem.n] || String(answers.notes?.[problem.n] || '').trim() !== '';
    return { done: done ? 1 : 0, total: 1 };
  },

  // Problem 1 grading: { status: right|wrong|partial|blank|check, points } — 'check' = a "(d) your variant" answer
  // waiting for the student's own check against the correct one (selfMark: 0 or the item's points)
  gradeChoice(item, resp, selfMark = null) {
    const pick = resp?.pick;
    const right = { status: 'right', points: item.points };
    const wrong = { status: 'wrong', points: 0 };
    if (!this.itemAnswered(item, resp)) return { status: 'blank', points: 0 };
    if (item.task) {
      const res = this.selfTest.grade(item.task, pick);
      const points = Math.floor(res.score * item.points * 2) / 2; // partial credit in half points
      return { status: res.correct ? 'right' : points > 0 ? 'partial' : 'wrong', points };
    }
    if (item.tf) return pick === item.answer ? right : wrong;
    if (item.answer === 'other') {
      if (pick !== 'other') return wrong;
      if (selfMark === null || selfMark === undefined) return { status: 'check', points: 0 };
      return selfMark > 0 ? { ...right, self: true } : { ...wrong, self: true };
    }
    return pick === item.answer ? right : wrong;
  },

  // Key of a written part in the marks map: "3a" (or "3" for a problem without parts)
  partKey(problem, part) {
    return `${problem.n}${part.label || ''}`;
  },

  // Self-grades come in half points between 0 and the maximum
  clampMark(value, max) {
    const v = Math.round(Number(value) * 2) / 2;
    return Number.isFinite(v) ? Math.min(Math.max(0, v), max) : 0;
  },

  // Everything the student still has to grade
  gradables(problem) {
    if (problem.kind === 'choice') return problem.items.filter(it => it.answer === 'other').map(it => ({ key: it.id, max: it.points, self: true }));
    if (problem.kind === 'definitions') return problem.items.map(it => ({ key: it.id, max: it.points }));
    return problem.parts.map(p => ({ key: this.partKey(problem, p), max: p.points }));
  },

  // Score of one problem and how many grades are still missing
  problemScore(problem, answers = {}, marks = {}) {
    let got = 0;
    let pending = 0;
    if (problem.kind === 'choice') {
      for (const it of problem.items) {
        const g = this.gradeChoice(it, answers.choice?.[it.id], marks[it.id]);
        got += g.points;
        if (g.status === 'check') pending++;
      }
    } else {
      for (const g of this.gradables(problem)) {
        const m = marks[g.key];
        if (m === null || m === undefined) pending++;
        else got += this.clampMark(m, g.max);
      }
    }
    return { n: problem.n, got, of: problem.points, pending };
  },

  totals(paper, answers = {}, marks = {}) {
    const perProblem = paper.problems.map(p => this.problemScore(p, answers, marks));
    const score = perProblem.reduce((s, r) => s + r.got, 0);
    const total = perProblem.reduce((s, r) => s + r.of, 0) || paper.totalPoints || this.TOTAL_POINTS;
    return {
      perProblem,
      score,
      total,
      percent: Math.round((score / total) * 100),
      pending: perProblem.reduce((s, r) => s + r.pending, 0)
    };
  },

  // "7.5", "8"
  formatPoints(x) {
    return Number.isInteger(x) ? String(x) : (Math.round(x * 2) / 2).toFixed(1);
  },

  // Theory behind a problem: the paper's own links, else the problem bank's (PS_DATA.PROBLEM_THEORY)
  theoryOf(problem, theory = {}) {
    const uniq = list => [...new Set(list.filter(x => x !== undefined && x !== null))];
    if (problem.kind === 'written') {
      const bank = theory[problem.bankId];
      return {
        defs: uniq(problem.defs?.length ? problem.defs : bank?.defs || []),
        notes: uniq(problem.notes?.length ? problem.notes : bank?.notes ? [bank.notes] : [])
      };
    }
    return { defs: uniq(problem.items.flatMap(it => it.defs || [])), notes: [] };
  },

  // Fully graded problems scored under 50%, with what to review
  weakSpots(paper, totals, theory = {}) {
    return totals.perProblem
      .filter(r => r.pending === 0 && r.of > 0 && r.got < r.of / 2)
      .map(r => {
        const problem = paper.problems.find(p => p.n === r.n);
        return { ...r, ...this.theoryOf(problem, theory), bankId: problem.bankId || null, title: problem.title || problem.origin || '' };
      });
  },

  // --- timer ---
  endsAt(session) {
    return session.startedAt + session.durationMin * 60000;
  },

  timeLeft(session, now) {
    return Math.max(0, this.endsAt(session) - now);
  },

  // ms → "1:19:59" / "9:05" (rounded up, so 0:00 only shows when time is really up)
  formatClock(ms) {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
  },

  // 'calm' | 'soon' (≤ 10 min) | 'last' (≤ 1 min)
  stage(msLeft) {
    if (msLeft <= this.WARNINGS[1] * 60000) return 'last';
    if (msLeft <= this.WARNINGS[0] * 60000) return 'soon';
    return 'calm';
  },

  // The warning due now, once: { minutes, warned } — after a reopen only the most urgent one is shown
  dueWarning(msLeft, warned = []) {
    const crossed = this.WARNINGS.filter(m => msLeft <= m * 60000);
    const fresh = crossed.filter(m => !warned.includes(m));
    if (!fresh.length) return null;
    return { minutes: Math.min(...fresh), warned: [...new Set([...warned, ...crossed])] };
  },

  // Time spent writing; a paper handed in late (page closed) counts the full duration only
  usedMs(session, finishedAt) {
    return Math.max(0, Math.min(finishedAt, this.endsAt(session)) - session.startedAt);
  },

  // --- sessions and attempts ---
  newSession({ paper, title, durationMin, picks = null, now, rand = Math.random }) {
    return {
      v: 1,
      id: `mm-${now.toString(36)}${Math.floor(rand() * 1296).toString(36).padStart(2, '0')}`,
      paper,
      title,
      ...(picks ? { picks } : {}),
      durationMin,
      startedAt: now,
      phase: 'exam',
      answers: { choice: {}, defs: {}, notes: {}, done: {} },
      marks: {},
      warned: []
    };
  },

  // A session read back from localStorage must look like one
  validSession(s) {
    return !!s && typeof s === 'object' && s.v === 1 && typeof s.id === 'string' && ['exam', 'review'].includes(s.phase) &&
      Number.isFinite(s.startedAt) && this.DURATIONS.includes(s.durationMin) && typeof s.paper === 'string' &&
      (s.paper !== 'new' || Array.isArray(s.picks?.choice)) && !!s.answers && typeof s.answers === 'object';
  },

  // What mockAttempts[id] keeps: enough to list it and to review it read-only on any device
  attemptRecord(session, paper, totals) {
    return {
      id: session.id,
      paper: session.paper,
      title: paper.title,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      durationMin: session.durationMin,
      usedMs: this.usedMs(session, session.finishedAt),
      timedOut: !!session.timedOut,
      score: totals.score,
      total: totals.total,
      perProblem: totals.perProblem.map(r => ({ n: r.n, got: r.got, of: r.of })),
      ...(session.picks ? { picks: session.picks } : {}),
      answers: session.answers,
      marks: session.marks
    };
  },

  // Finished attempts, newest first
  history(attempts = {}) {
    return Object.values(attempts || {})
      .filter(a => a && typeof a === 'object' && Number.isFinite(a.finishedAt) && Number.isFinite(a.score))
      .sort((a, b) => b.finishedAt - a.finishedAt);
  },

  // The best share of points (the earlier attempt wins a tie)
  bestId(attempts = {}) {
    let best = null;
    for (const a of this.history(attempts)) {
      const share = a.score / (a.total || this.TOTAL_POINTS);
      if (!best || share > best.share || (share === best.share && a.finishedAt < best.at)) best = { id: a.id, share, at: a.finishedAt };
    }
    return best?.id || null;
  }
};

class MockMidterm {
  get container() { return document.getElementById('mock-container'); }
  init() {}
  show() {
    if (this.container) this.container.innerHTML = '<p class="text-sm text-slate-400">Mock midterm: coming in the next build.</p>';
  }
  openPaper(id, { fromRoute = false } = {}) {
    window.app?.switchTab('mock', { fromRoute });
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockMidtermLogic };
} else {
  window.MockMidtermLogic = MockMidtermLogic;
  window.mockMidterm = new MockMidterm();
}
