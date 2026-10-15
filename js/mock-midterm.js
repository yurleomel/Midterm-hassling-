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

// ========================================================
// UI: start screen (format, paper, duration, history) → exam (sticky timer, problem chips, answers) →
// grading (auto-graded problem 1, self-grades with lecture quotes and our solutions) → saved attempt.
// Plus the 2017 paper without a timer. The exam in progress lives in localStorage, so a refresh or a
// closed tab never loses it, and the timer always counts from startedAt.
// ========================================================
class MockMidterm {
  constructor() {
    this.view = 'start';           // start | exam | review | attempt | paper
    this.pick = { paper: null, duration: MockMidtermLogic.DEFAULT_DURATION };
    this.session = null;           // the exam in progress, or a finished one not graded and saved yet
    this.attemptId = null;         // the saved attempt shown read-only
    this.paperId = null;           // the paper shown without a timer
    this.opened = new Set();       // ...and which of its solutions are open
    this.confirm = null;           // inline question: 'finish' | 'discard' | 'save'
    this.warning = null;           // { minutes, until }: the gentle 10- and 1-minute warnings
    this.notice = null;            // { tone, text }: one message on top of the next screen
    this.ticker = null;
    this.saveTimer = null;
    this.paperCache = new Map();
  }

  get L() { return MockMidtermLogic; }
  get container() { return document.getElementById('mock-container'); }
  get papers() { return window.MIDTERM_PAPERS || {}; }
  get attempts() { return window.quizManager?.readinessState?.mockAttempts || {}; }
  get visible() { return !document.getElementById('tab-mock')?.classList.contains('hidden'); }
  get data() {
    const ps = window.PS_DATA || {};
    return { bank: window.SELFTEST_BANK, problems: ps.PROBLEMS_BANK || [], defs: ps.DEFINITIONS_21 || [], prep: window.MIDTERM_PREP, theory: ps.PROBLEM_THEORY || {} };
  }

