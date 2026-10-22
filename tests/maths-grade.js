// Grades one Sparky reply against a benchmark case. Deterministic: no model is used to judge.
// Failure modes (from the audit brief):
//   A wrong final answer · B invalid/non-equivalent algebra · C wrong explanation of a concept · D misread wording
//   E signs/brackets · F fraction simplification · G units/rounding · H unjustified geometry assumption
//   I answer fails when checked against the original problem · J routed away from the maths path
//   K tool requested but never run · L tool ran but its result was ignored · M claimed a verification that didn't run
//   N broken notation / raw LaTeX · O lost context in a follow-up · P repeated itself to a confused student
//   Q too advanced for the level · R oversimplified/inaccurate · S faulty practice question · T mishandled ambiguity
const SparkMath = require('../spark-math.js');
const SparkAI = require('../spark-ai.js');

const plainText = t => SparkMath.plain(t).replace(/\*\*/g, '');
const has = (t, re) => re.test(t) || re.test(plainText(t));

/* Raw LaTeX the student would see: render without KaTeX's help, drop the parts KaTeX would typeset, and look
   for LaTeX commands left over in the visible text. */
function rawLatex(text) {
  const html = SparkAI.md(text, { renderToString: () => '<k></k>' });
  const visible = html.replace(/<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>/g, '').replace(/<[^>]+>/g, ' ');
  const leaks = visible.match(/\\(frac|dfrac|sqrt|times|div|cdot|left|right|begin|end|text|le|ge|neq|pi)\b|\^\{|_\{/g) || [];
  return leaks.length ? leaks.slice(0, 3).join(' ') : '';
}

/* Two expressions are equal if they agree at several points for every letter in them. */
function sameExpression(got, want) {
  const g = SparkMath.parse(got), w = SparkMath.parse(want);
  if (!g || !w) return false;
  const letters = [...new Set((want + got).match(/[a-z]/gi) || [])].map(c => c.toLowerCase());
  const points = [[2, 3], [5, -1], [-3, 7], [11, 4]];
  return points.every(([p, q]) => {
    const env = {}; letters.forEach((l, i) => { env[l] = SparkMath.Q(BigInt(i % 2 ? q : p)); });
    const a = (() => { try { return SparkMath.evaluate(got, env); } catch (e) { return null; } })();
    const b = SparkMath.evaluate(want, env);
    return a !== null && b !== null && SparkMath.near(a, b);
  });
}

/* 10-dimension teaching rubric, 0-2 each (max 20). Heuristic but explicit: each dimension looks for concrete
   evidence in the text. It is a screen for missing teaching moves, not a human judgement of quality. */
function rubric(text, c = {}) {
  const t = String(text || ''), p = plainText(t);
  const count = re => (t.match(re) || []).length;
  const sentences = p.split(/(?<=[.!?])\s+|\n+/).map(s => s.trim()).filter(s => /[a-z]{3}/i.test(s));
  const words = sentences.reduce((n, s) => n + s.split(/\s+/).length, 0);
  const avg = sentences.length ? words / sentences.length : 0;
  const jargon = /\b(lemma|theorem|isomorph\w*|derivative|integral|asymptot\w*|bijection|commutative ring|modulo|axiom|manifold|vector space)\b/i.test(t);
  const s = {
    givenFind: (/\b(given|we know|we have)\b/i.test(t) ? 1 : 0) + (/\b(to find|find|we need|asked|goal)\b/i.test(t) ? 1 : 0),
    concept: Math.min(2, count(/\b(because|this works|means|the idea|rule|property|identity|balance|each part|equivalent)\b/gi)),
    steps: Math.min(2, count(/^\s*(\d+[.)]|step\s*\d|[-*•]\s)/gim)),
    reasons: Math.min(2, count(/\b(so that|because|to (get|make|remove|isolate|keep|undo|find)|since|that'?s why)\b/gi)),
    level: !sentences.length ? 0 : jargon ? 0 : avg <= 20 ? 2 : avg <= 26 ? 1 : 0,
    example: Math.min(2, count(/\b(imagine|like a|for example|e\.g\.|think of|picture|suppose|say you)\b/gi)),
    notation: rawLatex(t) ? 0 : 2,
    verification: /\b(check|verify|verification|substitut|LHS|RHS|put .{1,20} back)\b/i.test(t) ? 2 : 0,
    misconception: /\b(common mistake|careful|watch out|don'?t|mistake|misconception|trap|remember|not \w+ the)\b/i.test(t) ? 2 : 0,
    nextStep: /👉|\b(try|practice|your turn|now you|can you)\b/i.test(t) ? 2 : 0
  };
  s.total = Object.values(s).reduce((a, b) => a + b, 0);
  s.avgSentenceWords = Math.round(avg * 10) / 10;
  return s;
}

const FAB = /\b(verified|checked|confirmed|double-checked)\b[^.\n]{0,40}\b(python|code|computer|calculator|program|tool)\b|\b(python|my code|the code|calculator|computer)\b[^.\n]{0,30}\b(confirms?|verified|shows|checked)\b/i;

/* out: { text, checks: {ran, ok}|null, tools: {code, search}, route, sources } */
function grade(c, out) {
  const fails = [], flags = [];
  const fail = (mode, why) => fails.push({ mode, why });
  const text = String(out.text || '');
  const ans = SparkMath.answerOf(text);
  const caseMode = (c.modes || ['A'])[0];

  // J: the question has to take the maths path (reasoning puzzles may take the reasoning path).
  if (out.route && !['math', 'reasoning'].includes(out.route.subject) && !c.clarify && !c.history) fail('J', `routed as ${out.route.subject}/${out.route.kind}`);
  if (c.expect) {
    if (!ans) fail('N', 'no "**Answer:**" line');
    else {
      for (const e of c.expect) {
        const want = SparkMath.evaluate(e);
        if (!ans.nums.some(g => SparkMath.roughly(want, g.v, g.raw))) fail(c.modes && c.modes.includes('E') ? 'E' : c.modes && c.modes.includes('F') ? 'F' : 'A', `answer line "${ans.line.slice(0, 90)}" lacks ${e}`);
      }
    }
  }
  if (c.between) {
    const [lo, hi] = c.between.map(v => SparkMath.toNum(SparkMath.evaluate(v)));
    if (!ans || !ans.nums.some(g => { const v = SparkMath.toNum(g.v); return v > lo && v < hi; })) fail('A', `no value strictly between ${c.between.join(' and ')}`);
  }
  if (c.expr) {
    const line = ans ? ans.line : '';
    const rhs = SparkMath.plain(line).split('=').pop().replace(/[a-z]{2,}/gi, ' ').trim();
    if (!ans) fail('N', 'no "**Answer:**" line');
    else if (!sameExpression(rhs, c.expr)) fail('B', `answer "${line.slice(0, 80)}" is not equivalent to ${c.expr}`);
    else if (c.factored && !/\(/.test(SparkMath.plain(line))) fail('B', 'answer is not in factorised form');
  }
  if (c.unit && ans && !c.unit.test(ans.line) && !c.unit.test(plainText(ans.line))) fail('G', `answer line missing unit ${c.unit}`);
  for (const re of c.must || []) if (!has(text, re)) fail(c.clarify ? 'T' : c.history ? 'O' : caseMode, `missing ${re}`);
  for (const re of c.not || []) if (has(text, re)) fail(c.clarify ? 'T' : caseMode, `should not contain ${re}`);
  // I: an exact check of the original question disagrees with the final answer.
  const v = SparkMath.check(c.q, text);
  if (v.status === 'disagree' && c.expect) fail('I', v.note);
  // M: says it was verified by code/calculator, but no code ran.
  if (FAB.test(text) && !(out.checks && out.checks.ok > 0)) fail('M', 'claims a code/calculator verification that did not run');
  // N: LaTeX the student would see as raw text.
  const leak = rawLatex(text); if (leak) fail('N', `raw LaTeX visible: ${leak}`);
  if (!text.trim()) fail('A', 'empty reply');
  // Metrics (reported, not failures on their own).
  if (out.tools && out.tools.code && !(out.checks && out.checks.ran)) flags.push('K: code tool attached but not used');
  if (out.checks && out.checks.ok > 0 && fails.some(f => 'AEFI'.includes(f.mode))) fails.push({ mode: 'L', why: 'code ran but the final answer is still wrong' });
  const r = rubric(text, c);
  if (r.level === 0) flags.push(`Q: long sentences (${r.avgSentenceWords} words) or advanced jargon`);
  const practice = (text.match(/👉[^\n]*/) || [''])[0];
  const pq = practice && SparkMath.problemOf(practice.replace(/👉/, '').replace(/^[^:]*:\s*/, 'Solve '));
  if (pq && pq.kind === 'equation' && pq.roots.length && !pq.roots.every(x => SparkMath.Q && x.d === 1n)) flags.push(`S: practice question has a non-whole answer (${pq.roots.map(SparkMath.show).join(', ')})`);
  if (pq && pq.kind === 'equation' && (pq.none || pq.identity)) fails.push({ mode: 'S', why: 'practice question has no single solution' });
  // Tutoring: a re-explanation must not be the first explanation reworded (P), and a direct request needs the answer.
  let ov;
  if (c.differentFrom) { ov = Math.round(overlap(text, c.differentFrom) * 100) / 100; if (ov > 0.5) fails.push({ mode: 'P', why: `re-explanation reuses ${Math.round(ov * 100)}% of the first explanation's words` }); }
  return { status: fails.length ? 'FAIL' : 'PASS', fails, flags, rubric: r, verifier: v.status, overlap: ov };
}

/* Word overlap between two explanations (0-1). Used for scenario D: a re-explanation must not be a rewording. */
function overlap(a, b) {
  const w = t => new Set(String(t).toLowerCase().match(/[a-z]{4,}/g) || []);
  const A = w(a), B = w(b); if (!A.size || !B.size) return 0;
  let same = 0; for (const x of A) if (B.has(x)) same++;
  return same / Math.min(A.size, B.size);
}

module.exports = { grade, rubric, rawLatex, sameExpression, overlap };
