/* Spark's exam and question-paper engine, shared by the app (index.html) and the tests (tests/).
   - Exam profiles (JEE, NEET, CAT, UPSC, CBSE boards): how Sparky should teach for each, and the marking scheme.
   - Reading a question paper the student uploads: the questions are read in chunks (the server caps how long one
     reply can be), validated, numbered, and anything unreadable is marked rather than guessed.
   - Solving it a few questions per request, each with Sparky's explanation, the trap to avoid and an honest
     confidence; answers are validated against the question (an MCQ answer must be one of its options).
   The model writes the solutions; this file never trusts one it can't validate, and says which were checked.
   No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SparkPaper = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- exam profiles ----------
     Marking schemes are the commonly published ones and can change from year to year; the app shows them as
     "usual marking" and the student can check the official notice. */
  const EXAMS = {
    cbse10: { name: 'CBSE Class 10 boards', klass: 'Class 10', marking: null, focus: 'CBSE Class 10 board exam answers: NCERT-based, step marking, the exact keywords and format examiners look for, diagrams and units where needed.' },
    cbse12: { name: 'CBSE Class 12 boards', klass: 'Class 12', marking: null, focus: 'CBSE Class 12 board exam answers: NCERT-based, step marking, derivations and definitions in exam language, units and diagrams where needed.' },
    jee_main: { name: 'JEE Main', klass: 'Class 12', marking: { right: 4, wrong: -1, numericWrong: 0, blank: 0 }, focus: 'JEE Main (Physics, Chemistry, Mathematics, Class 11-12 NCERT level and beyond): speed matters, so show the fastest reliable method, shortcuts that are actually valid, and how to eliminate options.' },
    jee_adv: { name: 'JEE Advanced', klass: 'Class 12', marking: null, focus: 'JEE Advanced: deep concepts, multi-step problems, multiple-correct and numerical answers. Check every option independently, because more than one can be right; state the exact numerical answer with the precision asked.' },
    neet: { name: 'NEET (UG)', klass: 'Class 12', marking: { right: 4, wrong: -1, blank: 0 }, focus: 'NEET (Physics, Chemistry, Biology, strictly NCERT Class 11-12): biology answers follow NCERT wording and facts exactly; physics and chemistry need quick, reliable methods; point out NCERT lines that are often tested.' },
    cat: { name: 'CAT', klass: 'Graduate', marking: { right: 3, wrong: -1, numericWrong: 0, blank: 0 }, focus: 'CAT (Quantitative Aptitude, Data Interpretation and Logical Reasoning, Verbal Ability and Reading Comprehension): show the fastest method, option elimination, and when skipping a question is the smart choice. For reading comprehension, answer only from the passage.' },
    upsc_pre: { name: 'UPSC Prelims (GS)', klass: 'Graduate', marking: { right: 2, wrong: -2 / 3, blank: 0 }, focus: 'UPSC Civil Services Prelims (General Studies): polity, history, geography, economy, environment, science and current affairs. Explain why each statement is right or wrong, and for "how many of the above are correct" questions check each statement separately. Facts that change (schemes, rankings, office-holders) must be flagged as possibly out of date.' }
  };
  const examOf = key => EXAMS[key] || null;
  /* Extra teaching rules when a student is preparing for an exam (added to the system prompt). */
  function examRules(key) {
    const e = examOf(key); if (!e) return '';
    return `EXAM PREP: this student is preparing for ${e.name}. ${e.focus}
- Still teach like Sparky: friendly, clear and short, but at the real level of this exam; never water down the concept or the notation.
- For a multiple-choice question, test every option against the question before choosing, and say in one line why each wrong option fails.
- Name the trap most students fall into on this kind of question, and one quick check of the final answer (units, limits, substitution, estimate).
- Don't invent exam facts: no made-up past-paper years, cut-offs, weightages or "this always comes" claims. If something about the exam pattern may have changed, say so.`;
  }

  /* ---------- reading a paper ---------- */
  const TYPES = ['mcq', 'multi', 'numeric', 'descriptive'];
  const EXTRACT_SCHEMA = {
    type: 'OBJECT',
    properties: {
      title: { type: 'STRING' },
      questions: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, section: { type: 'STRING' }, subject: { type: 'STRING' }, type: { type: 'STRING', enum: TYPES }, text: { type: 'STRING' }, options: { type: 'ARRAY', items: { type: 'STRING' } }, figure: { type: 'STRING' }, unreadable: { type: 'BOOLEAN' } }, required: ['n', 'type', 'text'] } },
      answerKey: { type: 'ARRAY', items: { type: 'OBJECT', properties: { n: { type: 'INTEGER' }, answer: { type: 'STRING' } }, required: ['n', 'answer'] } },
      more: { type: 'BOOLEAN' }
    },
    required: ['questions', 'more']
  };
  const CHUNK = 40;
  /* from: the first question number to return. page: the file is one photographed page, so return all of it. */
  function extractPrompt(from, page) {
    return `This file is ${page ? 'one page of' : ''} a question paper a student uploaded to practise with. Read the questions in it exactly as printed.

${page ? `Return every question on this page (at most ${CHUNK}), with the paper's own numbers; if it has none, number them from ${from}. Set "more": false.` : `Return the questions numbered ${from} to ${from + CHUNK - 1} (in the paper's own numbering, or in order if it has none), at most ${CHUNK}. Set "more": true if the paper has questions after the last one you returned.`}
For each question:
- "n": its number; "section" and "subject" if the paper shows them (e.g. "Physics", "Section A").
- "type": "mcq" (one correct option), "multi" (the paper says one or more options may be correct), "numeric" (the answer is a number to fill in) or "descriptive" (a written answer).
- "text": the question exactly as printed, with any passage or table it needs, maths in LaTeX \\( … \\). Don't solve it, shorten it or fix it.
- "options": the options' text without their labels, in order (only for mcq and multi).
- "figure": if the question needs a diagram, graph or picture, describe what it shows in one or two plain sentences; otherwise leave it out.
- "unreadable": true if part of the question can't be read; then put what you can read in "text". Never fill in missing words or numbers.
${from === 1 || page ? '"title": the paper\'s name if printed. "answerKey": only if the file itself contains an answer key, the answers as printed (e.g. "B", "A,C" or "12.5"); otherwise leave it out.' : 'Leave "title" and "answerKey" out.'}`;
  }
  const cleanText = (s, max) => String(s == null ? '' : s).replace(/\u0000/g, '').trim().slice(0, max);
  /* Validates one chunk of extracted questions. Returns { title, questions, answerKey, more }. */
  function readExtract(raw) {
    const out = { title: cleanText(raw && raw.title, 120), questions: [], answerKey: {}, more: !!(raw && raw.more) };
    for (const q of (raw && Array.isArray(raw.questions) ? raw.questions : []).slice(0, CHUNK + 10)) {
      if (!q || !Number.isInteger(q.n) || q.n < 1 || q.n > 500) continue;
      const text = cleanText(q.text, 6000); if (!text) continue;
      let type = TYPES.includes(q.type) ? q.type : 'descriptive';
      let options = Array.isArray(q.options) ? q.options.map(o => cleanText(o, 800)).filter(Boolean).slice(0, 6) : [];
      if ((type === 'mcq' || type === 'multi') && options.length < 2) { type = 'descriptive'; options = []; }
      if (type !== 'mcq' && type !== 'multi') options = [];
      out.questions.push(Object.assign({ n: q.n, type, text, options }, q.section ? { section: cleanText(q.section, 60) } : {}, q.subject ? { subject: cleanText(q.subject, 40) } : {}, q.figure && !/^\s*(none|no figure|n\/?a|nil|-)?\s*\.?\s*$/i.test(q.figure) ? { figure: cleanText(q.figure, 400) } : {}, q.unreadable ? { unreadable: true } : {}));
    }
    for (const k of (raw && Array.isArray(raw.answerKey) ? raw.answerKey : [])) if (k && Number.isInteger(k.n) && cleanText(k.answer, 40)) out.answerKey[k.n] = cleanText(k.answer, 40);
    return out;
  }
  /* Adds a chunk to the paper's questions: no repeated numbers, in order. Returns how many were new. */
  function addQuestions(paper, chunk) {
    const have = new Set(paper.questions.map(q => q.n)); let added = 0;
    for (const q of chunk.questions) if (!have.has(q.n)) { paper.questions.push(q); have.add(q.n); added++; }
    paper.questions.sort((a, b) => a.n - b.n);
    if (chunk.title && !paper.title) paper.title = chunk.title;
    Object.assign(paper.answerKey = paper.answerKey || {}, chunk.answerKey);
    return added;
  }

  /* ---------- solving ---------- */
  const LETTERS = 'ABCDEF';
  const SOLVE_SCHEMA = {
    type: 'OBJECT',
    properties: {
      solutions: { type: 'ARRAY', items: { type: 'OBJECT', properties: {
        n: { type: 'INTEGER' }, answer: { type: 'STRING' }, answerText: { type: 'STRING' }, confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
        idea: { type: 'STRING' }, steps: { type: 'ARRAY', items: { type: 'STRING' } }, whyNot: { type: 'STRING' }, trap: { type: 'STRING' }, check: { type: 'STRING' }, cantSolve: { type: 'STRING' }
      }, required: ['n', 'answer', 'confidence', 'idea', 'steps'] } }
    },
    required: ['solutions']
  };
  const BATCH = 5;
  function questionBlock(q) {
    const opts = q.options.length ? '\n' + q.options.map((o, i) => `(${LETTERS[i]}) ${o}`).join('\n') : '';
    return `Question ${q.n}${q.subject ? ` [${q.subject}]` : ''} (${q.type === 'multi' ? 'one or more options correct' : q.type === 'mcq' ? 'one option correct' : q.type === 'numeric' ? 'numerical answer' : 'written answer'}):\n${q.text}${opts}${q.figure ? `\n[Figure, as described from the paper: ${q.figure}]` : ''}${q.unreadable ? '\n[Part of this question could not be read.]' : ''}`;
  }
  function solvePrompt(qs, ctx = {}) {
    const e = examOf(ctx.exam);
    return `You are ${ctx.buddy || 'Sparky'}, a friendly, brilliant tutor in the Spark app, solving questions from a practice paper for ${ctx.name || 'a student'}${e ? `, who is preparing for ${e.name}` : ctx.grade ? ` (${ctx.grade})` : ''}.
${e ? e.focus + '\n' : ''}
Solve each question below on its own, carefully. Work it out fully before deciding: for options, test every one. Then explain it the Sparky way: warm, simple words, short steps a student can follow, the real reason not just the rule.

For each question return:
- "n": its number.
- "answer": for mcq one letter (e.g. "B"); for multi every correct letter (e.g. "A,C"); for numeric just the number (with sign and the precision asked); for a written answer, the final answer in a few words.
- "answerText": the answer in words or with its unit (e.g. "(B) 4.9 m/s²" or "x = 3").
- "confidence": "high" only if you are sure and the working checks out; "medium" if a step relies on an assumption; "low" if the question is unclear, a figure is missing, or you are partly guessing.
- "idea": the key idea in one sentence.
- "steps": 2-6 short steps of working, with LaTeX \\( … \\) for maths.
- "whyNot": for options, one line on why the tempting wrong option(s) fail.
- "trap": the mistake students most often make here (one line).
- "check": one quick check you actually did (substitution, units, limiting case, estimate).
- "cantSolve": only if the question can't be answered from what is given (say what is missing); then give your best answer with confidence "low".
Never invent data, constants or facts the question doesn't give or that aren't standard. Facts that change over time (schemes, office-holders, rankings): say they may be out of date.

${qs.map(questionBlock).join('\n\n')}`;
  }
  /* Validates the model's solutions against the questions. Returns { [n]: solution } for the valid ones. */
  function readSolutions(raw, qs) {
    const byN = new Map(qs.map(q => [q.n, q])), out = {};
    for (const s of (raw && Array.isArray(raw.solutions) ? raw.solutions : [])) {
      const q = s && byN.get(s.n); if (!q) continue;
      let answer = cleanText(s.answer, 300); if (!answer) continue;
      if (q.type === 'mcq' || q.type === 'multi') {
        const letters = [...new Set((answer.toUpperCase().match(/\b[A-F]\b/g) || []))].filter(l => LETTERS.indexOf(l) < q.options.length).sort();
        if (!letters.length || (q.type === 'mcq' && letters.length !== 1)) continue;
        answer = letters.join(',');
      } else if (q.type === 'numeric') {
        const m = /[-−]?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?/.exec(answer.replace(/,(?=\d{3})/g, '')); if (!m) continue;
        answer = m[0].replace('−', '-').replace(/\s+/g, '');
      }
      out[q.n] = {
        answer, answerText: cleanText(s.answerText, 300) || answer, confidence: ['high', 'medium', 'low'].includes(s.confidence) ? s.confidence : 'low',
        idea: cleanText(s.idea, 500), steps: (Array.isArray(s.steps) ? s.steps : []).map(x => cleanText(x, 1200)).filter(Boolean).slice(0, 8),
        whyNot: cleanText(s.whyNot, 600), trap: cleanText(s.trap, 400), check: cleanText(s.check, 400), cantSolve: cleanText(s.cantSolve, 400), ts: Date.now()
      };
      // Sparky only saw a description of the figure, or part of the question was unreadable: never "high".
      if ((q.unreadable || q.figure) && out[q.n].confidence === 'high') out[q.n].confidence = 'medium';
    }
    return out;
  }
  /* The next questions to solve: unsolved ones in order, BATCH at a time. */
  function nextBatch(paper, size = BATCH) {
    const solved = paper.solutions || {}, failed = paper.failed || {};
    return paper.questions.filter(q => !solved[q.n] && (failed[q.n] || 0) < 2).slice(0, size); // twice unsolvable: left for the student to ask about
  }

  /* ---------- comparing and marking ---------- */
  const normAnswer = a => String(a || '').toUpperCase().replace(/[()\s]/g, '').replace(/OPTION/g, '').split(/[,;&]|AND/).filter(Boolean).sort().join(',');
  /* Does Sparky's answer match the paper's own answer key (when the paper had one)? true / false / null. */
  function matchesKey(q, sol, key) {
    if (!sol || key == null) return null;
    if (q.type === 'mcq' || q.type === 'multi') return normAnswer(sol.answer) === normAnswer(key);
    if (q.type === 'numeric') { const a = Number(sol.answer), b = Number(String(key).replace(/[^\d.\-]/g, '')); return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(b)) || Math.abs(a - b) < 0.011 : null; }
    return null;
  }
  /* The student's score on their own attempts, marked against a reference (the paper's key, else Sparky's answers),
     with the exam's usual marking. */
  function score(paper, attempts, examKey) {
    const e = examOf(examKey), m = (e && e.marking) || { right: 1, wrong: 0, blank: 0 };
    let right = 0, wrong = 0, total = 0, marks = 0, againstKey = 0;
    for (const q of paper.questions) {
      const mine = attempts && attempts[q.n]; if (mine == null || mine === '') continue;
      const key = paper.answerKey && paper.answerKey[q.n], sol = paper.solutions && paper.solutions[q.n];
      const ref = key != null ? key : sol && sol.answer; if (ref == null) continue;
      if (key != null) againstKey++;
      total++;
      const ok = q.type === 'numeric' ? matchesKey(q, { answer: mine }, ref) : normAnswer(mine) === normAnswer(ref);
      if (ok) { right++; marks += m.right; } else { wrong++; marks += q.type === 'numeric' && m.numericWrong != null ? m.numericWrong : m.wrong; }
    }
    return { right, wrong, total, marks: Math.round(marks * 100) / 100, againstKey, marking: e && e.marking ? e.name : null };
  }
  /* For the app's second-method check: the question with its options, and Sparky's answer as an answer line. */
  function checkInput(q, sol) {
    const opts = q.options.length ? ' ' + q.options.map((o, i) => `(${LETTERS[i].toLowerCase()}) ${o}`).join(' ') : '';
    const letter = (q.type === 'mcq') && /^[A-F]$/.test(sol.answer) ? sol.answer : null;
    return { question: q.text + opts, reply: `**Answer:** ${letter ? `(${letter.toLowerCase()}) ${q.options[LETTERS.indexOf(letter)]}` : sol.answer}` };
  }

  return { EXAMS, examOf, examRules, EXTRACT_SCHEMA, CHUNK, extractPrompt, readExtract, addQuestions, SOLVE_SCHEMA, BATCH, solvePrompt, readSolutions, nextBatch, matchesKey, score, checkInput, normAnswer, LETTERS, questionBlock };
});
