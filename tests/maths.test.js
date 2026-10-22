// Offline maths tests (no network): the exact checker, routing over the whole benchmark, per-turn teaching
// guidance, streaming-safe rendering, and the grader itself. Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../spark-math.js');
const AI = require('../spark-ai.js');
const { grade, rubric, rawLatex, sameExpression, overlap } = require('./maths-grade.js');
const CASES = require('./maths-cases.js'), TUTOR = require('./tutor-cases.js');
const val = q => { const p = M.problemOf(q); return p && (p.kind === 'equation' ? p.roots.map(M.show).sort().join(',') : M.show(p.value)); };

/* ---------- exact arithmetic ---------- */
test('exact arithmetic: fractions, negatives, powers, roots, percentages', () => {
  const e = s => M.show(M.evaluate(s));
  assert.equal(e('-3/4 + 5/8'), '-1/8');
  assert.equal(e('(−12) + 7 − (−5)'), '0');
  assert.equal(e('(−2)³ × (−2)²'), '-32');
  assert.equal(e('2⁻³'), '1/8');
  assert.equal(e('(5^2)^3 ÷ 5^4'), '25');
  assert.equal(e('√1764'), '42');
  assert.equal(e('∛(−343)'), '-7');
  assert.equal(e('0.1 + 0.2'), '3/10', 'no floating-point error');
  assert.equal(e('15%'), '3/20');
  assert.equal(e('2 1/3 + 1 3/4'), '49/12', 'mixed numbers');
  assert.equal(e('3/4 ÷ 1/2'), '3/2', 'school reading: fractions bind before ÷');
  assert.equal(e('\\frac{3}{4} \\div \\frac{1}{2}'), '3/2');
  assert.equal(M.evaluate('5/0'), null, 'division by zero is not a number');
});
test('equations: linear, brackets, fractions, decimals, quadratics, no solution', () => {
  const s = q => { const r = M.solve(q); return r && (r.none ? 'none' : r.identity ? 'all' : r.roots.map(M.show).sort().join(',')); };
  assert.equal(s('2x + 5 = 17'), '6');
  assert.equal(s('3(2x − 5) = 4x + 7'), '11');
  assert.equal(s('−4(x + 2) = 2(x − 7)'), '1');
  assert.equal(s('(x − 1)/2 = (x + 2)/5'), '3');
  assert.equal(s('0.5x − 1.2 = 0.3x + 0.4'), '8');
  assert.equal(s('x² − 5x + 6 = 0'), '2,3');
  assert.equal(s('2(x + 3) = 2x + 5'), 'none');
  assert.equal(s('2(x + 3) = 2x + 6'), 'all');
  assert.equal(s('x^2 = -4'), 'none');
  assert.equal(s('x^3 = 8'), null, 'cubic: not checked, left to the model');
});
test('reading questions: only unambiguous single problems are checked', () => {
  assert.equal(val('Solve 3(2x − 5) = 4x + 7 and verify the result by substitution.'), '11');
  assert.equal(val('Calculate −3/4 + 5/8 and explain the common-denominator method.'), '-1/8');
  assert.equal(val('What is 3/4 divided by 1/2?'), '3/2');
  assert.equal(val('What is 15% of 240?'), '36');
  assert.equal(val('What is 2 1/3 + 1 3/4? Give the answer as a mixed number.'), '49/12');
  assert.equal(val('2x + 5 = 17 ko solve karo'), '6');
  assert.equal(val('What is 6 ÷ 2(1+2)?'), null, 'ambiguous notation');
  assert.equal(val('Solve 1/2x = 4'), null, 'ambiguous notation');
  assert.equal(val('I got 2³ × 2⁴ = 2¹². Is that right?'), null, "a student's claim is not the question");
  assert.equal(val('A rectangle has a length of 8 cm. What is its area?'), null);
  assert.equal(val('What happened in 1857?'), null);
  assert.equal(val('Find the value of 2x² − 3x + 1 when x = −2.'), '15', 'regression: "when x = −2" is a substitution, not an equation');
  assert.equal(val('Evaluate 3a + 4 if a = 5'), '19');
});
test('reading answers and comparing them exactly', () => {
  const st = (q, a) => M.check(q, a).status;
  assert.equal(st('Solve 2x + 5 = 17', '**Answer:** \\(x = 6\\)'), 'agree');
  assert.equal(st('Solve 2x + 5 = 17', '**Answer:** x = 7'), 'disagree');
  assert.equal(st('Solve 3(2x − 5) = 4x + 7', '**Answer:** \\(x = 12/2 = 6\\)'), 'disagree');
  assert.equal(st('Calculate −3/4 + 5/8', '**Answer:** \\(-\\frac{1}{8}\\)'), 'agree');
  assert.equal(st('What is 3/4 divided by 1/2?', '**Answer:** 1.5 (or \\(\\frac{3}{2}\\))'), 'agree');
  assert.equal(st('Solve x² − 5x + 6 = 0', '**Answer:** \\(x = 2\\) or \\(x = 3\\)'), 'agree');
  assert.equal(st('Solve x² − 5x + 6 = 0', '**Answer:** \\(x = 2\\)'), 'disagree', 'a missing root is wrong');
  assert.equal(st('Simplify 1/3 + 1/3', '**Answer:** 0.67 (rounded)'), 'agree', 'rounded to the decimals written');
  assert.equal(st('Simplify 1/3 + 1/3', '**Answer:** 0.6'), 'disagree');
  assert.equal(st('What is 15% of 2,000?', '**Answer:** ₹300'), 'agree');
  assert.equal(st('What is 2 1/3 + 1 3/4?', '**Answer:** \\(4\\frac{1}{12}\\)'), 'agree');
  assert.equal(st('Solve 2x + 5 = 17', 'x is 6.'), 'unknown', 'no answer line, no claim');
});

