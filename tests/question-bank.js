// Generated maths question bank for Classes 1-12: every topic at three difficulty levels (1 easy, 2 medium,
// 3 hard). Questions come from templates with random numbers from a fixed seed, so the bank is the same every run
// and can be as large as needed. Every answer is worked out twice, separately: here in JavaScript (exact fractions
// with spark-math.js) and in Python/sympy from the `py` expression (tests/verify_expected.py BANK=1), so a wrong
// answer key can't slip in. Topics follow the usual NCERT/CBSE maths chapters for each class; they are a testing
// aid, not curriculum data, and only cover questions with a numeric answer.
//
//   const bank = require('./question-bank.js');
//   bank.forClass(7, 500)   // 500 questions for Class 7, spread evenly over its topics and the three levels
//   bank.all(500)           // 500 per class, Classes 1-12
// Each case: { cat, id, q, expect: [...], py, klass, topic, level } (the same shape as tests/maths-cases.js).
const M = require('../spark-math.js');

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const val = e => { const v = M.evaluate(e); if (v === null) throw new Error('bank: cannot evaluate ' + e); return M.show(v); };
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
const lcm = (a, b) => a / gcd(a, b) * b;
const fact = n => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
const sgn = n => (n < 0 ? `(${n})` : String(n));
const NAMES = ['Riya', 'Aarav', 'Meera', 'Kabir', 'Ananya', 'Vihaan', 'Zoya', 'Arjun', 'Isha', 'Dev'];