  // --- persistence: the session in localStorage, finished attempts in the readiness state ---
  loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(MockMidterm.STORAGE_KEY) || 'null');
      return this.L.validSession(s) ? s : null;
    } catch (e) {
      return null;
    }
  }

  persist() {
    clearTimeout(this.saveTimer);
    try {
      if (this.session) localStorage.setItem(MockMidterm.STORAGE_KEY, JSON.stringify(this.session));
      else localStorage.removeItem(MockMidterm.STORAGE_KEY);
    } catch (e) {}
  }

  persistSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.persist(), 250);
  }

  paperOf(kind, picks) {
    if (kind !== 'new') return this.papers[kind] || null;
    const key = JSON.stringify(picks || {});
    if (!this.paperCache.has(key)) this.paperCache.set(key, this.L.paperFromPicks(picks, this.data));
    return this.paperCache.get(key);
  }

  get sessionPaper() {
    return this.session ? this.paperOf(this.session.paper, this.session.picks) : null;
  }

  paperLabel(kind, fallback = '') {
    return { 2017: 'Practice paper 2017', new: 'New mock paper' }[kind] || fallback || 'Practice paper';
  }

  // --- lifecycle (called by js/app.js) ---
  init() {
    const host = this.container;
    if (host && !host.dataset.mmBound) {
      host.dataset.mmBound = 'true';
      host.addEventListener('click', e => this.onClick(e));
      host.addEventListener('input', e => this.onInput(e));
      document.addEventListener('visibilitychange', () => { if (!document.hidden) this.tick(); });
      // The same exam open in two tabs: follow the other tab's changes (finish, discard, save)
      window.addEventListener('storage', e => {
        if (e.key !== MockMidterm.STORAGE_KEY) return;
        this.session = this.loadSession();
        if (this.session?.phase === 'exam') this.startTicker();
        else this.stopTicker();
        this.show();
      });
    }
    this.session = this.loadSession();
    this.view = this.session ? (this.session.phase === 'exam' ? 'exam' : 'review') : 'start';
    if (this.session?.phase === 'exam') this.startTicker(); // hands the paper in at once if time ran out while away
    this.render();
  }

  // Opening the tab: an exam in progress comes first, then a result waiting to be graded, else the start screen
  show() {
    this.notice = null;
    this.confirm = null;
    this.view = this.session?.phase === 'exam' ? 'exam' : this.session?.phase === 'review' ? 'review' : 'start';
    this.render();
  }

  // #/mock/<paper> (the paper without a timer, optionally at problem N) or #/mock/<attempt id> (read-only review)
  openPaper(id, { fromRoute = false, problem = null } = {}) {
    window.app?.switchTab('mock', { fromRoute });
    const key = String(id ?? '');
    if (this.session?.phase === 'exam') {
      this.notice = { tone: 'amber', text: 'Your mock is still running. Finish it or discard it before you open a paper with its solutions.' };
      this.render();
      window.app?.setRoute('mock', { replace: true });
      return;
    }
    if (key.startsWith('mm-')) return this.openAttempt(key, { replace: true });
    if (this.papers[key]) {
      this.view = 'paper';
      this.paperId = key;
      this.opened = new Set();
      this.render();
      if (!fromRoute) window.app?.setRoute(`mock/${encodeURIComponent(key)}`, { replace: true });
      if (problem) this.scrollToProblem(Number(problem), { highlight: true });
      return;
    }
    this.notice = { tone: 'amber', text: key === '2017' ? 'The 2017 paper is still being transcribed, so it is not in the app yet. A new mock paper is ready meanwhile.' : `There is no paper “${key}” in the app.` };
    this.render();
    window.app?.setRoute('mock', { replace: true });
  }

  openAttempt(id, { replace = false } = {}) {
    if (!this.attempts[id]) {
      this.view = 'start';
      this.notice = { tone: 'amber', text: 'That attempt is not saved on this device.' };
      this.render();
      window.app?.setRoute('mock', { replace: true });
      return;
    }
    this.view = 'attempt';
    this.attemptId = id;
    this.confirm = null;
    this.render();
    window.app?.setRoute(`mock/${encodeURIComponent(id)}`, { replace });
    window.scrollTo({ top: 0 });
  }

  goStart({ route = true } = {}) {
    this.view = 'start';
    this.confirm = null;
    this.render();
    if (route) window.app?.setRoute('mock');
    window.scrollTo({ top: 0 });
  }

  // --- the exam ---
  start() {
    const L = this.L;
    const kind = this.pick.paper === '2017' && this.papers['2017'] ? '2017' : 'new';
    const now = Date.now();
    const picks = kind === 'new' ? L.pickMock((now ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0, this.data) : null;
    const paper = this.paperOf(kind, picks);
    if (!paper?.problems?.length) {
      this.notice = { tone: 'rose', text: 'This paper could not be put together: its data did not load. Reload the page and try again.' };
      return this.render();
    }
    this.session = L.newSession({ paper: kind, title: paper.title, durationMin: this.pick.duration, picks, now });
    this.persist();
    this.view = 'exam';
    this.notice = null;
    this.confirm = null;
    this.warning = null;
    this.render();
    this.startTicker();
    window.app?.setRoute('mock', { replace: true });
    window.scrollTo({ top: 0 });
  }

  finish({ timedOut = false } = {}) {
    const s = this.session;
    if (!s || s.phase !== 'exam') return;
    clearTimeout(this.saveTimer);
    s.phase = 'review';
    s.finishedAt = timedOut ? this.L.endsAt(s) : Date.now();
    s.timedOut = timedOut;
    s.marks = s.marks || {};
    this.persist();
    this.stopTicker();
    this.setNavClock(null);
    window.formulaSheet?.close?.(); // the exam's sheet does not close itself
    this.confirm = null;
    this.warning = null;
    this.notice = null;
    this.view = 'review';
    this.render();
    if (this.visible) window.scrollTo({ top: 0 });
  }

  discard() {
    if (this.session?.phase === 'exam') window.formulaSheet?.close?.();
    this.session = null;
    this.persist();
    this.stopTicker();
    this.setNavClock(null);
    this.confirm = null;
    this.warning = null;
    this.notice = { tone: 'slate', text: 'The attempt was discarded. Nothing was saved.' };
    this.goStart();
  }

  saveResult({ force = false } = {}) {
    const s = this.session;
    const paper = this.sessionPaper;
    if (!s || s.phase !== 'review' || !paper) return;
    const totals = this.L.totals(paper, s.answers, s.marks);
    if (totals.pending && !force) {
      this.confirm = 'save';
      return this.refreshReview();
    }
    const qm = window.quizManager;
    if (!qm?.readinessState) {
      this.notice = { tone: 'rose', text: 'The result could not be saved: your progress has not loaded. Reload the page; the graded paper waits for you.' };
      return this.render();
    }
    const record = this.L.attemptRecord(s, paper, totals);
    qm.readinessState.mockAttempts = { ...(qm.readinessState.mockAttempts || {}), [record.id]: record };
    qm.saveReadiness();
    window.rewards?.notify?.('mock', { id: record.id, score: record.score, total: record.total }); // rewards: points + Dress Rehearsal
    this.session = null;
    this.persist();
    this.confirm = null;
    this.notice = { tone: 'emerald', text: `Saved: ${this.L.formatPoints(record.score)} / ${record.total}. You will find it under “Your attempts”, and the mock midterm task of the study plan is ticked off.` };
    this.openAttempt(record.id, { replace: true });
  }

  // --- timer ---
  startTicker() {
    if (!this.ticker) this.ticker = setInterval(() => this.tick(), 1000);
    this.tick();
  }

  stopTicker() {
    clearInterval(this.ticker);
    this.ticker = null;
  }

  tick() {
    const s = this.session;
    if (!s || s.phase !== 'exam') {
      this.stopTicker();
      this.setNavClock(null);
      return;
    }
    const left = this.L.timeLeft(s, Date.now());
    if (left <= 0) return this.finish({ timedOut: true });
    const due = this.L.dueWarning(left, s.warned || []);
    if (due) {
      s.warned = due.warned;
      this.persist();
      this.warning = { minutes: due.minutes, until: Date.now() + 15000 };
      this.renderBarMessage();
    } else if (this.warning && this.warning.until <= Date.now()) {
      this.warning = null;
      this.renderBarMessage();
    }
    this.paintClock(left);
  }

  paintClock(left) {
    const clock = document.getElementById('mm-clock');
    if (clock) {
      clock.querySelector('[data-mm-time]').textContent = this.L.formatClock(left);
      clock.dataset.stage = this.L.stage(left);
    }
    this.setNavClock(left);
  }

  // The time left also shows next to "Mock midterm" in the sidebar while the exam runs
  setNavClock(left) {
    const btn = document.querySelector('[data-tab-target="mock"]');
    if (!btn) return;
    let meta = btn.querySelector('.mm-nav-clock');
    if (left === null || left === undefined) return meta?.remove();
    if (!meta) {
      meta = document.createElement('span');
      meta.className = 'nav-meta mm-nav-clock';
      meta.title = 'Mock midterm in progress: time left';
      btn.appendChild(meta);
    }
    meta.textContent = this.L.formatClock(left);
    meta.dataset.stage = this.L.stage(left);
  }

  // --- events (one delegated listener per kind; the screens re-render freely) ---
  onClick(e) {
    const el = e.target.closest('[data-mm-act]');
    if (!el || el.disabled || !this.container.contains(el)) return;
    const d = el.dataset;
    const act = {
      paper: () => { this.pick.paper = d.value; this.render(); },
      duration: () => { this.pick.duration = Number(d.value); this.render(); },
      start: () => this.start(),
      // During the exam the sheet is locked to its unlabelled view, as handed out; before and after it opens as asked
      sheet: () => window.formulaSheet?.open?.(d.mode === 'exam' ? { mode: 'exam', locked: true, opener: el } : { mode: d.mode }),
      attempt: () => this.openAttempt(d.id),
      'open-paper': () => this.openPaper(d.id),
      home: () => { this.notice = null; this.goStart(); },
      'sit-again': () => { this.pick.paper = d.id; this.notice = null; this.goStart(); },
      continue: () => { this.view = 'review'; this.notice = null; this.render(); window.scrollTo({ top: 0 }); },
      'ask-finish': () => {
        this.confirm = this.L.timeLeft(this.session, Date.now()) > 0 ? 'finish' : null;
        if (this.confirm) this.renderBarMessage(); else this.finish();
      },
      'ask-discard': () => { this.confirm = 'discard'; this.view === 'exam' ? this.renderBarMessage() : this.render(); },
      cancel: () => { this.confirm = null; this.view === 'exam' ? this.renderBarMessage() : this.view === 'review' ? this.refreshReview() : this.render(); },
      finish: () => this.finish(),
      discard: () => this.discard(),
      goto: () => this.scrollToProblem(Number(d.n)),
      pick: () => this.pickAnswer(d.item, d.value),
      done: () => this.toggleDone(Number(d.n)),
      mark: () => this.setMark(d.key, Number(d.value)),
      step: () => this.stepMark(d.key, Number(d.delta)),
      save: () => this.saveResult(),
      'save-anyway': () => this.saveResult({ force: true }),
      solution: () => this.toggleSolution(Number(d.n)),
      def: () => window.app?.openDefinition(Number(d.id)),
      notes: () => window.app?.openTopic(d.id),
      problem: () => window.app?.openProblem(Number(d.id))
    }[d.mmAct];
    act?.();
  }

  onInput(e) {
    const el = e.target;
    const kind = el.dataset?.mmInput;
    const s = this.session;
    if (!kind || !s || s.phase !== 'exam') return;
    const a = s.answers;
    const id = el.dataset.item;
    if (kind === 'other') a.choice[id] = { ...(a.choice[id] || {}), pick: 'other', other: el.value };
    else if (kind === 'numeric') a.choice[id] = { pick: el.value };
    else if (kind === 'def') a.defs[id] = el.value;
    else if (kind === 'notes') a.notes[el.dataset.n] = el.value;
    this.persistSoon();
    this.renderChips();
  }

  findItem(itemId, paper = this.sessionPaper) {
    for (const p of paper?.problems || []) {
      const it = (p.items || []).find(x => x.id === itemId);
      if (it) return it;
    }
    return null;
  }

  pickAnswer(itemId, raw) {
    const s = this.session;
    const item = this.findItem(itemId);
    if (!s || s.phase !== 'exam' || !item) return;
    const prev = s.answers.choice[itemId] || {};
    let pick;
    if (item.task?.format === 'multi') {
      const i = Number(raw);
      const cur = Array.isArray(prev.pick) ? prev.pick : [];
      pick = cur.includes(i) ? cur.filter(x => x !== i) : [...cur, i];
    } else {
      pick = raw === 'true' ? true : raw === 'false' ? false : raw === 'other' ? 'other' : Number(raw);
      if (prev.pick === pick) pick = null; // a second tap clears the choice
    }
    s.answers.choice[itemId] = { ...prev, pick };
    this.persist();
    this.refreshItem(itemId);
    this.renderChips();
    if (pick === 'other') document.querySelector(`[data-mm-input="other"][data-item="${CSS.escape(itemId)}"]`)?.focus();
  }

  toggleDone(n) {
    const s = this.session;
    if (!s || s.phase !== 'exam') return;
    s.answers.done = { ...(s.answers.done || {}), [n]: !s.answers.done?.[n] };
    this.persist();
    const slot = document.getElementById(`mm-done-${n}`);
    if (slot) slot.innerHTML = this.doneButtonHtml(n);
    this.renderChips();
  }

  gradeIndex(paper) {
    const out = {};
    for (const p of paper.problems) for (const g of this.L.gradables(p)) out[g.key] = { ...g, problem: p };
    return out;
  }

  setMark(key, value) {
    const s = this.session;
    const g = s?.phase === 'review' ? this.gradeIndex(this.sessionPaper)[key] : null;
    if (!g) return;
    s.marks = { ...s.marks, [key]: this.L.clampMark(value, g.max) };
    if (this.confirm === 'save' && !this.L.totals(this.sessionPaper, s.answers, s.marks).pending) this.confirm = null;
    this.persist();
    this.refreshReview(key);
  }

  stepMark(key, delta) {
    const cur = this.session?.marks?.[key];
    this.setMark(key, (cur === null || cur === undefined ? (delta > 0 ? 0 : 0.5) : cur) + delta);
  }

  toggleSolution(n) {
    if (this.opened.has(n)) this.opened.delete(n);
    else this.opened.add(n);
    const paper = this.papers[this.paperId];
    const p = paper?.problems.find(x => x.n === n);
    const el = document.getElementById(`mm-p-${n}`);
    if (!p || !el) return;
    el.outerHTML = this.problemHtml(p, { mode: 'paper', paper, answers: {}, marks: {}, open: this.opened });
    this.renderMath(document.getElementById(`mm-p-${n}`));
  }

  scrollToProblem(n, { highlight = false } = {}) {
    const el = document.getElementById(`mm-p-${n}`);
    if (!el) return;
    requestAnimationFrame(() => {
      const bar = this.view === 'exam' ? document.getElementById('mm-bar') : null;
      const offset = 56 + 12 + (bar ? bar.offsetHeight + 8 : 0);
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - offset), behavior: 'smooth' });
      if (highlight) {
        el.classList.remove('nav-landed');
        void el.offsetWidth; // restart the highlight animation
        el.classList.add('nav-landed');
        setTimeout(() => el.classList.remove('nav-landed'), 1600);
      }
    });
  }

  // --- rendering helpers ---
  esc(s) { return this.L.esc(s); }
  fmt(x) { return this.L.formatPoints(x); }
  when(ts) { return new Date(ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  clockTime(ts) { return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  minutes(ms) { return ms < 60000 ? 'under a minute' : `${Math.round(ms / 60000)} min`; }
  renderMath(el) { if (el) window.app?.renderAllMath?.(el); }
  defName(id) { return this.data.defs.find(d => d.id === id)?.name || `Definition ${id}`; }
  noteLabel(id) {
    const n = (window.PS_DATA?.TOPICS_NOTES || []).find(t => t.id === id);
    return n ? `Topic ${n.number} notes` : 'Topic notes';
  }
  get hasSheet() { return typeof window.formulaSheet?.open === 'function'; }

  // Self-test task text and options, rendered exactly as in the LMS self-test drill (js/selftest-bank.js)
  taskQuestion(task) {
    const stb = window.selfTestBank;
    return stb?.renderQuestion ? stb.renderQuestion(task) : this.esc(task.question).replace(/\n/g, '<br>');
  }
  taskOption(text) {
    const stb = window.selfTestBank;
    return stb?.optionHtml ? stb.optionHtml(text) : this.esc(text);
  }

  noticeHtml() {
    const n = this.notice;
    if (!n) return '';
    const tone = {
      emerald: ['circle-check', 'bg-emerald-950/50 border-emerald-800 text-emerald-200'],
      amber: ['circle-alert', 'bg-amber-950/40 border-amber-800 text-amber-200'],
      rose: ['triangle-alert', 'bg-rose-950/40 border-rose-800 text-rose-200'],
      slate: ['info', 'bg-slate-900 border-slate-800 text-slate-300']
    }[n.tone] || ['info', 'bg-slate-900 border-slate-800 text-slate-300'];
    return `<div class="flex items-start gap-2 p-3.5 rounded-xl border text-sm ${tone[1]}" role="status">${icon(tone[0], 'mt-0.5 shrink-0')}<span>${this.esc(n.text)}</span></div>`;
  }

  linkButtons({ defs = [], notes = [], bankId = null } = {}) {
    const cls = MockMidterm.CLS.link;
    return [
      ...defs.map(id => `<button type="button" class="${cls}" data-mm-act="def" data-id="${id}"><span class="font-bold text-indigo-400">#${id}</span> ${this.esc(this.defName(id))}</button>`),
      ...notes.map(id => `<button type="button" class="${cls}" data-mm-act="notes" data-id="${this.esc(id)}">${icon('book-open')} ${this.esc(this.noteLabel(id))}</button>`),
      ...(bankId ? [`<button type="button" class="${cls}" data-mm-act="problem" data-id="${bankId}">${icon('notebook-pen')} Problem ${bankId} in Exam problems</button>`] : [])
    ].join('');
  }

  // --- screens ---
  render() {
    const host = this.container;
    if (!host) return;
    if (this.view === 'exam' && this.session?.phase !== 'exam') this.view = 'start';
    if (this.view === 'review' && this.session?.phase !== 'review') this.view = 'start';
    const screens = { start: 'startHtml', exam: 'examHtml', review: 'reviewHtml', attempt: 'attemptHtml', paper: 'paperHtml' };
    host.innerHTML = this[screens[this.view] || 'startHtml']();
    this.renderMath(host);
    if (this.view === 'exam') this.tick();
  }

  startHtml() {
    const C = MockMidterm.CLS;
    const L = this.L;
    const has2017 = !!this.papers['2017'];
    if (!this.pick.paper || (this.pick.paper === '2017' && !has2017)) this.pick.paper = has2017 ? '2017' : 'new';
    const history = L.history(this.attempts);
    const bestId = history.length > 1 ? L.bestId(this.attempts) : null;
    const s = this.session;

    const block = (n, pts, title, how) => `
      <div class="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
        <div class="flex items-baseline justify-between gap-2">
          <span class="text-sm font-bold text-slate-100">${n.includes('–') ? 'Problems' : 'Problem'} ${n}</span>
          <span class="text-xs font-semibold text-indigo-400 tabular-nums">${pts}</span>
        </div>
        <div class="text-sm text-slate-200 mt-0.5">${title}</div>
        <div class="text-xs text-slate-400 mt-0.5">${how}</div>
      </div>`;
    const step = (n, title, hint = '') => `
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 mb-2">
        <span class="w-5 h-5 shrink-0 rounded-full bg-indigo-950 border border-indigo-800 text-indigo-300 text-[11px] font-bold inline-flex items-center justify-center">${n}</span>
        <span class="text-sm font-bold text-slate-100">${title}</span>
        ${hint ? `<span class="text-xs text-slate-400">${hint}</span>` : ''}
      </div>`;
    const paperCard = (id, iconName, title, badge, sub, available) => {
      const on = this.pick.paper === id;
      const look = !available ? 'border-slate-800 bg-slate-950/40 cursor-not-allowed opacity-75'
        : on ? 'border-indigo-500 bg-indigo-950/50 ring-1 ring-indigo-500/50 cursor-pointer' : 'border-slate-800 bg-slate-950/40 hover:border-slate-600 cursor-pointer';
      return `<button type="button" data-mm-act="paper" data-value="${id}" aria-pressed="${on}" ${available ? '' : 'disabled aria-disabled="true"'}
          class="flex flex-col items-start gap-1 text-left p-3.5 rounded-xl border transition ${look}">
          <span class="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-100">${icon(iconName, on ? 'text-indigo-400' : 'text-slate-400')} ${title}
            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-slate-800 text-slate-300">${badge}</span></span>
          <span class="text-xs text-slate-400 leading-snug">${sub}</span>
        </button>`;
    };
    const durations = L.DURATIONS.map(m => {
      const on = this.pick.duration === m;
      return `<button type="button" data-mm-act="duration" data-value="${m}" aria-pressed="${on}" class="px-3 py-1.5 rounded-lg text-sm font-semibold tabular-nums cursor-pointer transition ${on ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}">${m} min</button>`;
    }).join('');

    const unsaved = s?.phase === 'review' ? `
      <div class="p-4 rounded-2xl bg-amber-950/40 border border-amber-800 flex flex-col sm:flex-row sm:items-center gap-3">
        <p class="flex-1 text-sm text-amber-200">${icon('hourglass')} <strong>Result not saved yet.</strong>
          ${this.confirm === 'discard' ? 'Discard it? The answers and the grades you gave are deleted, and nothing is saved.' : `You handed in the ${this.esc(this.paperLabel(s.paper, s.title))} at ${this.clockTime(s.finishedAt)} on ${new Date(s.finishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}. Grade it and save it to keep the score.`}</p>
        <div class="flex flex-wrap gap-2 shrink-0">${this.confirm === 'discard'
          ? `<button type="button" data-mm-act="cancel" class="${C.secondary}">Keep it</button><button type="button" data-mm-act="discard" class="${C.danger}">${icon('trash-2')} Discard</button>`
          : `<button type="button" data-mm-act="continue" class="${C.primary}">${icon('pen-line')} Continue grading</button><button type="button" data-mm-act="ask-discard" class="${C.secondary}">Discard</button>`}</div>
      </div>` : '';

    const rows = history.map(a => {
      const best = a.id === bestId;
      const pct = Math.round((a.score / (a.total || L.TOTAL_POINTS)) * 100);
      return `<button type="button" data-mm-act="attempt" data-id="${this.esc(a.id)}"
          class="w-full flex items-center gap-3 p-3 rounded-xl border text-left cursor-pointer transition ${best ? 'border-emerald-600 bg-emerald-950/30 hover:border-emerald-400' : 'border-slate-800 bg-slate-950/40 hover:border-indigo-500'}">
          <span class="flex-1 min-w-0">
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-100">${this.esc(this.paperLabel(a.paper, a.title))}
              ${best ? `<span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide bg-emerald-700 text-white">${icon('trophy')} Best</span>` : ''}</span>
            <span class="block text-xs text-slate-400 mt-0.5">${this.when(a.finishedAt)} · ${this.minutes(a.usedMs || 0)} of ${a.durationMin} min${a.timedOut ? ' · time ran out' : ''}</span>
          </span>
          <span class="text-right shrink-0">
            <span class="block text-sm font-black tabular-nums text-slate-100">${this.fmt(a.score)}<span class="font-semibold text-slate-400"> / ${a.total}</span></span>
            <span class="block text-xs font-semibold tabular-nums ${pct >= 50 ? 'text-emerald-400' : 'text-rose-400'}">${pct}%</span>
          </span>
          <span class="shrink-0 text-slate-400">${icon('chevron-right')}</span>
        </button>`;
    }).join('');

    return `
      <div class="space-y-5">
        ${this.noticeHtml()}
        ${unsaved}
        <div class="${C.card}">
          <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-400">Midterm 2 · topics 4–6</div>
          <h2 class="text-2xl font-black text-slate-100 mt-0.5">Mock midterm</h2>
          <p class="text-sm text-slate-300 mt-1.5 leading-relaxed max-w-2xl">A full practice run of Midterm 2 against the clock. As at the real exam it is closed book: you write your solutions on paper and get only the formula sheet. When you hand in, you grade your work against worked solutions.</p>
          <div class="mm-grid grid sm:grid-cols-3 gap-2 mt-4">
            ${block('1', '5 pts', 'Multiple choice & true/false', 'Answer here, in the app.')}
            ${block('2', '5 pts', 'Complete five definitions', 'Type them here or write them on paper.')}
            ${block('3–6', '10 pts each', 'Written problems', 'Solve on paper and show your work.')}
          </div>
          <p class="text-xs text-slate-400 mt-2.5">6 problems · 50 points, the format of the 2017 practice paper.</p>
        </div>

        <div class="${C.card} space-y-5">
          <section>
            ${step(1, 'Choose a paper')}
            <div class="mm-grid grid sm:grid-cols-2 gap-2">
              ${paperCard('2017', 'file-text', 'Practice paper 2017', 'Verbatim', has2017 ? 'R.H., 22 March 2017: the real practice midterm, word for word.' : 'Not in the app yet: the paper is being transcribed.', has2017)}
              ${paperCard('new', 'shuffle', 'New mock paper', 'New each time', 'Put together now: 5 LMS self-test tasks, 5 of the 21 definitions and 4 exam problems, one per topic block.', true)}
            </div>
          </section>
          <section>
            ${step(2, 'Duration', 'a UCU class slot is 80 minutes')}
            <div class="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-950/60 border border-slate-800" role="group" aria-label="Duration">${durations}</div>
          </section>
          <div class="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
            <button type="button" data-mm-act="start" class="${C.primary}" ${s ? 'disabled' : ''}>${icon('play')} Start the mock</button>
            <p class="text-xs text-slate-400">${s ? 'Save or discard the result above before you start another one.' : 'The clock starts at once and keeps running if you leave the page or close it.'}</p>
          </div>
        </div>

        ${this.hasSheet ? `
        <div class="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-800/60 flex flex-col sm:flex-row sm:items-center gap-3">
          <p class="flex-1 text-sm text-slate-300">${icon('table', 'text-indigo-400')} <strong class="text-slate-100">The formula sheet comes without labels.</strong> At the exam you get the distribution table (p.m.f./p.d.f., m.g.f., mean, variance) with the names left off, so you have to recognise each row yourself.</p>
          <button type="button" data-mm-act="sheet" data-mode="drill" class="${C.secondary} shrink-0">${icon('target')} Practise naming the rows</button>
        </div>` : ''}

        <div class="${C.card}">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="text-base font-bold text-slate-100">${icon('history', 'text-slate-400')} Your attempts</h3>
            ${history.length ? `<span class="text-xs text-slate-400">${history.length} finished${bestId ? ` · best ${this.fmt(this.attempts[bestId].score)} / ${this.attempts[bestId].total}` : ''}</span>` : ''}
          </div>
          ${history.length ? `<div class="mt-3 space-y-2">${rows}</div>`
            : '<p class="mt-2 text-sm text-slate-400">No attempts yet. Each mock you finish and save shows up here with its score and the time you used, and opens again for review.</p>'}
        </div>

        <div class="${C.card} flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex-1">
            <h3 class="text-base font-bold text-slate-100">${icon('book-open', 'text-slate-400')} Review the 2017 paper (no timer)</h3>
            <p class="text-xs text-slate-400 mt-1">${has2017 ? 'Read the problems and open our worked solutions one problem at a time. It gives the paper away, so sit it as a timed mock first if you want a fair score.' : 'Available as soon as the 2017 paper is transcribed.'}</p>
          </div>
          <button type="button" data-mm-act="open-paper" data-id="2017" class="${C.secondary} shrink-0" ${has2017 ? '' : 'disabled'}>Open the paper ${icon('arrow-right')}</button>
        </div>
      </div>`;
  }

  examHtml() {
    const C = MockMidterm.CLS;
    const s = this.session;
    const paper = this.sessionPaper;
    if (!paper) {
      return `<div class="${C.card} space-y-3">${this.noticeHtml()}
        <p class="text-sm text-slate-300">The paper of this attempt could not be loaded, so it cannot go on.</p>
        <button type="button" data-mm-act="discard" class="${C.secondary}">${icon('trash-2')} Discard the attempt</button></div>`;
    }
    const ctx = { mode: 'exam', paper, answers: s.answers, marks: {} };
    const left = this.L.timeLeft(s, Date.now());
    return `
      <div class="space-y-4">
        ${this.noticeHtml()}
        <div id="mm-bar" class="sticky top-14 z-30 p-3 rounded-2xl bg-slate-900/95 backdrop-blur border border-slate-700 shadow-lg">
          <div class="flex items-center gap-2">
            <span id="mm-clock" class="mm-clock inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-slate-100 text-base font-bold" data-stage="${this.L.stage(left)}" role="timer" aria-label="Time left">
              ${icon('timer')}<span data-mm-time class="tabular-nums">${this.L.formatClock(left)}</span></span>
            <span class="hidden md:inline text-xs text-slate-400">left of ${s.durationMin} min</span>
            <div class="ml-auto flex items-center gap-2">
              ${this.hasSheet ? `<button type="button" data-mm-act="sheet" data-mode="exam" class="${C.secondarySm}" title="The distribution table exactly as handed out at the exam, without its labels"><span class="hidden sm:inline-flex">${icon('table')}</span><span class="hidden sm:inline">Formula sheet (as at the exam)</span><span class="sm:hidden">Formula sheet</span></button>` : ''}
              <button type="button" data-mm-act="ask-finish" class="${C.primarySm}"><span class="hidden sm:inline-flex">${icon('flag')}</span>Finish</button>
            </div>
          </div>
          <nav id="mm-chips" class="flex flex-wrap items-center gap-1.5 mt-2.5" aria-label="Problems">${this.chipsHtml(paper, s.answers)}</nav>
          <div id="mm-bar-msg" aria-live="polite">${this.barMessageHtml()}</div>
        </div>

        <div class="${C.card}">
          <div class="text-xs text-slate-400">${this.esc(paper.generated ? `Put together on ${this.when(s.startedAt)} from the module-2 materials` : [paper.course, paper.author, paper.date].filter(Boolean).join(' · '))}</div>
          <h2 class="text-xl font-black text-slate-100 mt-0.5">${this.esc(paper.title)}</h2>
          <p class="text-xs text-slate-400 mt-1.5 leading-relaxed">${paper.problems.length} problems · ${this.L.totals(paper).total} points · ${s.durationMin} minutes · closed book. Answer problem 1 here. Problem 2 you can type or write on paper. Solve problems 3–6 on paper.</p>
        </div>

        ${paper.problems.map(p => this.problemHtml(p, ctx)).join('')}

        <div class="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1">
          <button type="button" data-mm-act="ask-discard" class="${C.ghostDanger}">${icon('trash-2')} Discard this attempt</button>
          <button type="button" data-mm-act="ask-finish" class="${C.primary}">${icon('flag')} Finish and grade</button>
        </div>
      </div>`;
  }

  chipsHtml(paper, answers) {
    return paper.problems.map(p => {
      const { done, total } = this.L.progress(p, answers);
      const full = done === total;
      const some = done > 0 && !full;
      const state = full ? 'answered' : some ? `${done} of ${total} answered` : 'not answered yet';
      const look = full ? 'border-emerald-600 bg-emerald-950/50 text-emerald-300 hover:border-emerald-400'
        : some ? 'border-amber-600 bg-amber-950/30 text-amber-300 hover:border-amber-400'
        : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-indigo-500';
      return `<button type="button" data-mm-act="goto" data-n="${p.n}" title="Problem ${p.n}: ${state}" aria-label="Problem ${p.n}: ${state}"
        class="inline-flex items-center justify-center gap-1 h-9 min-w-[2.25rem] px-2 rounded-lg border text-sm font-bold tabular-nums cursor-pointer transition ${look}">${p.n}${full ? icon('check') : some ? `<span class="text-[10px] font-semibold">${done}/${total}</span>` : ''}</button>`;
    }).join('');
  }

  renderChips() {
    const el = document.getElementById('mm-chips');
    if (el && this.session) el.innerHTML = this.chipsHtml(this.sessionPaper, this.session.answers);
  }

  barMessageHtml() {
    const C = MockMidterm.CLS;
    const panel = (tone, text, buttons = '') => `<div class="mt-2.5 p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 ${tone}">
      <p class="flex-1 text-sm">${text}</p>${buttons ? `<div class="flex flex-wrap gap-2 shrink-0">${buttons}</div>` : ''}</div>`;
    if (this.confirm === 'finish') {
      const left = Math.ceil(this.L.timeLeft(this.session, Date.now()) / 60000);
      return panel('bg-indigo-950/40 border-indigo-800 text-slate-200', `<strong>Hand in now?</strong> You still have ${left} min. After this you grade your work, and the answers can't be changed.`,
        `<button type="button" data-mm-act="cancel" class="${C.secondarySm}">Keep working</button><button type="button" data-mm-act="finish" class="${C.primarySm}">${icon('flag')} Hand in</button>`);
    }
    if (this.confirm === 'discard') {
      return panel('bg-rose-950/40 border-rose-800 text-rose-200', '<strong>Discard this attempt?</strong> Your answers are deleted and no result is saved.',
        `<button type="button" data-mm-act="cancel" class="${C.secondarySm}">Keep it</button><button type="button" data-mm-act="discard" class="${C.dangerSm}">${icon('trash-2')} Discard</button>`);
    }
    if (this.warning && this.warning.until > Date.now()) {
      return this.warning.minutes === 1
        ? panel('bg-rose-950/40 border-rose-800 text-rose-200', `${icon('alarm-clock')} <strong>1 minute left.</strong> Make sure every answer in problem 1 is marked.`)
        : panel('bg-amber-950/40 border-amber-800 text-amber-200', `${icon('alarm-clock')} <strong>10 minutes left.</strong> Time to check your answers and wrap up the problem you are on.`);
    }
    return '';
  }

  renderBarMessage() {
    const el = document.getElementById('mm-bar-msg');
    if (el) el.innerHTML = this.barMessageHtml();
  }

  refreshItem(itemId) {
    const el = document.getElementById(`mm-i-${itemId}`);
    const item = this.findItem(itemId);
    if (!el || !item) return;
    const ctx = { mode: this.view === 'exam' ? 'exam' : 'review', paper: this.sessionPaper, answers: this.session.answers, marks: this.session.marks || {} };
    el.innerHTML = this.choiceItemInner(item, ctx);
    this.renderMath(el);
  }

  // --- one problem, in any of the four modes: exam · review (grading) · attempt (read-only) · paper (no timer) ---
  problemHtml(p, ctx) {
    const C = MockMidterm.CLS;
    const graded = ctx.mode === 'review' || ctx.mode === 'attempt';
    const open = ctx.mode === 'paper' && ctx.open?.has(p.n);
    const head = `
      <header class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-2">
        <h3 class="text-lg font-bold text-slate-100">Problem ${p.n} <span class="text-sm font-semibold text-slate-400 tabular-nums">(${p.points} pt)</span>${p.title ? `<span class="font-semibold text-slate-300">. ${this.esc(p.title)}</span>` : ''}</h3>
        ${graded ? `<span id="mm-ps-${p.n}">${this.problemScoreHtml(p, ctx)}</span>` : ''}
        ${ctx.mode === 'paper' ? `<button type="button" data-mm-act="solution" data-n="${p.n}" aria-expanded="${open}" class="${C.secondarySm}">${icon(open ? 'eye-off' : 'eye')} ${open ? 'Hide the solution' : 'Show our solution'}</button>` : ''}
      </header>`;
    const origin = graded && p.origin ? `
      <p class="mt-1 text-xs text-slate-400">${p.origin ? `From the exam problems: <span class="text-slate-300">${this.esc(p.origin)}</span>${p.source ? ` (${this.esc(p.source)})` : ''}.` : ''}</p>` : '';
    let body = '';
    if (p.kind === 'choice') body = `<div class="space-y-5 mt-3">${p.items.map(it => `<div id="mm-i-${it.id}">${this.choiceItemInner(it, { ...ctx, open })}</div>`).join('')}</div>`;
    else if (p.kind === 'definitions') body = `<div class="space-y-5 mt-3">${p.items.map(it => `<div id="mm-i-${it.id}">${this.defItemInner(it, { ...ctx, open })}</div>`).join('')}</div>`;
    else body = this.writtenInner(p, { ...ctx, open });
    const theory = (graded || open) ? this.L.theoryOf(p, this.data.theory) : null;
    const links = theory && (theory.defs.length || theory.notes.length || p.bankId) ? `
      <div class="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center gap-1.5 text-xs">
        <span class="font-semibold text-slate-400 mr-0.5">${icon('book-open')} Theory:</span>${this.linkButtons({ ...theory, bankId: p.bankId })}
      </div>` : '';
    return `<section id="mm-p-${p.n}" class="${C.card}">${head}${origin}${body}${links}</section>`;
  }

  problemScoreHtml(p, ctx) {
    const r = this.L.problemScore(p, ctx.answers, ctx.marks);
    const pending = ctx.mode === 'review' && r.pending;
    const pct = r.of ? r.got / r.of : 0;
    const tone = pending ? 'text-amber-300' : pct >= 0.5 ? 'text-emerald-400' : 'text-rose-400';
    return `<span class="text-sm font-bold tabular-nums ${tone}">${this.fmt(r.got)} / ${r.of} pt${pending ? ` <span class="font-semibold">· ${r.pending} to grade</span>` : ''}</span>`;
  }

  numberBadge(id) {
    return `<span class="inline-flex items-center justify-center h-6 min-w-[2.25rem] px-1.5 rounded-md bg-slate-800 text-[11px] font-bold text-slate-300 tabular-nums shrink-0">${this.esc(id)}</span>`;
  }

  caption(text, iconName = '', cls = 'text-slate-400') {
    return `<div class="text-[11px] font-bold uppercase tracking-wider ${cls} mb-1">${iconName ? `${icon(iconName)} ` : ''}${text}</div>`;
  }

  // Problem 1 item
  choiceItemInner(it, ctx) {
    const resp = ctx.answers?.choice?.[it.id] || {};
    const task = it.task;
    const prompt = task ? this.taskQuestion(task) : it.prompt;
    const meta = task && (ctx.mode !== 'exam') ? `<div class="text-[11px] text-slate-400 mt-1">LMS self-test ${this.esc(task.id)}${it.typeLabel ? ` · ${this.esc(it.typeLabel)}` : ''}</div>` : '';
    const top = `<div class="flex gap-2.5 text-sm text-slate-100 leading-relaxed">${this.numberBadge(it.id)}<div class="min-w-0 flex-1">${prompt}${it.tf || task?.format === 'tf' ? ' <span class="text-slate-400">(choose True or False)</span>' : ''}${task?.format === 'multi' ? ' <span class="text-slate-400">(select all that apply)</span>' : ''}${meta}</div></div>`;
    if (ctx.mode === 'exam') return top + this.choiceInputs(it, resp);
    const showKey = ctx.mode !== 'paper' || ctx.open;
    let out = top + this.choiceStatic(it, ctx.mode === 'paper' ? null : resp, showKey);
    if (ctx.mode === 'paper' && !ctx.open) return out;
    if (ctx.mode !== 'paper') out += this.choiceVerdict(it, resp, ctx);
    const explain = task
      ? `${task.hint ? `<p><strong>LMS hint:</strong> ${this.esc(task.hint)}</p>` : ''}<p>${this.esc(task.explanation || '')}</p>`
      : it.solution || '';
    if (explain) out += `<div class="mt-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-sm text-slate-200 leading-relaxed">${this.caption(task ? 'Explanation · ours' : 'Our solution', 'lightbulb')}<div class="mm-rich">${explain}</div></div>`;
    return out;
  }

  // The options as answer buttons (exam)
  choiceInputs(it, resp) {
    const C = MockMidterm.CLS;
    const task = it.task;
    const pick = resp.pick;
    const btn = (value, key, html, on, multi = false) => `
      <button type="button" data-mm-act="pick" data-item="${it.id}" data-value="${value}" aria-pressed="${on}" class="${C.option} ${on ? C.optionOn : C.optionOff}">
        <span class="w-7 h-7 shrink-0 inline-flex items-center justify-center ${multi ? 'rounded-md' : 'rounded-full'} border text-xs font-bold ${on ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300'}">${key}</span>
        <span class="min-w-0 flex-1">${html}</span>
      </button>`;
    if (it.tf || task?.format === 'tf') {
      return `<div class="mm-grid grid grid-cols-2 gap-2 mt-2.5 sm:max-w-sm">${btn('true', 'T', 'True', pick === true)}${btn('false', 'F', 'False', pick === false)}</div>`;
    }
    if (task?.format === 'numeric') {
      return `<label class="flex flex-wrap items-center gap-2 mt-2.5 text-sm text-slate-300">Answer:
        <input type="text" inputmode="decimal" autocomplete="off" data-mm-input="numeric" data-item="${it.id}" value="${this.esc(pick ?? '')}" placeholder="a number or a fraction, e.g. 3/4" class="${C.input} sm:w-64"></label>`;
    }
    if (task) {
      const multi = task.format === 'multi';
      const picked = multi ? (Array.isArray(pick) ? pick : []) : [pick];
      return `<div class="mm-grid grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5">${it.order.map((i, k) => btn(i, String.fromCharCode(97 + k), this.taskOption(task.options[i].text), picked.includes(i), multi)).join('')}</div>`;
    }
    const opts = it.options.map((o, i) => btn(i, String.fromCharCode(97 + i), o, pick === i));
    if (it.other) opts.push(btn('other', 'd', '<span class="italic text-slate-300">your variant</span>', pick === 'other'));
    return `<div class="mm-grid grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2.5">${opts.join('')}</div>
      ${pick === 'other' ? `<label class="block mt-2"><span class="sr-only">Your variant for ${this.esc(it.id)}</span>
        <input type="text" autocomplete="off" maxlength="200" data-mm-input="other" data-item="${it.id}" value="${this.esc(resp.other || '')}" placeholder="Your answer (d), e.g. N(0, 1/4)" class="${C.input}"></label>` : ''}`;
  }

  // The options after the exam: the right one, yours, the rest muted (resp = null: paper review, nothing chosen)
  choiceStatic(it, resp, showKey) {
    const task = it.task;
    const pick = resp?.pick;
    const row = (key, html, right, chosen, multi = false) => {
      const look = !showKey ? 'border-slate-800 bg-slate-950/40 text-slate-200'
        : right && chosen ? 'border-emerald-600 bg-emerald-950/50 text-slate-100'
        : right ? 'border-emerald-600 border-dashed bg-slate-950/40 text-slate-100'
        : chosen ? 'border-rose-600 bg-rose-950/40 text-slate-100'
        : 'border-slate-800 bg-slate-950/40 text-slate-300';
      const tag = !showKey ? '' : chosen && right ? `<span class="text-[11px] font-bold text-emerald-400 shrink-0">${icon('check')} yours</span>`
        : chosen ? `<span class="text-[11px] font-bold text-rose-400 shrink-0">${icon('x')} yours</span>`
        : right ? `<span class="text-[11px] font-bold text-emerald-400 shrink-0">correct</span>` : '';
      return `<li class="flex items-center gap-2.5 p-2 rounded-xl border text-sm ${look}">
        <span class="w-6 h-6 shrink-0 inline-flex items-center justify-center ${multi ? 'rounded-md' : 'rounded-full'} bg-slate-800 text-[11px] font-bold text-slate-300">${key}</span>
        <span class="min-w-0 flex-1">${html}</span>${tag}</li>`;
    };
    if (it.tf || task?.format === 'tf') {
      const answer = task ? task.answer : it.answer;
      return `<ul class="mm-grid grid grid-cols-2 gap-1.5 mt-2.5 sm:max-w-sm">${row('T', 'True', answer === true, pick === true)}${row('F', 'False', answer === false, pick === false)}</ul>`;
    }
    if (task?.format === 'numeric') {
      return `<div class="mm-grid mt-2.5 grid sm:grid-cols-2 gap-1.5 text-sm">
        ${resp ? `<div class="p-2 rounded-xl border border-slate-800 bg-slate-950/40 text-slate-200">Your answer: <strong class="tabular-nums">${this.esc(String(pick ?? '').trim() || '—')}</strong></div>` : ''}
        ${showKey ? `<div class="p-2 rounded-xl border border-emerald-600 bg-emerald-950/40 text-slate-100">Correct: <strong class="tabular-nums">${this.esc(task.answer)}</strong></div>` : ''}</div>`;
    }
    if (task) {
      const multi = task.format === 'multi';
      const picked = multi ? (Array.isArray(pick) ? pick : []) : [pick];
      return `<ul class="mm-grid grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2.5">${it.order.map((i, k) => row(String.fromCharCode(97 + k), this.taskOption(task.options[i].text), !!task.options[i].correct, picked.includes(i), multi)).join('')}</ul>`;
    }
    const rows = it.options.map((o, i) => row(String.fromCharCode(97 + i), o, it.answer === i, pick === i));
    const right = it.answer === 'other';
    if (it.other) {
      // paper review: "(d) your variant: N(0, ¼)" when that is the answer; after an exam: what you wrote, then the answer
      let html = '<span class="italic">your variant</span>';
      if (!resp && showKey && right) html += `: ${it.otherAnswer}`;
      if (pick === 'other' && resp?.other) html += `: <strong>${this.esc(resp.other)}</strong>`;
      if (resp && showKey && right) html += `<span class="block text-xs text-slate-400">correct: ${it.otherAnswer}</span>`;
      rows.push(row('d', html, right, pick === 'other'));
    }
    const roomy = pick === 'other' || (resp && showKey && right);
    return `<ul class="mm-grid grid grid-cols-1 sm:grid-cols-2 ${rows.length <= 4 && !roomy ? 'lg:grid-cols-4' : ''} gap-1.5 mt-2.5">${rows.join('')}</ul>`;
  }

  // Points of a problem-1 item, and the student's own check of a "(d) your variant" answer
  choiceVerdict(it, resp, ctx) {
    const g = this.L.gradeChoice(it, resp, ctx.marks?.[it.id]);
    const badge = {
      right: ['circle-check', 'text-emerald-400', g.self ? 'Your variant matches' : 'Right'],
      partial: ['circle-alert', 'text-amber-300', 'Partly right'],
      wrong: ['circle-x', 'text-rose-400', g.self ? 'Your variant does not match' : 'Wrong'],
      blank: ['circle-dashed', 'text-slate-400', 'No answer'],
      check: ['circle-help', 'text-amber-300', 'Check your variant']
    }[g.status];
    let out = `<div class="mt-2 flex items-center gap-1.5 text-sm font-semibold ${badge[1]}">${icon(badge[0])} ${badge[2]} <span class="tabular-nums">· ${this.fmt(g.points)} / ${it.points} pt</span></div>`;
    if (!it.task && it.answer === 'other' && resp.pick === 'other') {
      const mark = ctx.marks?.[it.id];
      out += `<div id="mm-g-${it.id}" class="mt-2 p-3 rounded-xl bg-amber-950/30 border border-amber-800/60">
        <p class="text-sm text-slate-200">You wrote <strong>${this.esc(resp.other || '')}</strong>; the answer is ${it.otherAnswer}. Do they say the same?</p>
        ${ctx.mode === 'review' ? `<div class="flex flex-wrap gap-2 mt-2">
          <button type="button" data-mm-act="mark" data-key="${it.id}" data-value="${it.points}" aria-pressed="${mark === it.points}" class="${MockMidterm.CLS.chip(mark === it.points)}">${icon('check')} Yes · ${it.points} pt</button>
          <button type="button" data-mm-act="mark" data-key="${it.id}" data-value="0" aria-pressed="${mark === 0}" class="${MockMidterm.CLS.chip(mark === 0)}">${icon('x')} No · 0 pt</button>
        </div>` : ''}
      </div>`;
    }
    return out;
  }

  // Problem 2 item
  defItemInner(it, ctx) {
    const C = MockMidterm.CLS;
    const top = `<div class="flex gap-2.5 text-sm text-slate-100 leading-relaxed">${this.numberBadge(it.id)}<div class="min-w-0 flex-1">${it.prompt}</div></div>`;
    if (ctx.mode === 'exam') {
      return `${top}<label class="block mt-2"><span class="sr-only">Your answer to ${this.esc(it.id)}</span>
        <textarea rows="2" maxlength="1500" data-mm-input="def" data-item="${it.id}" placeholder="Complete the sentence (optional: you may write it on paper instead)" class="${C.input} resize-y">${this.esc(ctx.answers?.defs?.[it.id] || '')}</textarea></label>`;
    }
    if (ctx.mode === 'paper' && !ctx.open) return top;
    const typed = String(ctx.answers?.defs?.[it.id] || '').trim();
    const yours = ctx.mode === 'paper' ? '' : `
      <div class="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
        ${this.caption('Your answer', 'pen-line')}
        ${typed ? `<div class="text-sm text-slate-100 whitespace-pre-wrap break-words">${this.esc(typed)}</div>` : '<div class="text-sm text-slate-400 italic">Nothing typed: compare what you wrote on paper.</div>'}
      </div>`;
    const ref = this.referenceHtml(it.reference || (it.defs?.[0] ? this.L.defReference(it.defs[0], this.data) : null));
    const ours = it.answer ? `<div class="p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-sm text-slate-200">${this.caption('Our completion', 'lightbulb')}${it.answer}</div>` : '';
    return `${top}<div class="mm-grid grid ${yours ? 'sm:grid-cols-2' : ''} gap-2 mt-2.5">${yours}${ref}</div>${ours ? `<div class="mt-2">${ours}</div>` : ''}
      ${ctx.mode === 'paper' ? '' : `<div id="mm-g-${it.id}" class="mt-2.5">${this.gradeControl(it.id, it.points, ctx, 'chips')}</div>`}`;
  }

  // Lecture quote (the lecturer's exact words, with lecture and slide) or the colloquium card, clearly labelled
  referenceHtml(ref) {
    if (!ref) return '';
    if (ref.kind === 'colloquium') {
      return `<div class="p-3 rounded-xl bg-slate-950/50 border border-slate-800">
        ${this.caption(`Colloquium card #${ref.defId} · our wording, not a lecture quote`, 'notebook-pen')}
        <div class="mm-rich text-sm text-slate-200 leading-relaxed">${ref.text}</div></div>`;
    }
    return `<figure class="mm-quote p-3 rounded-xl bg-indigo-950/30 border border-indigo-800/60">
      <figcaption>${this.caption(`${this.esc(this.L.citation(ref))} · the lecturer’s words`, 'quote', 'text-indigo-300')}</figcaption>
      <blockquote class="text-sm text-slate-100 leading-relaxed">${ref.text}</blockquote></figure>`;
  }

  // Problems 3–6
  writtenInner(p, ctx) {
    const C = MockMidterm.CLS;
    const showSolution = ctx.mode === 'review' || ctx.mode === 'attempt' || ctx.open;
    const split = p.parts.some(part => part.solution);
    const statement = p.statement ? `<div class="mm-rich mt-3 text-sm text-slate-100 leading-relaxed">${p.statement}</div>` : '';
    const notes = String(ctx.answers?.notes?.[p.n] || '').trim();
    const parts = p.parts.map(part => {
      const key = this.L.partKey(p, part);
      const solution = showSolution && split && part.solution ? `
        <div class="mt-2 p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-sm text-slate-200 leading-relaxed">
          ${this.caption(`Our solution${part.solutionTitle ? ` · ${this.esc(part.solutionTitle)}` : ''}`, 'lightbulb')}
          <div class="mm-rich">${part.solution}</div>
          ${part.answer ? `<div class="mt-2 pt-2 border-t border-slate-800"><span class="font-semibold text-emerald-400">Answer:</span> ${part.answer}</div>` : ''}
        </div>` : '';
      const grade = ctx.mode === 'review' || ctx.mode === 'attempt' ? `<div id="mm-g-${key}" class="mt-2">${this.gradeControl(key, part.points, ctx, 'stepper')}</div>` : '';
      return `<li class="${ctx.mode === 'exam' ? '' : 'pt-3 first:pt-0'}">
        <div class="flex gap-2 text-sm text-slate-100 leading-relaxed">
          ${part.label ? `<span class="font-bold text-slate-300 shrink-0">(${part.label})</span>` : ''}
          <div class="mm-rich min-w-0 flex-1">${part.text}</div>
          <span class="shrink-0 text-xs font-semibold text-slate-400 tabular-nums">${part.points} pt</span>
        </div>${solution}${grade}</li>`;
    }).join('');
    const setup = showSolution && (p.solutionIntro || '').trim() ? `
      <div class="mt-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800 text-sm text-slate-200 leading-relaxed">
        ${this.caption(split ? 'Our solution · setup' : 'Our solution', 'lightbulb')}<div class="mm-rich">${p.solutionIntro}</div></div>` : '';
    if (ctx.mode === 'exam') {
      return `${statement}<ol class="mt-3 space-y-2">${parts}</ol>
        <div class="mt-4 p-3 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <p class="flex-1 text-xs text-slate-300">${icon('pen-line')} Solve this on paper and show your work: the points are for the reasoning, not only the final answer.</p>
          <span id="mm-done-${p.n}">${this.doneButtonHtml(p.n)}</span>
        </div>
        <label class="block mt-3">
          <span class="text-xs font-semibold text-slate-400">Notes (optional): key results to compare with when you grade</span>
          <textarea rows="2" maxlength="2000" data-mm-input="notes" data-n="${p.n}" class="${C.input} resize-y mt-1">${this.esc(ctx.answers?.notes?.[p.n] || '')}</textarea>
        </label>`;
    }
    const yourNotes = (ctx.mode === 'review' || ctx.mode === 'attempt') && notes ? `
      <div class="mt-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">${this.caption('Your notes', 'pen-line')}<div class="text-sm text-slate-100 whitespace-pre-wrap break-words">${this.esc(notes)}</div></div>` : '';
    return `${statement}${yourNotes}${setup}<ol class="mt-3 space-y-2 ${showSolution ? 'divide-y divide-slate-800' : ''}">${parts}</ol>`;
  }

  doneButtonHtml(n) {
    const C = MockMidterm.CLS;
    const done = !!this.session?.answers?.done?.[n];
    return `<button type="button" data-mm-act="done" data-n="${n}" aria-pressed="${done}" class="${done ? C.doneOn : C.secondarySm}">${icon(done ? 'square-check' : 'square')} ${done ? 'Done on paper' : 'Mark as done'}</button>`;
  }

  // Self-grade control: chips (0 · ½ · 1) for definitions, a half-point stepper for written parts; read-only after saving
  gradeControl(key, max, ctx, kind) {
    const C = MockMidterm.CLS;
    const v = ctx.marks?.[key];
    const has = v !== null && v !== undefined;
    if (ctx.mode === 'attempt') {
      return `<span class="text-sm font-semibold tabular-nums ${has ? 'text-slate-200' : 'text-slate-400'}">${icon('pen-line')} ${has ? `You gave ${this.fmt(v)} / ${max} pt` : `Not graded · 0 / ${max} pt`}</span>`;
    }
    if (kind === 'chips') {
      const steps = [];
      for (let x = 0; x <= max; x += 0.5) steps.push(x);
      return `<div class="flex flex-wrap items-center gap-2">
        <span class="text-xs font-semibold text-slate-300">Your points</span>
        <div class="inline-flex gap-1 p-1 rounded-xl bg-slate-950/60 border border-slate-800" role="group" aria-label="Points for ${this.esc(key)}">
          ${steps.map(x => `<button type="button" data-mm-act="mark" data-key="${this.esc(key)}" data-value="${x}" aria-pressed="${v === x}" class="min-w-[2.75rem] px-2.5 py-1.5 rounded-lg text-sm font-bold tabular-nums cursor-pointer transition ${v === x ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'}">${x === 0.5 ? '½' : this.fmt(x)}</button>`).join('')}
        </div>
        ${has ? '' : '<span class="text-xs font-semibold text-amber-300">to grade</span>'}
      </div>`;
    }
    return `<div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-semibold text-slate-300">Your points</span>
      <div class="inline-flex items-center rounded-xl border border-slate-600 overflow-hidden" role="group" aria-label="Points for part ${this.esc(key)}">
        <button type="button" data-mm-act="step" data-key="${this.esc(key)}" data-delta="-0.5" aria-label="Half a point less" ${has && v <= 0 ? 'disabled' : ''} class="${C.stepBtn}">${icon('minus')}</button>
        <span class="min-w-[4.5rem] px-2 py-1.5 text-center text-sm font-bold tabular-nums border-x border-slate-600 ${has ? 'text-slate-100' : 'text-slate-400'}">${has ? this.fmt(v) : '–'} / ${max}</span>
        <button type="button" data-mm-act="step" data-key="${this.esc(key)}" data-delta="0.5" aria-label="Half a point more" ${has && v >= max ? 'disabled' : ''} class="${C.stepBtn}">${icon('plus')}</button>
      </div>
      <button type="button" data-mm-act="mark" data-key="${this.esc(key)}" data-value="0" aria-pressed="${v === 0}" class="${C.chip(v === 0)}">0</button>
      <button type="button" data-mm-act="mark" data-key="${this.esc(key)}" data-value="${max}" aria-pressed="${v === max}" class="${C.chip(v === max)}">Full ${max}</button>
      ${has ? '' : '<span class="text-xs font-semibold text-amber-300">to grade</span>'}
    </div>`;
  }

  // --- after the exam: grading, then the saved attempt ---
  summaryHtml(paper, totals, info, mode) {
    const C = MockMidterm.CLS;
    const pctTone = mode === 'review' && totals.pending ? 'text-slate-400' : totals.percent >= 50 ? 'text-emerald-400' : 'text-rose-400';
    const cells = totals.perProblem.map(r => {
      const share = r.of ? Math.round((r.got / r.of) * 100) : 0;
      const waiting = mode === 'review' && r.pending;
      return `<button type="button" data-mm-act="goto" data-n="${r.n}" class="p-2 rounded-xl border border-slate-800 bg-slate-950/50 hover:border-indigo-500 text-left cursor-pointer transition">
        <span class="block text-[11px] font-bold text-slate-400">Problem ${r.n}</span>
        <span class="block text-sm font-black tabular-nums text-slate-100">${this.fmt(r.got)}<span class="font-semibold text-slate-400"> / ${r.of}</span></span>
        <span class="block h-1 mt-1 rounded-full bg-slate-800 overflow-hidden"><span class="block h-full rounded-full ${waiting ? 'bg-amber-500' : share >= 50 ? 'bg-emerald-500' : 'bg-rose-500'}" style="width: ${share}%"></span></span>
        <span class="block text-[10px] font-semibold mt-0.5 ${waiting ? 'text-amber-300' : 'text-slate-400'}">${waiting ? `${r.pending} to grade` : `${share}%`}</span>
      </button>`;
    }).join('');
    return `
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-400">${mode === 'review' ? 'Grade your paper' : 'Saved attempt'}</div>
          <h2 class="text-xl font-black text-slate-100 mt-0.5">${this.esc(this.paperLabel(info.paper, paper.title))}</h2>
          <p class="text-xs text-slate-400 mt-1">${this.when(info.finishedAt)} · ${this.minutes(info.usedMs)} of ${info.durationMin} min${info.timedOut ? ' · time ran out' : ''}</p>
        </div>
        <div class="sm:text-right shrink-0">
          <div class="text-3xl font-black tabular-nums text-slate-100">${this.fmt(totals.score)}<span class="text-lg font-bold text-slate-400"> / ${totals.total}</span></div>
          <div class="text-sm font-bold tabular-nums ${pctTone}">${totals.percent}%${mode === 'review' && totals.pending ? ' <span class="text-amber-300">so far</span>' : ''}</div>
        </div>
      </div>
      <div class="mm-grid grid grid-cols-3 sm:grid-cols-6 gap-2 mt-4">${cells}</div>
      <div class="mt-4 flex flex-wrap items-center gap-2">
        ${mode === 'review' && this.confirm === 'save' ? this.saveConfirmHtml(totals)
          : mode === 'review'
          ? `<button type="button" data-mm-act="save" class="${C.primary}">${icon('save')} Save result</button>
             <span class="text-xs ${totals.pending ? 'text-amber-300 font-semibold' : 'text-slate-400'}">${totals.pending ? `${totals.pending} ${totals.pending === 1 ? 'grade' : 'grades'} to give: problem 1 is graded for you, the rest you grade below.` : 'Everything is graded.'}</span>`
          : `<button type="button" data-mm-act="home" class="${C.secondary}">${icon('arrow-left')} Mock midterm</button>
             ${this.papers[info.paper] ? `<button type="button" data-mm-act="sit-again" data-id="${this.esc(info.paper)}" class="${C.secondary}">${icon('rotate-ccw')} Sit it again</button>` : `<button type="button" data-mm-act="sit-again" data-id="new" class="${C.secondary}">${icon('shuffle')} New mock paper</button>`}`}
        ${this.hasSheet ? `<button type="button" data-mm-act="sheet" data-mode="study" class="${C.ghost} sm:ml-auto">${icon('table')} Formula sheet with labels</button>` : ''}
      </div>`;
  }

  weakHtml(paper, totals, mode) {
    const C = MockMidterm.CLS;
    const weak = this.L.weakSpots(paper, totals, this.data.theory);
    const waiting = mode === 'review' ? totals.perProblem.filter(r => r.pending).length : 0;
    const items = weak.map(w => `
      <div class="p-3 rounded-xl bg-rose-950/30 border border-rose-800/60">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <button type="button" data-mm-act="goto" data-n="${w.n}" class="text-sm font-bold text-slate-100 hover:text-indigo-400 cursor-pointer transition">Problem ${w.n}${w.title ? ` · ${this.esc(w.title)}` : ''}</button>
          <span class="text-sm font-bold tabular-nums text-rose-300">${this.fmt(w.got)} / ${w.of} pt</span>
        </div>
        ${w.defs.length || w.notes.length || w.bankId ? `<div class="mt-2 flex flex-wrap gap-1.5 text-xs">${this.linkButtons(w)}</div>` : ''}
      </div>`).join('');
    const empty = waiting ? `Grade the ${waiting === 1 ? 'last problem' : `${waiting} problems still open`} to see where you lost the most.`
      : 'No weak spots: every problem is at 50% or more.';
    return `<div class="${C.card}">
      <h3 class="text-base font-bold text-slate-100">${icon('target', 'text-rose-400')} Weak spots</h3>
      <p class="text-xs text-slate-400 mt-1">Problems under 50%, with the theory behind them.${weak.length && waiting ? ` ${waiting} more ${waiting === 1 ? 'problem is' : 'problems are'} not graded yet.` : ''}</p>
      ${weak.length ? `<div class="mt-3 space-y-2">${items}</div>` : `<p class="mt-2 text-sm text-slate-300">${empty}</p>`}
    </div>`;
  }

  // "Save result" with grades still missing: asked where the button was pressed (top summary or bottom bar)
  saveConfirmHtml(totals) {
    const C = MockMidterm.CLS;
    return `<p class="flex-1 text-sm text-amber-200"><strong>${totals.pending} ${totals.pending === 1 ? 'grade is' : 'grades are'} missing.</strong> If you save now they count as 0.</p>
      <div class="flex flex-wrap gap-2"><button type="button" data-mm-act="cancel" class="${C.secondary}">Grade them first</button>
      <button type="button" data-mm-act="save-anyway" class="${C.primary}">${icon('save')} Save anyway</button></div>`;
  }

  saveBarHtml(totals) {
    const C = MockMidterm.CLS;
    if (this.confirm === 'save') return this.saveConfirmHtml(totals);
    return `<p class="flex-1 text-sm text-slate-300">Score: <strong class="tabular-nums text-slate-100">${this.fmt(totals.score)} / ${totals.total}</strong> (${totals.percent}%)${totals.pending ? ` · <span class="text-amber-300 font-semibold">${totals.pending} to grade</span>` : ''}</p>
      <div class="flex flex-wrap gap-2"><button type="button" data-mm-act="home" class="${C.secondary}">${icon('arrow-left')} Back to the start</button>
      <button type="button" data-mm-act="save" class="${C.primary}">${icon('save')} Save result</button></div>`;
  }

  reviewHtml() {
    const C = MockMidterm.CLS;
    const s = this.session;
    const paper = this.sessionPaper;
    if (!paper) {
      return `<div class="${C.card} space-y-3"><p class="text-sm text-slate-300">The paper of this attempt could not be loaded.</p>
        <button type="button" data-mm-act="discard" class="${C.secondary}">${icon('trash-2')} Discard the attempt</button></div>`;
    }
    const ctx = { mode: 'review', paper, answers: s.answers, marks: s.marks || {} };
    const totals = this.L.totals(paper, s.answers, ctx.marks);
    const info = { paper: s.paper, finishedAt: s.finishedAt, usedMs: this.L.usedMs(s, s.finishedAt), durationMin: s.durationMin, timedOut: s.timedOut };
    return `
      <div class="space-y-5">
        ${this.noticeHtml()}
        ${s.timedOut ? `<div class="flex items-start gap-2 p-3.5 rounded-xl border bg-amber-950/40 border-amber-800 text-amber-200 text-sm" role="status">${icon('alarm-clock', 'mt-0.5 shrink-0')}<span><strong>Time is up.</strong> Your paper was handed in automatically at ${this.clockTime(s.finishedAt)}.</span></div>` : ''}
        <div id="mm-summary" class="${C.card}">${this.summaryHtml(paper, totals, info, 'review')}</div>
        <div class="p-4 rounded-2xl bg-slate-950/50 border border-slate-800 text-sm text-slate-300 leading-relaxed">
          ${icon('info', 'text-indigo-400')} <strong class="text-slate-100">How to grade.</strong> Problem 1 is graded for you. For problem 2, compare your sentence with the lecture quote: the lecturer's own words, with the lecture and slide. For problems 3–6, compare your paper with our worked solution, part by part, and give yourself points in halves. Be as strict as an examiner: the method counts, and so does the final answer.
          ${paper.pointsNote ? `<span class="block mt-1 text-xs text-slate-400">${this.esc(paper.pointsNote)} ${this.esc(paper.solutionsNote || '')}</span>` : ''}
        </div>
        ${paper.problems.map(p => this.problemHtml(p, ctx)).join('')}
        <div id="mm-weak">${this.weakHtml(paper, totals, 'review')}</div>
        <div id="mm-savebar" class="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row sm:items-center gap-3">${this.saveBarHtml(totals)}</div>
      </div>`;
  }

  // After a grade changes: the control, the problem's score, the summary, weak spots and the save bar
  refreshReview(key = null) {
    const s = this.session;
    const paper = this.sessionPaper;
    if (!s || !paper || this.view !== 'review') return;
    const ctx = { mode: 'review', paper, answers: s.answers, marks: s.marks || {} };
    const totals = this.L.totals(paper, s.answers, ctx.marks);
    const info = { paper: s.paper, finishedAt: s.finishedAt, usedMs: this.L.usedMs(s, s.finishedAt), durationMin: s.durationMin, timedOut: s.timedOut };
    if (key) {
      const g = this.gradeIndex(paper)[key];
      if (g?.self) this.refreshItem(key);
      else if (g) {
        const el = document.getElementById(`mm-g-${key}`);
        if (el) el.innerHTML = this.gradeControl(key, g.max, ctx, g.problem.kind === 'definitions' ? 'chips' : 'stepper');
      }
    }
    for (const p of paper.problems) {
      const el = document.getElementById(`mm-ps-${p.n}`);
      if (el) el.innerHTML = this.problemScoreHtml(p, ctx);
    }
    const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    set('mm-summary', this.summaryHtml(paper, totals, info, 'review'));
    set('mm-weak', this.weakHtml(paper, totals, 'review'));
    set('mm-savebar', this.saveBarHtml(totals));
  }

  attemptHtml() {
    const C = MockMidterm.CLS;
    const a = this.attempts[this.attemptId];
    if (!a) {
      this.view = 'start';
      return this.startHtml();
    }
    const paper = this.paperOf(a.paper, a.picks);
    const info = { paper: a.paper, finishedAt: a.finishedAt, usedMs: a.usedMs || 0, durationMin: a.durationMin, timedOut: a.timedOut };
    if (!paper) {
      const totals = { perProblem: a.perProblem || [], score: a.score, total: a.total, percent: Math.round((a.score / a.total) * 100), pending: 0 };
      return `<div class="space-y-5">${this.noticeHtml()}
        <div class="${C.card}">${this.summaryHtml({ title: a.title }, totals, info, 'attempt')}
        <p class="mt-4 text-sm text-slate-400">The paper of this attempt is not in this version of the app, so only the score can be shown.</p></div></div>`;
    }
    // A grade left out when saving counts as 0, also for the weak spots
    const marks = { ...a.marks };
    for (const p of paper.problems) for (const g of this.L.gradables(p)) if (marks[g.key] === undefined || marks[g.key] === null) marks[g.key] = 0;
    const ctx = { mode: 'attempt', paper, answers: a.answers || {}, marks: a.marks || {} };
    const totals = { ...this.L.totals(paper, ctx.answers, marks), score: a.score, total: a.total, percent: Math.round((a.score / a.total) * 100) };
    totals.perProblem = totals.perProblem.map(r => ({ ...r, ...(a.perProblem || []).find(x => x.n === r.n) }));
    return `
      <div class="space-y-5">
        ${this.noticeHtml()}
        <div class="${C.card}">${this.summaryHtml(paper, totals, info, 'attempt')}</div>
        ${paper.problems.map(p => this.problemHtml(p, ctx)).join('')}
        ${this.weakHtml(paper, totals, 'attempt')}
        <div class="flex justify-center"><button type="button" data-mm-act="home" class="${C.secondary}">${icon('arrow-left')} Back to Mock midterm</button></div>
      </div>`;
  }

  paperHtml() {
    const C = MockMidterm.CLS;
    const paper = this.papers[this.paperId];
    if (!paper) {
      this.view = 'start';
      return this.startHtml();
    }
    const ctx = { mode: 'paper', paper, answers: {}, marks: {}, open: this.opened };
    return `
      <div class="space-y-5">
        ${this.noticeHtml()}
        <div class="${C.card}">
          <div class="text-[11px] font-bold uppercase tracking-wider text-indigo-400">${icon('book-open')} Review · no timer</div>
          <h2 class="text-xl font-black text-slate-100 mt-0.5">${this.esc(paper.title)}</h2>
          <p class="text-xs text-slate-400 mt-1">${this.esc([paper.course, paper.author, paper.date].filter(Boolean).join(' · '))} · ${this.L.totals(paper).total} points</p>
          <p class="text-sm text-slate-300 mt-2 leading-relaxed">Try each problem first, then open our solution. ${this.esc(paper.solutionsNote || '')}</p>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" data-mm-act="home" class="${C.secondary}">${icon('arrow-left')} Mock midterm</button>
            <button type="button" data-mm-act="sit-again" data-id="${this.esc(paper.id || this.paperId)}" class="${C.secondary}">${icon('timer')} Sit it as a timed mock</button>
          </div>
        </div>
        ${paper.problems.map(p => this.problemHtml(p, ctx)).join('')}
      </div>`;
  }
}

MockMidterm.STORAGE_KEY = 'stathustle_mock_session';

// Shared class lists (Tailwind): every control has a pointer, a hover change and a transition
MockMidterm.CLS = {
  card: 'p-5 sm:p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl',
  primary: 'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm cursor-pointer transition disabled:opacity-70 disabled:cursor-not-allowed',
  primarySm: 'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm whitespace-nowrap cursor-pointer transition',
  secondary: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm cursor-pointer transition disabled:opacity-70 disabled:cursor-not-allowed',
  secondarySm: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-sm whitespace-nowrap cursor-pointer transition',
  doneOn: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-700 text-white font-semibold text-sm whitespace-nowrap cursor-pointer transition',
  danger: 'inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm cursor-pointer transition',
  dangerSm: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm whitespace-nowrap cursor-pointer transition',
  ghost: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/40 font-semibold text-sm cursor-pointer transition',
  ghostDanger: 'inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 font-semibold text-sm cursor-pointer transition',
  link: 'inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-200 cursor-pointer transition',
  option: 'w-full flex items-center gap-2.5 text-left p-2.5 rounded-xl border text-sm cursor-pointer transition',
  optionOn: 'border-indigo-500 bg-indigo-950/50 ring-1 ring-indigo-500/60 text-slate-100',
  optionOff: 'border-slate-700 bg-slate-950/50 hover:border-indigo-500 text-slate-200',
  input: 'w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-100 text-base sm:text-sm focus:outline-none focus:border-indigo-500',
  stepBtn: 'px-3 py-1.5 bg-slate-950/50 hover:bg-slate-800 text-slate-300 cursor-pointer transition disabled:opacity-70 disabled:cursor-not-allowed',
  chip: on => `inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg border text-sm font-bold tabular-nums cursor-pointer transition ${on ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-700 bg-slate-950/50 text-slate-300 hover:border-indigo-500'}`
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MockMidtermLogic };
} else {
  window.MockMidtermLogic = MockMidtermLogic;
  window.mockMidterm = new MockMidterm();
}