/* ---------- routing over the whole benchmark ---------- */
const routeOf = c => {
  const prev = (c.history || []).filter(h => h[0] === 'model').pop();
  return AI.route(c.q, { hasImage: !!c.image, prevSubject: c.history ? AI.route(c.history[0][1]).subject : undefined, prevModelText: prev && prev[1] });
};
test('regression (J): every benchmark question takes the maths path, numeric problems get the checker, none trigger web search', () => {
  const off = CASES.filter(c => { const r = routeOf(c); return !['math', 'reasoning'].includes(r.subject) || (c.expect && !c.history && !r.needsCode) || r.needsSearch; });
  assert.deepEqual(off.map(c => c.id), []);
});
test('routing: word problems without symbols, Hindi script and ordinary prices', () => {
  for (const q of ['A number is multiplied by 5 and then 8 is subtracted. The result is 32. Find the number.', 'Aman is three times as old as his daughter. In 5 years, the sum of their ages will be 50.', 'One pipe fills a tank in 6 hours and another in 3 hours. How long together?', 'A bus leaves at 9:40 am and arrives at 1:15 pm. How long is the journey?', 'एक त्रिभुज के दो कोण 50° और 60° हैं। तीसरा कोण ज्ञात कीजिए।', 'The price of a book went up from ₹250 to ₹300. What is the percentage increase?']) {
    const r = AI.route(q); assert.equal(r.subject, 'math', q); assert.equal(r.needsSearch, false, q);
  }
});
test('routing: a number alone does not make a maths question', () => {
  for (const q of ['What happened in 1857?', 'When did India get independence in 1947?', 'Summarise Class 8 history chapter 3', 'Name 5 animals that live in the desert', 'Give me 3 tips for my exam', 'Write a story about 2 friends']) assert.notEqual(AI.route(q).subject, 'math', q);
  assert.equal(AI.route('What is the latest price of petrol in Delhi?').needsSearch, true);
});
test('regression: follow-ups, attempts, hints and confusion are not treated as new problems', () => {
  const kinds = Object.fromEntries(TUTOR.map(c => [c.id, routeOf(c).kind]));
  assert.deepEqual(kinds, { 'tutor-A': 'reexplain', 'tutor-B': 'attempt', 'tutor-C': 'explain-step', 'tutor-D': 'reexplain', 'tutor-E': 'problem', 'tutor-F': 'hint', 'tutor-G': 'explain-step', 'tutor-H': 'attempt' });
  assert.equal(AI.route('7', { prevSubject: 'math', prevModelText: '👉 Try: 3x + 4 = 25' }).kind, 'attempt', 'an answer to the practice question');
  assert.equal(routeOf(TUTOR.find(c => c.id === 'tutor-F')).needsCode, false);
});
test('guidance: each kind of turn gets its own instruction, and the full-solution order only for new problems', () => {
  const lv = AI.levelOf('Class 8');
  const g = q => AI.turnGuidance(routeOf(TUTOR.find(c => c.id === q)), { level: lv, code: true });
  assert.match(g('tutor-G'), /quote it with its actual numbers/);
  assert.doesNotMatch(g('tutor-G'), /full worked solution/);
  assert.match(g('tutor-B'), /never call it right/);
  assert.match(g('tutor-F'), /ONE small hint/);
  assert.match(g('tutor-D'), /change the method/);
  assert.match(g('tutor-E'), /full worked solution/);
  assert.match(g('tutor-E'), /THEY NEED IT DIRECTLY/);
  assert.match(AI.systemPrompt({ grade: 'Class 8', route: AI.route('Solve 2x + 5 = 17'), code: true }), /never give an answer your own check contradicts/);
});
test('re-check instruction names the reading and both answers without telling the student', () => {
  const t = AI.recheckInstruction(M.check('Solve 3(2x − 5) = 4x + 7', '**Answer:** x = 6'));
  assert.match(t, /3\(2x - 5\) = 4x \+ 7/);
  assert.match(t, /x = 11/);
  assert.match(t, /said 6/);
  assert.match(t, /Don't mention this note/);
});

/* ---------- rendering ---------- */
const K = { renderToString: (s, o) => `<k${o.displayMode ? ' d' : ''}>${s}</k>` };
test('rendering: half-typed maths is hidden while streaming', () => {
  assert.equal(AI.trimOpenMath('So \\(x = \\frac{3}{'), 'So ');
  assert.equal(AI.trimOpenMath('Done \\(x=1\\) then \\[2x'), 'Done \\(x=1\\) then ');
  assert.equal(AI.trimOpenMath('a $$x'), 'a ');
  assert.equal(AI.trimOpenMath('fine \\(x\\)'), 'fine \\(x\\)');
});
test('rendering: nested fractions, roots, subscripts, aligned steps, maths in lists and Hindi', () => {
  assert.match(AI.md('\\(\\frac{\\frac{1}{2}}{3}\\)', K), /<k>\\frac\{\\frac\{1\}\{2\}\}\{3\}<\/k>/);
  assert.match(AI.md('\\(\\sqrt[3]{-343} = -7\\) and \\(a_1\\)', K), /<k>\\sqrt\[3\]\{-343\} = -7<\/k>.*<k>a_1<\/k>/);
  assert.match(AI.md('\\begin{align*} 2x &= 12 \\\\ x &= 6 \\end{align*}', K), /<k d>\\begin\{aligned\}/);
  assert.match(AI.md('1. Subtract 5: \\(2x = 12\\)\n2. Divide: \\(x = 6\\)', K), /<ol><li>Subtract 5: <k>2x = 12<\/k><\/li><li>Divide: <k>x = 6<\/k><\/li><\/ol>/);
  assert.match(AI.md('दोनों तरफ़ से 5 घटाओ: \\(2x = 12\\)', K), /दोनों तरफ़ से 5 घटाओ: <k>2x = 12<\/k>/);
  assert.equal(rawLatex('\\(\\frac{1}{2}\\)'), '');
  assert.match(rawLatex('half is \\frac{1}{2}'), /\\frac/);
});

/* ---------- the grader itself ---------- */
const c = id => CASES.find(x => x.id === id);
const run = (id, text, extra = {}) => grade(c(id), Object.assign({ text, route: routeOf(c(id)), tools: { code: true }, checks: { ran: 1, ok: 1 } }, extra));
test('grader: right answers pass, wrong ones fail with the right failure mode', () => {
  assert.equal(run('lin-2', '**Given** … **Check:** LHS = RHS = 51\n**Answer:** \\(x = 11\\)').status, 'PASS');
  const wrong = run('lin-2', '**Check:** LHS\n**Answer:** x = 12');
  assert.deepEqual([...new Set(wrong.fails.map(f => f.mode))].sort(), ['E', 'I', 'L']);
  assert.ok(run('lin-2', 'Verified with Python. Check: LHS\n**Answer:** x = 11', { checks: null }).fails.some(f => f.mode === 'M'), 'fabricated verification');
  assert.ok(run('men-1', '**Answer:** 50').fails.some(f => f.mode === 'G'), 'missing unit');
  assert.ok(run('fac-1', 'product 12, sum 7 **Answer:** (x+3)(x+5)').fails.some(f => f.mode === 'B'));
  assert.ok(run('cl-1', 'Need the width. **Answer:** 40 cm²').fails.some(f => f.mode === 'T'), 'invented a missing number');
  assert.ok(run('lin-1', 'So it is \\frac{12}{2}. **Answer:** x = 6').fails.some(f => f.mode === 'N'), 'raw LaTeX');
  assert.equal(run('fr-3', '**Answer:** \\(4\\frac{1}{12}\\)').status, 'PASS');
  assert.equal(run('rat-4', '**Answer:** \\(\\frac{7}{24}\\)').status, 'PASS');
});
test('grader: algebraic equivalence and the rubric', () => {
  assert.ok(sameExpression('4a^2 - 9b^2', '4a^2-9b^2'));
  assert.ok(sameExpression('(x+3)(x+4)', 'x^2+7x+12'));
  assert.ok(!sameExpression('(x+3)(x+5)', 'x^2+7x+12'));
  const good = rubric('**Given:** \\(2x + 5 = 17\\). **To find:** \\(x\\).\nAn equation is like a balance, because both sides are equal.\n1. Subtract 5 from both sides so that x is alone: \\(2x = 12\\).\n2. Divide by 2: \\(x = 6\\).\nImagine a weighing scale. Careful: don\'t subtract 5 from one side only.\n**Check:** \\(2(6)+5 = 17\\).\n**Answer:** \\(x = 6\\)\n👉 Try \\(3x + 4 = 25\\)');
  assert.ok(good.total >= 18, `rubric ${good.total}`);
  assert.ok(rubric('**Answer:** 6').total <= 6);
  assert.ok(overlap('the denominator tells the size of the parts', 'the denominator tells the size of each part') > 0.5);
});
test('benchmark: at least 100 distinct cases covering all 20 areas, each with an independent expectation or rubric', () => {
  assert.ok(CASES.length >= 100);
  assert.equal(new Set(CASES.map(x => x.id)).size, CASES.length);
  assert.ok(new Set(CASES.map(x => x.cat)).size >= 20);
  for (const x of CASES) assert.ok(x.expect || x.expr || x.must || x.between, `${x.id} has nothing to grade`);
  for (const x of CASES.filter(x => x.expect || x.expr)) assert.ok(x.py, `${x.id} has no independent Python check`);
});

/* ---------- regressions from a real student conversation (perfume shop) ---------- */
test('regression: numbered steps keep counting when display maths sits between them', () => {
  const h = AI.md('1. First:\n\\[10+10+10=30\\]\n1. Cost:\n\\[30 \\times 250\\]\n1. Third', K);
  assert.match(h, /<ol><li>First:<\/li><\/ol>.*<ol start="2"><li>Cost:<\/li><\/ol>.*<ol start="3"><li>Third<\/li><\/ol>/s);
  assert.match(AI.md('1. a\n\nA paragraph\n\n1. b', K), /<p>A paragraph<\/p><ol><li>b/, 'a real new list still starts at 1');
});
test('regression: thousands separators stay one number in maths', () => {
  assert.match(AI.md('\\(30 \\times 250 = 7,500\\) and \\(1,00,000\\)', K), /7\{,\}500.*1\{,\}00\{,\}000/s);
  assert.doesNotMatch(AI.md('\\(f(x, y)\\)', K), /\{,\}/, 'commas between letters are left alone');
});
test('regression: maths rules tell Sparky to read shop questions sensibly and sanity-check results', () => {
  const p = AI.systemPrompt({ grade: 'Class 8', route: AI.route(CASES.find(x => x.id === 'pl-9').q), code: true });
  assert.match(p, /"10 for 650" after a cost of ₹250 each means ₹650 each/);
  assert.match(p, /margin below −100%/);
  assert.match(p, /profit % = profit ÷ cost price × 100/);
  const r = AI.route(CASES.find(x => x.id === 'pl-9').q);
  assert.equal(r.subject, 'math'); assert.equal(r.needsCode, true); assert.equal(r.needsSearch, false);
});

/* ---------- regressions: answer formats the live benchmark showed were misread ---------- */
test('regression: units, percentages, ratios, worded and list answers are read correctly', () => {
  const nums = a => M.answerOf(a).nums.map(x => M.show(x.v));
  assert.ok(nums('**Answer:** \\(20\\%\\)').includes('20'), 'a percentage answer is 20, not only 0.2');
  assert.deepEqual(nums('**Answer:** \\(80\\text{ km/h}\\)'), ['80']);
  assert.deepEqual(nums('**Answer:** \\( 50\\text{ cm}^2 \\)'), ['50'], 'cm² is a unit, not a square');
  assert.deepEqual(nums('**Answer:** \\(480\\text{ cm}^3\\)'), ['480']);
  assert.deepEqual(nums('**Answer:** \\(3 : 4\\)'), ['3', '4'], 'a ratio is two numbers, not 12');
  assert.deepEqual(nums('**Answer:** \\(0.7\\) is greater than \\(0.65\\) by \\(0.05\\).'), ['7/10', '13/20', '1/20']);
  assert.deepEqual(nums("**Answer:** Aman's present age is 30 years and his daughter's present age is 10 years."), ['30', '10']);
  assert.deepEqual(nums('**Answer:**\n* **Mean:** \\(17\\)\n* **Median:** \\(15\\)\n* **Range:** \\(13\\)\n\n👉 next'), ['17', '15', '13']);
  assert.ok(nums('**Answer:** \\(10,000\\text{ cm}^2\\)').includes('10000'));
  assert.deepEqual(nums('**Answer:** $20\\text{ m/s}$'), ['20']);
  assert.equal(M.check('What is 3/8 as a percentage?', '**Answer:** 37.5%').status, 'agree');
  assert.equal(M.check('Solve x² − 5x + 6 = 0', '**Answer:** \\(x = 2\\)').status, 'disagree', 'still catches a missing root');
});
test('regression: grader compares the first algebraic form and keeps two-letter terms like 2ab', () => {
  const { sameExpression } = require('./maths-grade.js');
  const g = (id, line) => grade(CASES.find(x => x.id === id), { text: `**Answer:** ${line}`, route: AI.route(CASES.find(x => x.id === id).q), tools: {}, checks: null });
  assert.equal(g('alg-6', '\\( 2a^2 + 2ab - 2 \\)').fails.filter(f => f.mode === 'B').length, 0);
  assert.equal(g('fac-5', '\\((2y + 3)^2\\) (or \\((2y + 3)(2y + 3)\\))').fails.filter(f => f.mode === 'B').length, 0);
  assert.ok(!sameExpression('2a^2 + 2 - 2', '2a^2+2ab-2'));
});
test('regression: an answer on the line after the label is read', () => {
  const nums = a => M.answerOf(a).nums.map(x => M.show(x.v));
  assert.deepEqual(nums('**Answer:**\n\\[ x = 6 \\]\n\n👉 Try 3x + 4 = 25'), ['6']);
  assert.deepEqual(nums('**Answer:**\n\n65°'), ['65']);
  assert.deepEqual(nums('**Answer:** \\(x = 6\\)\n\n👉 Try 3x+4=25'), ['6']);
});
