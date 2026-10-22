/* Spark's independent maths checker: exact fraction arithmetic (BigInt), a small expression parser, and an
   equation solver for one unknown (linear or quadratic). The app uses it to check Sparky's final answer against
   the student's ORIGINAL question, separately from the model and its Python tool. It only speaks when it is
   sure what the question says; anything it can't read with certainty returns null and is left alone.
   Shared by the app (index.html) and the tests (tests/). No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SparkMath = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- exact numbers ---------- */
  const babs = a => (a < 0n ? -a : a);
  const gcd = (a, b) => { a = babs(a); b = babs(b); while (b) [a, b] = [b, a % b]; return a || 1n; };
  function Q(n, d = 1n) {
    if (d === 0n) throw new Error('division by zero');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); return { n: n / g, d: d / g };
  }
  const isQ = v => v && typeof v.n === 'bigint';
  const fromDecimal = s => {
    const [i, f = ''] = s.split('.');
    return Q(BigInt((i || '0') + f), 10n ** BigInt(f.length));
  };
  const toNum = v => (isQ(v) ? Number(v.n) / Number(v.d) : v);
  const ops = {
    add: (a, b) => (isQ(a) && isQ(b) ? Q(a.n * b.d + b.n * a.d, a.d * b.d) : toNum(a) + toNum(b)),
    sub: (a, b) => (isQ(a) && isQ(b) ? Q(a.n * b.d - b.n * a.d, a.d * b.d) : toNum(a) - toNum(b)),
    mul: (a, b) => (isQ(a) && isQ(b) ? Q(a.n * b.n, a.d * b.d) : toNum(a) * toNum(b)),
    div: (a, b) => { if (isQ(b) ? b.n === 0n : b === 0) throw new Error('division by zero'); return isQ(a) && isQ(b) ? Q(a.n * b.d, a.d * b.n) : toNum(a) / toNum(b); },
    neg: a => (isQ(a) ? Q(-a.n, a.d) : -a),
    pow: (a, b) => {
      if (isQ(a) && isQ(b) && b.d === 1n && babs(b.n) <= 64n) {
        const e = b.n < 0n ? -b.n : b.n; let n = 1n, d = 1n;
        for (let i = 0n; i < e; i++) { n *= a.n; d *= a.d; }
        return b.n < 0n ? ops.div(Q(1n), Q(n, d)) : Q(n, d);
      }
      return Math.pow(toNum(a), toNum(b));
    },
    root: (a, k) => {
      if (isQ(a) && a.n >= 0n) {
        const r = x => { const f = BigInt(Math.round(Math.pow(Number(x), 1 / k))); for (const c of [f - 1n, f, f + 1n]) if (c >= 0n && c ** BigInt(k) === x) return c; return null; };
        const n = r(a.n), d = r(a.d); if (n !== null && d !== null) return Q(n, d);
      }
      if (isQ(a) && a.n < 0n && k === 3) { const p = ops.root(Q(-a.n, a.d), 3); return ops.neg(p); }
      return Math.pow(toNum(a), 1 / k);
    }
  };
  const near = (a, b) => {
    if (isQ(a) && isQ(b)) return a.n === b.n && a.d === b.d;
    const x = toNum(a), y = toNum(b);
    return Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x), Math.abs(y));
  };
  // Answers like 0.67 for 2/3 or 3.14 for π are rounded on purpose; accept them to the precision written.
  const roughly = (want, got, written) => {
    if (near(want, got)) return true;
    const dp = /\.(\d+)/.exec(written || ''); if (!dp) return false;
    return Math.abs(toNum(want) - toNum(got)) <= 0.5 * Math.pow(10, -dp[1].length) + 1e-12;
  };
  function show(v) {
    if (!isQ(v)) return String(Math.round(v * 1e6) / 1e6);
    if (v.d === 1n) return String(v.n);
    return `${v.n}/${v.d}`;
  }

  /* ---------- reading maths text ---------- */
  const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-' };
  /* LaTeX, Unicode and school notation → a plain expression the parser reads. */
  function plain(s) {
    let x = String(s || '').replace(/\\[()[\]]|\$/g, ' ');
    // Mixed numbers: 4\frac{1}{12} and 4 1/12 mean 4 + 1/12.
    x = x.replace(/(\d)\s*\\[dt]?frac\s*\{(\d+)\}\s*\{(\d+)\}/g, '($1+$2/$3)').replace(/(^|[^\d.\/^])(\d+)\s+(\d+)\s*\/\s*(\d+)(?![\d.])/g, '$1($2+$3/$4)');
    for (let k = 0; k < 5; k++) x = x.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '(($1)/($2))').replace(/\\sqrt\s*\[\s*3\s*\]\s*\{([^{}]*)\}/g, 'cbrt($1)').replace(/\\sqrt\s*\{([^{}]*)\}/g, 'sqrt($1)');
    x = x.replace(/\\left|\\right|\\,|\\;|\\!|\\quad|\\displaystyle/g, ' ')
      .replace(/\\(text|mathrm|mathbf|operatorname)\s*\{([^{}]*)\}/g, ' $2 ')
      .replace(/\\(times|cdot)/g, '*').replace(/\\div/g, '/').replace(/\\pi/g, 'π').replace(/\\%/g, '%').replace(/\^\s*\{?\\circ\}?|°/g, '')
      .replace(/\\[a-zA-Z]+/g, ' ').replace(/[{}]/g, m => (m === '{' ? '(' : ')'))
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, m => '^(' + [...m].map(c => SUP[c]).join('') + ')')
      .replace(/(^|[^\d.)])(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?![\d.(a-zA-Z])/g, '$1($2/$3)')
      .replace(/[−–—]/g, '-').replace(/[×·∙]/g, '*').replace(/[÷∶]/g, '/').replace(/√\s*\(/g, 'sqrt(').replace(/√\s*(\d+(\.\d+)?)/g, 'sqrt($1)').replace(/∛\s*\(/g, 'cbrt(').replace(/∛\s*(\d+)/g, 'cbrt($1)')
      .replace(/(\d),(?=\d{2,3}\b)/g, '$1');
    return x;
  }

  /* Recursive-descent parser. Implicit multiplication (2x, 3(x-1), (a)(b)) is supported. One-letter variables only. */
  function parse(src) {
    const s = plain(src), toks = [];
    const re = /\s*(?:(\d+\.\d+|\d+|\.\d+)|(sqrt|cbrt)|([a-zA-Z])|(π)|([-+*/^()%]))/y;
    let m; re.lastIndex = 0;
    while (re.lastIndex < s.length) {
      const at = re.lastIndex; m = re.exec(s);
      if (!m) { if (/^\s*$/.test(s.slice(at))) break; return null; }
      if (m[1]) toks.push({ t: 'num', v: fromDecimal(m[1].startsWith('.') ? '0' + m[1] : m[1]) });
      else if (m[2]) toks.push({ t: 'fn', v: m[2] });
      else if (m[3]) toks.push({ t: 'var', v: m[3].toLowerCase() });
      else if (m[4]) toks.push({ t: 'num', v: Math.PI, pi: true });
      else toks.push({ t: 'op', v: m[5] });
    }
    let i = 0;
    const peek = () => toks[i], next = () => toks[i++];
    const startsFactor = k => k && (k.t === 'num' || k.t === 'var' || k.t === 'fn' || (k.t === 'op' && k.v === '('));
    function expr() { let a = term(); while (peek() && peek().t === 'op' && (peek().v === '+' || peek().v === '-')) { const o = next().v, b = term(); a = { op: o === '+' ? 'add' : 'sub', a, b }; } return a; }
    function term() {
      let a = unary();
      for (;;) {
        const k = peek();
        if (k && k.t === 'op' && (k.v === '*' || k.v === '/')) { next(); a = { op: k.v === '*' ? 'mul' : 'div', a, b: unary() }; }
        else if (startsFactor(k)) a = { op: 'mul', a, b: power() };
        else return a;
      }
    }
    function unary() { const k = peek(); if (k && k.t === 'op' && (k.v === '-' || k.v === '+')) { next(); const a = unary(); return k.v === '-' ? { op: 'neg', a } : a; } return power(); }
    function power() { const b = postfix(); const k = peek(); if (k && k.t === 'op' && k.v === '^') { next(); return { op: 'pow', a: b, b: unary() }; } return b; }
    function postfix() { let a = atom(); while (peek() && peek().t === 'op' && peek().v === '%') { next(); a = { op: 'div', a, b: { num: Q(100n) } }; } return a; }
    function atom() {
      const k = next(); if (!k) throw new Error('end');
      if (k.t === 'num') return { num: k.v };
      if (k.t === 'var') return { v: k.v };
      if (k.t === 'fn') { const a = atom(); return { op: k.v === 'sqrt' ? 'sqrt' : 'cbrt', a }; }
      if (k.t === 'op' && k.v === '(') { const e = expr(); const c = next(); if (!c || c.v !== ')') throw new Error('bracket'); return e; }
      throw new Error('unexpected ' + k.v);
    }
    try { const e = expr(); return i === toks.length ? e : null; } catch (e) { return null; }
  }
  function vars(ast, out = new Set()) { if (!ast) return out; if (ast.v) out.add(ast.v); if (ast.a) vars(ast.a, out); if (ast.b) vars(ast.b, out); return out; }
  function ev(ast, env = {}) {
    if (ast.num !== undefined) return ast.num;
    if (ast.v) { if (!(ast.v in env)) throw new Error('unknown ' + ast.v); return env[ast.v]; }
    if (ast.op === 'neg') return ops.neg(ev(ast.a, env));
    if (ast.op === 'sqrt') return ops.root(ev(ast.a, env), 2);
    if (ast.op === 'cbrt') return ops.root(ev(ast.a, env), 3);
    return ops[ast.op](ev(ast.a, env), ev(ast.b, env));
  }
  function evaluate(src, env) { const a = parse(src); if (!a) return null; try { return ev(a, env); } catch (e) { return null; } }

  /* Solves one equation in one unknown when it is a polynomial of degree 1 or 2 (checked exactly from 4 samples). */
  function solve(eq) {
    const parts = String(eq).split('=');
    if (parts.length !== 2) return null;
    const L = parse(parts[0]), R = parse(parts[1]);
    if (!L || !R) return null;
    const vs = new Set([...vars(L), ...vars(R)]);
    if (vs.size !== 1) return null;
    const x = [...vs][0];
    const f = t => { try { return ops.sub(ev(L, { [x]: Q(BigInt(t)) }), ev(R, { [x]: Q(BigInt(t)) })); } catch (e) { return null; } };
    const y = [0, 1, 2, 3].map(f);
    if (y.some(v => v === null || !isQ(v))) return null;
    const d1 = [ops.sub(y[1], y[0]), ops.sub(y[2], y[1]), ops.sub(y[3], y[2])];
    const d2 = [ops.sub(d1[1], d1[0]), ops.sub(d1[2], d1[1])];
    if (!near(d2[0], d2[1])) return null; // cubic or worse, or not a polynomial: leave it to the model
    const a = ops.div(d2[0], Q(2n)), b = ops.sub(d1[0], a), c = y[0]; // f(t) = a t² + b t + c
    const zero = v => isQ(v) && v.n === 0n;
    if (zero(a)) {
      if (zero(b)) return { x, roots: [], identity: zero(c), none: !zero(c), eq: String(eq).trim() };
      return { x, roots: [ops.div(ops.neg(c), b)], eq: String(eq).trim() };
    }
    const disc = ops.sub(ops.mul(b, b), ops.mul(Q(4n), ops.mul(a, c)));
    if (toNum(disc) < 0) return { x, roots: [], none: true, complex: true, eq: String(eq).trim() };
    const r = ops.root(disc, 2), twoA = ops.mul(Q(2n), a);
    const roots = [ops.div(ops.add(ops.neg(b), r), twoA), ops.div(ops.sub(ops.neg(b), r), twoA)];
    return { x, roots: near(roots[0], roots[1]) ? [roots[0]] : roots, eq: String(eq).trim() };
  }

  /* ---------- reading a question and an answer ---------- */
  /* The one equation or calculation in a question, if there is exactly one and nothing else to interpret. */
  function problemOf(question) {
    const words = String(question || '').replace(/\bdivided by\b/gi, '÷').replace(/\b(multiplied by|times)\b/gi, '×').replace(/\bplus\b/gi, '+').replace(/\bminus\b/gi, '−').replace(/\b(equals|is equal to|equal to)\b/gi, '=')
      .replace(/(\d%?|\))\s+of\s+(?=[\d(₹])/gi, '$1 × ').replace(/₹\s*/g, '');
    const q = plain(words).replace(/\?+\s*$/, '');
    // A student's own attempt ("I got …", "is it …") is checked by Sparky, not here.
    if (/\b(i got|my answer|i think|is it|i did|i wrote|i calculated|calculates|explain the mistake)\b/i.test(question)) return null;
    // Notation like 6 ÷ 2(1+2) or 1/2x has two readings, so there is no single answer to check.
    if (/[\/÷]\s*[\d.]+[a-z(]/i.test(words)) return null;
    const mathsOnly = t => !/[a-z]{2,}/i.test(t.replace(/sqrt|cbrt/g, ''));
    // "Find the value of 2x² − 3x + 1 when x = −2": substitute, don't solve.
    const sub = /^(.*?)\b(?:when|if|for|where|at)\s+([a-z])\s*=\s*([-\d./() ]+?)\s*[.?!]?\s*$/i.exec(q);
    if (sub) {
      const ws = sub[1].trim().split(/\s+/), x = sub[2].toLowerCase(), at = evaluate(sub[3]);
      if (at === null) return null;
      for (let a = 0; a < ws.length; a++) {
        const c = ws.slice(a).join(' ').replace(/[.,;:?!]+$/, '');
        if (!mathsOnly(c) || !new RegExp(`\\b${x}\\b|\\d${x}`, 'i').test(c)) continue;
        const v = evaluate(c, { [x]: at });
        if (v !== null) return { kind: 'value', expr: `${c} at ${x} = ${show(at)}`, value: v };
      }
      return null;
    }
    // Equations: exactly one "=" with one letter unknown. Keep the longest maths-only span on each side that solves.
    if ((q.match(/=/g) || []).length === 1) {
      const [left, right] = q.split('=');
      const lw = left.trim().split(/\s+/), rw = right.trim().split(/\s+/);
      for (let a = 0; a < lw.length; a++) {
        for (let b = rw.length; b > 0; b--) {
          const L = lw.slice(a).join(' ').replace(/^[:;,]+/, ''), R = rw.slice(0, b).join(' ').replace(/[.,;:?!]+$/, '');
          if (!mathsOnly(L) || !mathsOnly(R)) continue;
          const sol = solve(`${L} = ${R}`);
          if (sol) return { kind: 'equation', ...sol };
        }
      }
      return null;
    }
    // Calculations: "What is / Calculate / Evaluate / Simplify / Find <numbers and operators> …".
    const m = /^\s*(what is|what's|calculate|evaluate|simplify|find|compute|work out)\s*:?\s*(the value of\s*)?(.*)$/i.exec(q);
    if (!m) return null;
    const ws = m[3].trim().split(/\s+/);
    for (let b = ws.length; b > 0; b--) {
      const c = ws.slice(0, b).join(' ').replace(/[.,;:?!]+$/, '');
      if (!mathsOnly(c) || /[a-z]/i.test(c.replace(/sqrt|cbrt/g, '')) || !/\d/.test(c) || !/[-+*/^]|sqrt|cbrt/.test(c)) continue;
      const v = evaluate(c);
      if (v !== null) return { kind: 'value', expr: c, value: v };
    }
    return null;
  }
  /* Values in Sparky's final answer line ("**Answer:** x = 6", "\(x = \frac{3}{2}\)", "1.5", "₹2,035"). */
  function answerOf(reply) {
    const t = String(reply || '');
    const m = /\*\*\s*(final\s+)?answer\s*:?\s*\*\*\s*:?([^\n]*)/i.exec(t) || /^\s*(final\s+)?answer\s*:([^\n]*)/im.exec(t);
    if (!m) return null;
    const line = plain(m[2]).replace(/\*\*/g, ' ').replace(/₹|\brs\.?|\brupees?\b|\bpaise\b/gi, ' ')
      .replace(/\b(sq(uare)?|cubic)\s+/gi, ' ').replace(/\b(cm|mm|km|m|kg|g|mg|l|ml|litres?|liters?|metres?|meters?|units?|degrees?|hours?|hrs?|days?|minutes?|mins?|seconds?|secs?|years?|km\/h|kmph|m\/s)\b\s*(\^\s*\(\s*\d\s*\))?/gi, ' ');
    const assigns = [], nums = [];
    const value = t => {
      let c = t.replace(/[a-z]{2,}/gi, w => (/^(sqrt|cbrt)$/i.test(w) ? w : ' ')).replace(/[:]/g, ' ').trim().replace(/[.]+$/, '');
      if (!/\d/.test(c)) return null;
      let v = evaluate(c);
      if (v === null) { c = c.replace(/[()]/g, ' '); v = evaluate(c); }
      return v === null ? null : { raw: c.replace(/\s+/g, ''), v };
    };
    for (const seg of line.split(/,(?!\d{3}\b)|;|\bor\b|\band\b|\bi\.e\.?/i)) {
      const parts = seg.split('=');
      const last = value(parts[parts.length - 1]);
      if (!last) continue;
      const lhs = parts.length > 1 ? parts[0].trim() : '';
      if (/^\(?\s*[a-z]\s*\)?$/i.test(lhs)) assigns.push(Object.assign({ x: lhs.replace(/[()\s]/g, '').toLowerCase() }, last));
      nums.push(last);
    }
    return { line: m[2].trim(), assigns, nums };
  }
  /* Compares the reply's answer with an exact solution of the original question.
     status: 'agree' | 'disagree' | 'unknown' (couldn't read the question or the answer with certainty). */
  function check(question, reply) {
    const p = problemOf(question);
    if (!p) return { status: 'unknown', reason: 'no single equation or calculation in the question' };
    const a = answerOf(reply);
    if (!a) return { status: 'unknown', reason: 'no answer line', problem: p };
    if (p.kind === 'equation') {
      if (p.identity || p.none) return { status: 'unknown', reason: p.identity ? 'true for every value' : 'no real solution', problem: p };
      const got = a.assigns.filter(s => s.x === p.x);
      const vals = got.length ? got : a.nums;
      if (!vals.length) return { status: 'unknown', reason: 'no value in the answer line', problem: p };
      const ok = p.roots.every(r => vals.some(g => roughly(r, g.v, g.raw))) && vals.every(g => p.roots.some(r => roughly(r, g.v, g.raw)));
      const sub = p.roots.map(r => `${p.x} = ${show(r)}`).join(', ');
      return { status: ok ? 'agree' : 'disagree', expected: sub, got: vals.map(g => g.raw).join(', '), problem: p, note: ok ? `Putting ${sub} back into ${p.eq} makes both sides equal.` : `Solving ${p.eq} exactly gives ${sub}, but the answer says ${vals.map(g => g.raw).join(', ')}.` };
    }
    const vals = a.nums; if (!vals.length) return { status: 'unknown', reason: 'no number in the answer line', problem: p };
    const ok = vals.some(g => roughly(p.value, g.v, g.raw));
    return { status: ok ? 'agree' : 'disagree', expected: show(p.value), got: vals.map(g => g.raw).join(', '), problem: p, note: ok ? `${p.expr} = ${show(p.value)} recalculated exactly.` : `${p.expr} works out to ${show(p.value)} exactly, but the answer says ${vals.map(g => g.raw).join(', ')}.` };
  }

  return { Q, ops, near, roughly, show, plain, parse, evaluate, solve, problemOf, answerOf, check, toNum };
});