/* Each topic: (r, level) → { q, expect, py }. r has int(lo, hi), pick(list), name(). */
const T = {
  1: {
    'addition': (r, l) => { const m = [9, 20, 50][l - 1]; const a = r.int(1, m - 1), b = r.int(1, m - a); return { q: `What is ${a} + ${b}?`, expect: [String(a + b)], py: `${a}+${b}` }; },
    'subtraction': (r, l) => { const m = [10, 20, 50][l - 1]; const a = r.int(2, m), b = r.int(1, a - 1); return { q: `What is ${a} − ${b}?`, expect: [String(a - b)], py: `${a}-${b}` }; },
    'numbers before and after': (r, l) => { const a = r.int(2, [20, 50, 99][l - 1]); const after = r.int(0, 1); return { q: `What number comes just ${after ? 'after' : 'before'} ${a}?`, expect: [String(after ? a + 1 : a - 1)], py: after ? `${a}+1` : `${a}-1` }; },
    'addition stories': (r, l) => { const a = r.int(2, [5, 10, 25][l - 1]), b = r.int(2, [4, 10, 25][l - 1]), n = r.name(); return { q: `${n} has ${a} marbles and gets ${b} more. How many marbles does ${n} have now?`, expect: [String(a + b)], py: `${a}+${b}` }; },
    'subtraction stories': (r, l) => { const a = r.int(5, [10, 20, 50][l - 1]), b = r.int(1, a - 1), n = r.name(); return { q: `${n} had ${a} balloons. ${b} flew away. How many balloons are left?`, expect: [String(a - b)], py: `${a}-${b}` }; },
    'counting in tens': (r, l) => { const t = r.int(1, 9), o = r.int(0, 9); return l === 1 ? { q: `How many tens make ${t * 10}?`, expect: [String(t)], py: `${t * 10}//10` } : { q: `What number is ${t} tens and ${o} ones?`, expect: [String(t * 10 + o)], py: `${t}*10+${o}` }; }
  },
  2: {
    'two-digit addition': (r, l) => { const a = r.int(10, [40, 70, 89][l - 1]), b = r.int(10, 99 - a); return { q: `Add ${a} and ${b}.`, expect: [String(a + b)], py: `${a}+${b}` }; },
    'two-digit subtraction': (r, l) => { const a = r.int(30, 99), b = r.int(10, a - 1); return { q: `What is ${a} − ${b}?`, expect: [String(a - b)], py: `${a}-${b}` }; },
    'multiplication tables': (r, l) => { const a = r.int(2, [5, 10, 10][l - 1]), b = r.int(1, 10); return { q: `What is ${a} × ${b}?`, expect: [String(a * b)], py: `${a}*${b}` }; },
    'place value': (r, l) => { const n = r.int(l === 3 ? 100 : 10, l === 3 ? 999 : 99); const t = Math.floor(n / 10) % 10; return { q: `What digit is in the tens place of ${n}?`, expect: [String(t)], py: `(${n}//10)%10` }; },
    'money': (r, l) => { const a = r.pick([5, 10, 20]), na = r.int(1, 4), b = r.pick([1, 2, 5]), nb = r.int(1, [3, 5, 9][l - 1]); return { q: `How much money is ${na} notes of ₹${a} and ${nb} coins of ₹${b}?`, expect: [String(na * a + nb * b)], py: `${na}*${a}+${nb}*${b}` }; },
    'equal groups': (r, l) => { const g = r.int(2, 5), e = r.int(2, [5, 8, 10][l - 1]); return { q: `There are ${g} plates with ${e} laddoos on each plate. How many laddoos are there in all?`, expect: [String(g * e)], py: `${g}*${e}` }; }
  },
  3: {
    'three-digit addition': (r, l) => { const a = r.int(100, 600), b = r.int(100, 999 - a); return { q: `What is ${a} + ${b}?`, expect: [String(a + b)], py: `${a}+${b}` }; },
    'three-digit subtraction': (r, l) => { const a = r.int(300, 999), b = r.int(100, a - 1); return { q: `Subtract ${b} from ${a}.`, expect: [String(a - b)], py: `${a}-${b}` }; },
    'multiplication': (r, l) => { const a = r.int([10, 20, 40][l - 1], [30, 60, 99][l - 1]), b = r.int(2, 9); return { q: `Multiply ${a} by ${b}.`, expect: [String(a * b)], py: `${a}*${b}` }; },
    'division': (r, l) => { const b = r.int(2, 9), q = r.int(2, [10, 20, 50][l - 1]); return { q: `What is ${b * q} ÷ ${b}?`, expect: [String(q)], py: `${b * q}//${b}` }; },
    'half and quarter': (r, l) => { const k = r.pick(l === 1 ? [2] : [2, 4]), n = k * r.int(2, [10, 20, 40][l - 1]); return { q: `What is ${k === 2 ? 'half' : 'one quarter'} of ${n}?`, expect: [String(n / k)], py: `F(${n},${k})` }; },
    'time': (r, l) => { const h = r.int(1, [3, 6, 10][l - 1]), m = l === 1 ? 0 : r.pick([15, 30, 45]); return { q: `How many minutes are there in ${h} hour${h > 1 ? 's' : ''}${m ? ` and ${m} minutes` : ''}?`, expect: [String(h * 60 + m)], py: `${h}*60+${m}` }; }
  },
  4: {
    'large multiplication': (r, l) => { const a = r.int([100, 150, 300][l - 1], [200, 500, 999][l - 1]), b = r.int(11, [20, 50, 99][l - 1]); return { q: `What is ${a} × ${b}?`, expect: [String(a * b)], py: `${a}*${b}` }; },
    'division with remainder': (r, l) => { const b = r.int(3, 9), q = r.int(10, [30, 90, 200][l - 1]), rem = r.int(1, b - 1), a = b * q + rem; return { q: `Divide ${a} by ${b}. What are the quotient and the remainder?`, expect: [String(q), String(rem)], py: `[${a}//${b}, ${a}%${b}]` }; },
    'perimeter of rectangles': (r, l) => { const a = r.int(3, [10, 30, 90][l - 1]), b = r.int(2, a); return { q: `A rectangle is ${a} cm long and ${b} cm wide. What is its perimeter?`, expect: [String(2 * (a + b))], py: `2*(${a}+${b})` }; },
    'like fractions': (r, l) => { const d = r.int(5, 12), a = r.int(1, d - 2), b = r.int(1, d - 1 - a); return { q: `What is ${a}/${d} + ${b}/${d}?`, expect: [val(`${a}/${d}+${b}/${d}`)], py: `F(${a},${d})+F(${b},${d})` }; },
    'metres and centimetres': (r, l) => { const m = r.int(1, [5, 20, 50][l - 1]), c = l === 1 ? 0 : r.int(1, 99); return { q: `How many centimetres are there in ${m} m${c ? ` ${c} cm` : ''}?`, expect: [String(m * 100 + c)], py: `${m}*100+${c}` }; },
    'money stories': (r, l) => { const n = r.int(2, [5, 12, 25][l - 1]), p = r.int(12, [50, 150, 450][l - 1]), nm = r.name(); return { q: `${nm} buys ${n} notebooks at ₹${p} each. How much does ${nm} pay?`, expect: [String(n * p)], py: `${n}*${p}` }; }
  },
  5: {
    'LCM': (r, l) => { const a = r.int(2, [10, 20, 40][l - 1]), b = r.int(2, [12, 24, 48][l - 1]); return { q: `Find the LCM of ${a} and ${b}.`, expect: [String(lcm(a, b))], py: `sp.ilcm(${a},${b})` }; },
    'HCF': (r, l) => { const g = r.int(2, [6, 12, 25][l - 1]), a = g * r.int(2, 9), b = g * r.int(2, 9); return { q: `Find the HCF of ${a} and ${b}.`, expect: [String(gcd(a, b))], py: `sp.igcd(${a},${b})` }; },
    'decimal addition': (r, l) => { const a = (r.int(10, [99, 999, 9999][l - 1]) / [10, 100, 100][l - 1]).toFixed([1, 2, 2][l - 1]), b = (r.int(10, [99, 999, 9999][l - 1]) / [10, 100, 100][l - 1]).toFixed([1, 2, 2][l - 1]); return { q: `What is ${a} + ${b}?`, expect: [val(`${a}+${b}`)], py: `F('${a}')+F('${b}')` }; },
    'area of rectangles': (r, l) => { const a = r.int(3, [12, 40, 120][l - 1]), b = r.int(2, [10, 30, 80][l - 1]); return { q: `Find the area of a rectangle ${a} m long and ${b} m wide.`, expect: [String(a * b)], py: `${a}*${b}` }; },
    'kilograms and grams': (r, l) => { const k = r.int(1, [5, 20, 60][l - 1]), g = l === 1 ? 0 : r.int(1, 999); return { q: `How many grams are there in ${k} kg${g ? ` ${g} g` : ''}?`, expect: [String(k * 1000 + g)], py: `${k}*1000+${g}` }; },
    'averages': (r, l) => { const n = [3, 4, 5][l - 1], xs = Array.from({ length: n }, () => r.int(10, [30, 80, 200][l - 1])); const s = xs.reduce((a, b) => a + b, 0); return { q: `Find the average of ${xs.join(', ')}.`, expect: [val(`${s}/${n}`)], py: `F(${s},${n})` }; },
    'simple percentages': (r, l) => { const p = r.pick([10, 25, 50, 20, 75]), n = 20 * r.int(1, [5, 20, 50][l - 1]); return { q: `What is ${p}% of ${n}?`, expect: [val(`${p}*${n}/100`)], py: `F(${p}*${n},100)` }; }
  },
  6: {
    'integers': (r, l) => { const a = r.int(-30, 30), b = r.int(-30, 30), c = r.int(-20, 20); return l === 1 ? { q: `What is ${sgn(a)} + ${sgn(b)}?`, expect: [String(a + b)], py: `${a}+(${b})` } : { q: `Evaluate ${sgn(a)} − ${sgn(b)} + ${sgn(c)}.`, expect: [String(a - b + c)], py: `${a}-(${b})+(${c})` }; },
    'unlike fractions': (r, l) => { const b = r.int(2, [6, 9, 12][l - 1]), d = r.int(2, [6, 9, 12][l - 1]), a = r.int(1, b - 1), c = r.int(1, d - 1), op = l === 3 ? r.pick(['+', '−']) : '+'; return { q: `What is ${a}/${b} ${op} ${c}/${d}?`, expect: [val(`${a}/${b}${op === '+' ? '+' : '-'}${c}/${d}`)], py: `F(${a},${b})${op === '+' ? '+' : '-'}F(${c},${d})` }; },
    'decimal multiplication': (r, l) => { const a = (r.int(11, [99, 999, 999][l - 1]) / 10).toFixed(1), b = l === 3 ? (r.int(11, 99) / 10).toFixed(1) : String(r.int(2, 9)); return { q: `Multiply ${a} by ${b}.`, expect: [val(`${a}*${b}`)], py: `F('${a}')*F('${b}')` }; },
    'ratio in simplest form': (r, l) => { let a = r.int(1, 9), b = r.int(1, 9); while (gcd(a, b) !== 1 || a === b) { a = r.int(1, 9); b = r.int(1, 9); } const k = r.int(2, [6, 15, 40][l - 1]); return { q: `Write the ratio ${a * k} : ${b * k} in its simplest form.`, expect: [String(a), String(b)], py: `[F(${a * k},sp.igcd(${a * k},${b * k})), F(${b * k},sp.igcd(${a * k},${b * k}))]` }; },
    'simple equations': (r, l) => { const x = r.int(1, [15, 40, 99][l - 1]), a = r.int(1, 50); return l === 1 ? { q: `Solve x + ${a} = ${x + a}.`, expect: [String(x)], py: `sp.solve(x+${a}-${x + a},x)[0]` } : { q: `Solve x − ${a} = ${x - a}.`, expect: [String(x)], py: `sp.solve(x-${a}-(${x - a}),x)[0]` }; },
    'perimeter and area of squares': (r, l) => { const s = r.int(2, [12, 40, 99][l - 1]); return r.int(0, 1) ? { q: `Find the perimeter of a square of side ${s} cm.`, expect: [String(4 * s)], py: `4*${s}` } : { q: `Find the area of a square of side ${s} cm.`, expect: [String(s * s)], py: `${s}**2` }; }
  },
  7: {
    'integer multiplication and division': (r, l) => { const a = r.int(-12, 12) || 3, b = r.int(-9, 9) || -2, c = r.int(1, 6) * (r.int(0, 1) ? 1 : -1); return l < 3 ? { q: `What is ${sgn(a)} × ${sgn(b)}?`, expect: [String(a * b)], py: `${a}*(${b})` } : { q: `Evaluate ${sgn(a * c)} ÷ ${sgn(c)} × ${sgn(b)}.`, expect: [String(a * b)], py: `F(${a * c},${c})*(${b})` }; },
    'fraction multiplication and division': (r, l) => { const a = r.int(1, 9), b = r.int(2, 9), c = r.int(1, 9), d = r.int(2, 9), op = l === 1 ? '×' : '÷'; return { q: `What is ${a}/${b} ${op} ${c}/${d}?`, expect: [val(`(${a}/${b})${op === '×' ? '*' : '/'}(${c}/${d})`)], py: `F(${a},${b})${op === '×' ? '*' : '/'}F(${c},${d})` }; },
    'two-step equations': (r, l) => { const x = r.int(-10, [10, 20, 30][l - 1]) || 4, a = r.int(2, [5, 9, 15][l - 1]), b = r.int(-20, 20); return { q: `Solve ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${a * x + b}.`, expect: [String(x)], py: `sp.solve(${a}*x+(${b})-(${a * x + b}),x)[0]` }; },
    'percentages': (r, l) => { const p = r.int(1, [20, 60, 99][l - 1]), n = r.int(2, [20, 80, 400][l - 1]) * 10; return { q: `Find ${p}% of ${n}.`, expect: [val(`${p}*${n}/100`)], py: `F(${p}*${n},100)` }; },
    'profit and loss': (r, l) => { const cp = r.int(5, [50, 200, 900][l - 1]) * 10, d = r.int(5, 40) * 5 * (l === 3 && r.int(0, 1) ? -1 : 1), sp = cp + d; return { q: `A shopkeeper buys a toy for ₹${cp} and sells it for ₹${sp}. Find the ${d >= 0 ? 'profit' : 'loss'}.`, expect: [String(Math.abs(d))], py: `abs(${sp}-${cp})` }; },
    'simple interest': (r, l) => { const p = r.int(5, [20, 100, 500][l - 1]) * 100, rt = r.pick(l === 1 ? [5, 10] : [4, 5, 6, 7.5, 8, 12]), t = r.int(1, [3, 5, 7][l - 1]); return { q: `Find the simple interest on ₹${p} at ${rt}% per year for ${t} year${t > 1 ? 's' : ''}.`, expect: [val(`${p}*${rt}*${t}/100`)], py: `F(${p})*F('${rt}')*${t}/100` }; },
    'angles of a triangle': (r, l) => { const a = r.int(20, 80), b = r.int(20, 160 - a - 10); return { q: `Two angles of a triangle are ${a}° and ${b}°. Find the third angle.`, expect: [String(180 - a - b)], py: `180-${a}-${b}` }; },
    'exponents': (r, l) => { const a = r.int(2, [3, 5, 9][l - 1]), m = r.int(1, 4), n = r.int(1, 3); return { q: `Find the value of ${a}^${m} × ${a}^${n}.`, expect: [String(a ** (m + n))], py: `${a}**${m}*${a}**${n}` }; }
  },
  8: {
    'linear equations': (r, l) => { const x = r.int(-12, 15) || 5, a = r.int(3, 9), c = r.int(1, a - 1), b = r.int(-15, 15), d = (a - c) * x + b; return { q: `Solve ${a}x ${b < 0 ? '−' : '+'} ${Math.abs(b)} = ${c}x ${d < 0 ? '−' : '+'} ${Math.abs(d)}.`, expect: [String(x)], py: `sp.solve(${a}*x+(${b})-(${c}*x+(${d})),x)[0]` }; },
    'square roots': (r, l) => { const n = r.int([4, 15, 40][l - 1], [15, 40, 99][l - 1]); return { q: `Find the square root of ${n * n}.`, expect: [String(n)], py: `sp.sqrt(${n * n})` }; },
    'cube roots': (r, l) => { const n = r.int(2, [6, 12, 25][l - 1]); return { q: `Find the cube root of ${n ** 3}.`, expect: [String(n)], py: `sp.integer_nthroot(${n ** 3},3)[0]` }; },
    'compound interest': (r, l) => { const p = r.int(1, [10, 50, 100][l - 1]) * 1000, rt = r.pick([5, 10, 20]), t = l === 3 ? 3 : 2; return { q: `Find the amount on ₹${p} at ${rt}% per year compounded annually for ${t} years.`, expect: [val(`${p}*(1+${rt}/100)^${t}`)], py: `F(${p})*(1+F(${rt},100))**${t}` }; },
    'percentage increase and decrease': (r, l) => { const a = r.int(4, [20, 80, 400][l - 1]) * 10, p = r.pick([5, 10, 12, 15, 20, 25, 30]), up = r.int(0, 1); return { q: `A price of ₹${a} is ${up ? 'increased' : 'decreased'} by ${p}%. What is the new price?`, expect: [val(`${a}*(1${up ? '+' : '-'}${p}/100)`)], py: `F(${a})*(1${up ? '+' : '-'}F(${p},100))` }; },
    'discount': (r, l) => { const mp = r.int(5, [50, 200, 900][l - 1]) * 10, d = r.pick([5, 10, 15, 20, 25, 40]); return { q: `A jacket marked ₹${mp} is sold at a ${d}% discount. Find the selling price.`, expect: [val(`${mp}*(100-${d})/100`)], py: `F(${mp})*(100-${d})/100` }; },
    'volume of a cylinder': (r, l) => { const rad = 7 * r.int(1, [2, 3, 5][l - 1]), h = r.int(2, [10, 20, 40][l - 1]); return { q: `Find the volume of a cylinder with radius ${rad} cm and height ${h} cm. Use π = 22/7.`, expect: [val(`22/7*${rad}^2*${h}`)], py: `F(22,7)*${rad}**2*${h}` }; },
    'surface area of a cuboid': (r, l) => { const a = r.int(2, [10, 25, 60][l - 1]), b = r.int(2, [10, 25, 60][l - 1]), c = r.int(2, [10, 25, 60][l - 1]); return { q: `Find the total surface area of a cuboid ${a} cm × ${b} cm × ${c} cm.`, expect: [String(2 * (a * b + b * c + c * a))], py: `2*(${a}*${b}+${b}*${c}+${c}*${a})` }; },
    'negative exponents': (r, l) => { const a = r.int(2, [3, 5, 10][l - 1]), n = r.int(1, 3); return { q: `Find the value of ${a}^(−${n}).`, expect: [val(`1/${a}^${n}`)], py: `F(1,${a}**${n})` }; },
    'direct proportion': (r, l) => { const a = r.int(2, 9), p = r.int(5, [20, 60, 150][l - 1]), b = r.int(2, [12, 30, 60][l - 1]); return { q: `${a} pens cost ₹${a * p}. How much do ${b} pens cost?`, expect: [String(b * p)], py: `F(${a * p},${a})*${b}` }; }
  },
  9: {
    'values of polynomials': (r, l) => { const a = r.int(1, 5), b = r.int(-9, 9), c = r.int(-9, 9), t = r.int(-4, 4); return { q: `Find p(${t}) when p(x) = ${a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)}.`, expect: [String(a * t * t + b * t + c)], py: `(${a}*x**2+(${b})*x+(${c})).subs(x,${t})` }; },
    "Heron's formula": (r, l) => { const [a, b, c] = r.pick([[13, 14, 15], [5, 12, 13], [9, 10, 17], [6, 8, 10], [7, 15, 20], [10, 13, 13]]), k = r.int(1, [1, 3, 6][l - 1]); return { q: `Find the area of a triangle with sides ${a * k} cm, ${b * k} cm and ${c * k} cm using Heron's formula.`, expect: [val(`sqrt(${(a + b + c) / 2 * k}*${((b + c - a) / 2) * k}*${((a + c - b) / 2) * k}*${((a + b - c) / 2) * k})`)], py: `sp.sqrt(F(${(a + b + c) * k},2)*F(${(b + c - a) * k},2)*F(${(a + c - b) * k},2)*F(${(a + b - c) * k},2))` }; },
    'volume of a sphere': (r, l) => { const rad = 7 * r.int(1, [1, 2, 3][l - 1]); return { q: `Find the volume of a sphere of radius ${rad} cm. Use π = 22/7.`, expect: [val(`4/3*22/7*${rad}^3`)], py: `F(4,3)*F(22,7)*${rad}**3` }; },
    'volume of a cone': (r, l) => { const rad = 7 * r.int(1, [1, 2, 3][l - 1]), h = 3 * r.int(1, [3, 6, 10][l - 1]); return { q: `Find the volume of a cone with radius ${rad} cm and height ${h} cm. Use π = 22/7.`, expect: [val(`1/3*22/7*${rad}^2*${h}`)], py: `F(1,3)*F(22,7)*${rad}**2*${h}` }; },
    'mean': (r, l) => { const n = [5, 6, 8][l - 1], xs = Array.from({ length: n }, () => r.int(1, [20, 60, 99][l - 1])); const s = xs.reduce((a, b) => a + b, 0); return { q: `Find the mean of ${xs.join(', ')}.`, expect: [val(`${s}/${n}`)], py: `F(${s},${n})` }; },
    'fractional exponents': (r, l) => { const [b, k] = r.pick([[2, 2], [2, 3], [3, 2], [3, 3], [2, 4], [5, 2], [4, 3], [2, 5]]), m = l === 1 ? 1 : r.int(2, 3); const n = b ** k; return { q: `Find the value of ${n}^(${m}/${k}).`, expect: [String(b ** m)], py: `sp.Integer(${n})**sp.Rational(${m},${k})` }; },
    'linear equations in two variables': (r, l) => { const a = r.int(1, 6), b = r.int(1, 6), x0 = r.int(-5, 8), y0 = r.int(-5, 8); return { q: `If ${a}x + ${b}y = ${a * x0 + b * y0} and x = ${x0}, find y.`, expect: [String(y0)], py: `sp.solve(${a}*${x0}+${b}*y-(${a * x0 + b * y0}),y)[0]` }; }
  },
  10: {
    'quadratic equations': (r, l) => { const p = r.int(-9, 9), q = r.int(-9, 9), k = l === 3 ? r.int(2, 3) : 1; const b = -k * (p + q), c = k * p * q; const term = (v, s) => (v === 0 ? '' : ` ${v < 0 ? '−' : '+'} ${Math.abs(v) === 1 && s ? '' : Math.abs(v)}${s}`); return { q: `Solve ${k === 1 ? '' : k}x²${term(b, 'x')}${term(c, '')} = 0.`, expect: [...new Set([String(p), String(q)])], py: `sp.solve(${k}*x**2+(${b})*x+(${c}),x)` }; },
    'nth term of an AP': (r, l) => { const a = r.int(-10, 20), d = r.int(-5, 9) || 3, n = r.int(5, [15, 40, 100][l - 1]); return { q: `Find the ${n}th term of the AP ${a}, ${a + d}, ${a + 2 * d}, …`, expect: [String(a + (n - 1) * d)], py: `${a}+(${n}-1)*(${d})` }; },
    'sum of an AP': (r, l) => { const a = r.int(1, 20), d = r.int(1, 9), n = r.int(5, [12, 30, 60][l - 1]); return { q: `Find the sum of the first ${n} terms of the AP ${a}, ${a + d}, ${a + 2 * d}, …`, expect: [String(n * (2 * a + (n - 1) * d) / 2)], py: `F(${n},2)*(2*${a}+(${n}-1)*${d})` }; },
    'HCF and LCM': (r, l) => { const g = r.int(2, [12, 30, 60][l - 1]), a = g * r.int(2, 15), b = g * r.int(2, 15); return { q: `Find the HCF and LCM of ${a} and ${b}.`, expect: [String(gcd(a, b)), String(lcm(a, b))], py: `[sp.igcd(${a},${b}), sp.ilcm(${a},${b})]` }; },
    'distance formula': (r, l) => { const [p, q, h] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25], [9, 12, 15]]), x1 = r.int(-9, 9), y1 = r.int(-9, 9), sx = r.pick([1, -1]), sy = r.pick([1, -1]); return { q: `Find the distance between (${x1}, ${y1}) and (${x1 + sx * p}, ${y1 + sy * q}).`, expect: [String(h)], py: `sp.sqrt((${sx * p})**2+(${sy * q})**2)` }; },
    'midpoint': (r, l) => { const x1 = r.int(-10, 10), y1 = r.int(-10, 10), x2 = r.int(-10, 10), y2 = r.int(-10, 10); return { q: `Find the midpoint of the line joining (${x1}, ${y1}) and (${x2}, ${y2}).`, expect: [val(`(${x1}+${sgn(x2)})/2`), val(`(${y1}+${sgn(y2)})/2`)], py: `[F(${x1}+${x2},2), F(${y1}+${y2},2)]` }; },
    'trigonometric values': (r, l) => { const c = r.pick([['sin 30° + cos 60°', '1', 'sp.sin(sp.pi/6)+sp.cos(sp.pi/3)'], ['sin² 60° + cos² 60°', '1', 'sp.sin(sp.pi/3)**2+sp.cos(sp.pi/3)**2'], ['tan 45° + sin 30°', '3/2', 'sp.tan(sp.pi/4)+sp.sin(sp.pi/6)'], ['2 sin 30° × cos 60°', '1/2', '2*sp.sin(sp.pi/6)*sp.cos(sp.pi/3)'], ['sin² 45° + cos² 30°', '5/4', 'sp.sin(sp.pi/4)**2+sp.cos(sp.pi/6)**2'], ['tan² 60° − sin² 30°', '11/4', 'sp.tan(sp.pi/3)**2-sp.sin(sp.pi/6)**2'], ['cos 0° + sin 90° + tan 45°', '3', 'sp.cos(0)+sp.sin(sp.pi/2)+sp.tan(sp.pi/4)'], ['4 cos² 45° − 3 tan² 30°', '1', '4*sp.cos(sp.pi/4)**2-3*sp.tan(sp.pi/6)**2']]); return { q: `Evaluate ${c[0]}.`, expect: [c[1]], py: `sp.nsimplify(${c[2]})` }; },
    'probability': (r, l) => { const c = r.pick([() => { const k = r.int(1, 6); return [`A die is rolled once. What is the probability of getting a number greater than ${k - 1}?`, `${7 - k}/6`, `F(${7 - k},6)`]; }, () => { const red = r.int(1, 9), blue = r.int(1, 9); return [`A bag has ${red} red and ${blue} blue balls. One ball is drawn at random. What is the probability that it is red?`, `${red}/${red + blue}`, `F(${red},${red + blue})`]; }, () => ['A card is drawn from a well-shuffled deck of 52 cards. What is the probability that it is a king?', '1/13', 'F(4,52)'], () => ['Two coins are tossed together. What is the probability of getting exactly one head?', '1/2', 'F(2,4)']])(); return { q: c[0], expect: [val(c[1])], py: c[2] }; }
  },
  11: {
    'sets': (r, l) => { const a = r.int(10, [30, 60, 200][l - 1]), b = r.int(10, [30, 60, 200][l - 1]), i = r.int(1, Math.min(a, b) - 1); return { q: `If n(A) = ${a}, n(B) = ${b} and n(A ∩ B) = ${i}, find n(A ∪ B).`, expect: [String(a + b - i)], py: `${a}+${b}-${i}` }; },
    'permutations': (r, l) => { const n = r.int(4, [7, 10, 12][l - 1]), k = r.int(2, Math.min(n, [3, 4, 5][l - 1])); return { q: `Find the value of ${n}P${k}.`, expect: [String(fact(n) / fact(n - k))], py: `sp.ff(${n},${k})` }; },
    'combinations': (r, l) => { const n = r.int(5, [8, 12, 20][l - 1]), k = r.int(2, Math.min(n - 1, [3, 5, 6][l - 1])); return { q: `In how many ways can ${k} students be chosen from ${n} students?`, expect: [String(Math.round(fact(n) / (fact(k) * fact(n - k))))], py: `sp.binomial(${n},${k})` }; },
    'geometric progressions': (r, l) => { const a = r.int(1, 5), q = r.pick([2, 3, -2]), n = r.int(4, [6, 8, 10][l - 1]); return r.int(0, 1) ? { q: `Find the ${n}th term of the GP ${a}, ${a * q}, ${a * q * q}, …`, expect: [String(a * q ** (n - 1))], py: `${a}*(${q})**(${n}-1)` } : { q: `Find the sum of the first ${n} terms of the GP ${a}, ${a * q}, ${a * q * q}, …`, expect: [String(a * (q ** n - 1) / (q - 1))], py: `sum(${a}*(${q})**i for i in range(${n}))` }; },
    'slope of a line': (r, l) => { const x1 = r.int(-9, 9), y1 = r.int(-9, 9); let x2 = r.int(-9, 9); if (x2 === x1) x2 = x1 + 3; const y2 = r.int(-9, 9); return { q: `Find the slope of the line through (${x1}, ${y1}) and (${x2}, ${y2}).`, expect: [val(`(${y2}-${sgn(y1)})/(${x2}-${sgn(x1)})`)], py: `F(${y2}-(${y1}),${x2}-(${x1}))` }; },
    'modulus of a complex number': (r, l) => { const [p, q, h] = r.pick([[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25]]), sp_ = r.pick([1, -1]), sq = r.pick([1, -1]); return { q: `Find the modulus of ${sp_ * p} ${sq < 0 ? '−' : '+'} ${q}i.`, expect: [String(h)], py: `sp.Abs(${sp_ * p}+(${sq * q})*sp.I)` }; },
    'limits': (r, l) => { const a = r.int(-6, 6) || 2; return l === 1 ? (() => { const b = r.int(-5, 5), c = r.int(-9, 9); return { q: `Find the limit of x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)} as x → ${a}.`, expect: [String(a * a + b * a + c)], py: `sp.limit(x**2+(${b})*x+(${c}),x,${a})` }; })() : { q: `Find the limit of (x² − ${a * a})/(x ${a < 0 ? '+' : '−'} ${Math.abs(a)}) as x → ${a}.`, expect: [String(2 * a)], py: `sp.limit((x**2-${a * a})/(x-(${a})),x,${a})` }; }
  },
  12: {
    'determinants': (r, l) => { if (l < 3) { const [a, b, c, d] = [r.int(-9, 9), r.int(-9, 9), r.int(-9, 9), r.int(-9, 9)]; return { q: `Find the determinant of the matrix [[${a}, ${b}], [${c}, ${d}]].`, expect: [String(a * d - b * c)], py: `sp.Matrix([[${a},${b}],[${c},${d}]]).det()` }; } const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => r.int(-5, 5))); const det = m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]); return { q: `Find the determinant of the matrix ${JSON.stringify(m).replace(/,/g, ', ')}.`, expect: [String(det)], py: `sp.Matrix(${JSON.stringify(m)}).det()` }; },
    'definite integrals': (r, l) => { const a = r.int(0, 2), b = a + r.int(1, [2, 3, 4][l - 1]), p = r.int(1, 4), q = r.int(-5, 5); return { q: `Evaluate the integral of (${p}x² ${q < 0 ? '−' : '+'} ${Math.abs(q)}x) dx from x = ${a} to x = ${b}.`, expect: [val(`${p}/3*(${b}^3-${a}^3)+${q}/2*(${b}^2-${a}^2)`)], py: `sp.integrate(${p}*x**2+(${q})*x,(x,${a},${b}))` }; },
    'derivatives': (r, l) => { const a = r.int(1, 5), b = r.int(-9, 9), c = r.int(-9, 9), t = r.int(-4, 4); return l === 1 ? { q: `If f(x) = ${a}x² ${b < 0 ? '−' : '+'} ${Math.abs(b)}x ${c < 0 ? '−' : '+'} ${Math.abs(c)}, find f′(${t}).`, expect: [String(2 * a * t + b)], py: `sp.diff(${a}*x**2+(${b})*x+(${c}),x).subs(x,${t})` } : { q: `If f(x) = x³ ${b < 0 ? '−' : '+'} ${Math.abs(b)}x² ${c < 0 ? '−' : '+'} ${Math.abs(c)}x, find f′(${t}).`, expect: [String(3 * t * t + 2 * b * t + c)], py: `sp.diff(x**3+(${b})*x**2+(${c})*x,x).subs(x,${t})` }; },
    'conditional probability': (r, l) => { const pb = r.pick([['0.5', '1/2'], ['0.4', '2/5'], ['0.6', '3/5'], ['0.8', '4/5'], ['0.25', '1/4']]), pab = r.pick(['0.1', '0.2']); return { q: `If P(B) = ${pb[0]} and P(A ∩ B) = ${pab}, find P(A | B).`, expect: [val(`${pab}/${pb[0]}`)], py: `F('${pab}')/F('${pb[0]}')` }; },
    'dot product': (r, l) => { const a = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)], b = [r.int(-6, 6), r.int(-6, 6), r.int(-6, 6)]; const v = (u) => `${u[0]}i ${u[1] < 0 ? '−' : '+'} ${Math.abs(u[1])}j ${u[2] < 0 ? '−' : '+'} ${Math.abs(u[2])}k`; return { q: `Find the dot product of ${v(a)} and ${v(b)}.`, expect: [String(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])], py: `sp.Matrix(${JSON.stringify(a)}).dot(sp.Matrix(${JSON.stringify(b)}))` }; },
    'distance in 3D': (r, l) => { const [p, q, s, h] = r.pick([[1, 2, 2, 3], [2, 3, 6, 7], [1, 4, 8, 9], [2, 6, 9, 11], [4, 4, 7, 9], [2, 10, 11, 15]]), o = [r.int(-5, 5), r.int(-5, 5), r.int(-5, 5)]; return { q: `Find the distance between the points (${o.join(', ')}) and (${o[0] + p}, ${o[1] - q}, ${o[2] + s}).`, expect: [String(h)], py: `sp.sqrt(${p}**2+${q}**2+${s}**2)` }; }
  }
};

