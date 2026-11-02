/* Spark learns from checked examples, for free: no training and no extra AI calls.
   When an answer passes one of Spark's checks (the exact calculator, the second method, or a paper's own answer key),
   the question and answer are kept on the student's device. Questions a person has reviewed in the question banks
   can be shipped to everyone (examples/reviewed.json). When a similar question comes up, the closest one or two
   examples are given to Sparky as a guide to method and format, never as an answer to copy.
   Unreviewed AI drafts are never used. Shared by the app (index.html) and the tests. No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SparkExamples = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const MAX = 300, SOURCES = ['exact', 'second', 'key', 'reviewed'];
  const STOP = new Set('a an the of to in on at for and or is are was were be been it its this that these those what which who whom how why when where do does did can could will would should i you we they he she my your our me us find calculate solve work out please tell give show explain value answer question if then than with by from as into about'.split(' '));

  /* Words that say what a question is about. Numbers become "#", so "15% of 800" is close to "20% of 640"; an unknown like 3x and an "=" count too;
     LaTeX commands are dropped; Hindi (Devanagari) words are kept. */
  function tokens(text) {
    return String(text || '').toLowerCase()
      .replace(/\\[a-z]+/g, ' ').replace(/[{}$\\]/g, ' ')
      .replace(/(\d)\s*[a-z](?![a-z])/g, '$1 var ').replace(/=/g, ' eq ') // "3x" has an unknown, "=" makes an equation
      .replace(/\d+(\.\d+)?/g, ' # ')
      .match(/[a-zऀ-ॿ#%²³√π]+/g)?.filter(w => w === '#' || w === '%' || (w.length > 1 && !STOP.has(w))) || [];
  }
  const norm = q => tokens(q).join(' ');

  /* Adds a checked example (newest first, no repeated question, at most MAX). Returns the list. */
  function add(list, ex) {
    if (!ex || !SOURCES.includes(ex.how) || !String(ex.q || '').trim() || !String(ex.a || '').trim()) return list;
    const key = norm(ex.q), clean = { id: ex.id || String(Date.now()) + Math.random().toString(36).slice(2, 6), q: String(ex.q).slice(0, 1500), a: String(ex.a).slice(0, 2500), subject: ex.subject || 'general', klass: ex.klass || '', how: ex.how, ts: ex.ts || Date.now() };
    return [clean, ...list.filter(x => norm(x.q) !== key)].slice(0, MAX);
  }

  /* The k closest examples to a question: shared words, with numbers, "=" and unknowns counting less than real
     words, balanced both ways (an example about much more, or much less, scores lower). Only from the same subject
     when one is given, and only above a minimum similarity. Works the same with 1 example or 300. */
  const weight = w => (w === '#' ? 0.25 : w === 'eq' || w === 'var' || w === '%' ? 0.6 : 1);
  function similarity(q, d) {
    let hit = 0, tq = 0, td = 0;
    for (const w of q) { tq += weight(w); if (d.has(w)) hit += weight(w); }
    for (const w of d) td += weight(w);
    if (!hit) return 0;
    const a = hit / tq, b = hit / td;
    return (2 * a * b) / (a + b);
  }
  function retrieve(query, list, opts = {}) {
    const k = opts.k || 2, min = opts.min == null ? 0.5 : opts.min, q = new Set(tokens(query));
    if (q.size < 2 || !list || !list.length) return []; // "What is 45 + 37?" needs no example
    return list.filter(x => !opts.subject || !x.subject || x.subject === opts.subject || x.subject === 'general')
      .map(x => ({ x, score: similarity(q, new Set(tokens(x.q))) }))
      .filter(s => s.score >= min).sort((a, b) => b.score - a.score || b.x.ts - a.x.ts).slice(0, k).map(s => s.x);
  }

  const HOW = { exact: 'checked by Spark’s exact calculator', second: 'checked a second, independent way', key: 'matched a paper’s answer key', reviewed: 'reviewed by a person' };
  /* The text added to Sparky's instructions. Empty when there is nothing close enough. */
  function promptBlock(examples) {
    if (!examples || !examples.length) return '';
    return `CHECKED EXAMPLES (earlier questions whose answers passed a check). Use them only as a guide to a method and a format that worked. This question is different: work it out fresh, never copy their numbers or answer, and if an example doesn't fit, ignore it.
${examples.map((e, i) => `--- Example ${i + 1} (${HOW[e.how]}) ---\nQuestion: ${e.q.slice(0, 600)}\nAnswer: ${e.a.slice(0, 1200)}`).join('\n')}`;
  }

  /* Bank subjects → the subjects Spark's router uses (exam sets mix subjects, so they match any). */
  const SUBJECT_OF = { science: 'science', physics: 'science', chemistry: 'science', biology: 'science', social: 'social', history: 'social', geography: 'social', polsci: 'social', economics: 'social', sociology: 'social', psychology: 'social', business: 'social', accountancy: 'math', english: 'english', hindi: 'hindi', computer: 'coding' };
  /* Bank questions a person marked reviewed, as examples (used by tests/bank-tools.mjs export-reviewed). */
  function fromBank(q) {
    if (!q || q.reviewed !== true) return null;
    const a = q.type === 'mcq' ? `(${q.answer}) ${q.options['ABCD'.indexOf(q.answer)]}. ${q.explanation}` : `${q.answer} ${q.explanation}`;
    const qq = q.type === 'mcq' ? `${q.q} ${q.options.map((o, i) => `(${'ABCD'[i]}) ${o}`).join(' ')}` : q.q;
    return { id: q.id, q: qq, a, subject: SUBJECT_OF[q.subject] || 'general', klass: q.class ? `Class ${q.class}` : '', how: 'reviewed', ts: 0 };
  }

  return { tokens, add, retrieve, promptBlock, fromBank, MAX };
});