const TOPICS = Object.fromEntries(Object.entries(T).map(([k, v]) => [k, Object.keys(v)]));

/* n questions for one class, spread evenly over its topics and the three levels; no repeated question text. */
function forClass(klass, n = 500, seed = 2026) {
  const topics = T[klass]; if (!topics) throw new Error('no class ' + klass);
  const names = Object.keys(topics), r0 = rng(seed * 100 + Number(klass)), out = [], seen = new Set();
  const r = { int: (a, b) => a + Math.floor(r0() * (b - a + 1)), pick: xs => xs[Math.floor(r0() * xs.length)], name: () => NAMES[Math.floor(r0() * NAMES.length)] };
  for (let i = 0, misses = 0; out.length < n && misses < n * 50; i++) {
    const topic = names[i % names.length], level = 1 + (Math.floor(i / names.length) % 3);
    const c = topics[topic](r, level);
    if (seen.has(c.q)) { misses++; continue; }
    seen.add(c.q);
    const slug = topic.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
    out.push(Object.assign({ cat: `c${klass}-${slug}`, id: `c${klass}-${slug}-L${level}-${out.length + 1}`, klass: Number(klass), topic, level }, c));
  }
  return out;
}
const all = (n = 500, seed) => Object.keys(T).flatMap(k => forClass(k, n, seed));

module.exports = { forClass, all, TOPICS };
