/* Spark's visual learning engine: the small "window" Sparky opens under an answer.
   The model never writes markup. It (or local code, for maths) produces a short spec; validate() checks every
   field, and render() draws it with trusted SVG/HTML built here, escaping all text. Anything invalid → null,
   and the student simply gets the text answer. Maths visuals are rebuilt from the student's own question with
   the exact checker (spark-math.js), so a diagram can never contradict the correct calculation.
   Shared by the app (index.html) and the tests (tests/). No dependencies. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./spark-math.js'));
  else root.SparkVisuals = factory(root.SparkMath);
})(typeof self !== 'undefined' ? self : this, function (SparkMath) {
  'use strict';

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u;
  const str = (v, max) => (typeof v === 'string' ? v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '');
  const num = v => (typeof v === 'number' && isFinite(v) ? v : typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim()) ? Number(v) : NaN);
  const TYPES = ['labelled', 'fraction', 'equation', 'percent', 'numberline', 'circuit', 'process', 'planets', 'compare', 'timeline', 'profit', 'triangle'];

  /* ---------- trusted data ---------- */
  // Order, kind and one fact per planet. Sizes and distances in the picture are NOT to scale (the card says so).
  const PLANETS = [
    ['Mercury', 'Closest to the Sun and the smallest planet. A year there lasts just 88 Earth days.', 8, '#a3a3a3'],
    ['Venus', 'The hottest planet, because its thick clouds trap heat. It spins the opposite way to most planets.', 12, '#e0b56a'],
    ['Earth', 'Our home: the only planet known to have liquid water on its surface and life.', 12, '#4f8fdb'],
    ['Mars', 'The red planet. Its red colour comes from rusty iron in its dust.', 10, '#d0644a'],
    ['Jupiter', 'The biggest planet, a gas giant. More than 1,300 Earths could fit inside it.', 26, '#d6a77a'],
    ['Saturn', 'A gas giant famous for its bright rings, made of ice and rock.', 22, '#e3cf8f'],
    ['Uranus', 'An ice giant that spins tipped over on its side.', 16, '#8fd1d8'],
    ['Neptune', 'The farthest planet from the Sun, an ice giant with the strongest winds.', 16, '#4a6fd8']
  ];
  // Simple line drawings with named anchor points, so labels can point at the right place.
  const ART = {
    television: {
      match: /\b(tv|television|telly)\b/i,
      svg: '<rect x="30" y="20" width="240" height="150" rx="10" class="vz-fill"/><rect x="44" y="32" width="212" height="122" rx="4" class="vz-glass"/><path d="M120 170l-14 26M180 170l14 26M96 198h108"/><circle cx="236" cy="162" r="3"/><circle cx="64" cy="162" r="3"/><rect x="285" y="80" width="22" height="64" rx="8" class="vz-fill"/><circle cx="296" cy="94" r="4"/><path d="M291 108h10M291 118h10M291 128h10"/>',
      anchors: { screen: [150, 92], speaker: [64, 162], button: [236, 162], power: [236, 162], remote: [296, 112], stand: [150, 196], cable: [150, 196] }
    },
    bicycle: {
      match: /\b(bicycle|bike|cycle)\b/i,
      svg: '<circle cx="80" cy="140" r="46"/><circle cx="240" cy="140" r="46"/><circle cx="80" cy="140" r="4"/><circle cx="240" cy="140" r="4"/><path d="M80 140l52-62h78l30 62M132 78l28 62h-80M160 140l50-62"/><circle cx="160" cy="140" r="12"/><path d="M160 140l10 18M154 158h22"/><path d="M118 70h30M210 78l-6-24h22"/><path d="M92 140h58" stroke-dasharray="4 4"/>',
      anchors: { wheel: [80, 186], tyre: [80, 186], tire: [80, 186], pedal: [172, 158], chain: [120, 140], gear: [160, 140], seat: [133, 68], saddle: [133, 68], handle: [216, 54], brake: [222, 60], frame: [180, 100], spoke: [240, 120] }
    },
    plant: {
      match: /\b(plants?|leaf|leaves|photosynthesis|flower)\b/i,
      svg: '<path d="M150 196v-90"/><path d="M150 140c-40-10-60-40-56-70 32 2 54 30 56 70zM150 120c36-6 58-34 56-64-30 4-52 28-56 64z" class="vz-fill"/><path d="M110 196h80l-8 30h-64z" class="vz-fill"/><path d="M150 196c-10 10-30 14-40 26M150 196c10 10 30 14 40 26"/><circle cx="250" cy="40" r="18"/><path d="M250 10v8M250 62v8M220 40h8M272 40h8"/>',
      anchors: { leaf: [118, 98], leaves: [118, 98], stem: [150, 170], root: [128, 218], roots: [128, 218], sun: [250, 40], sunlight: [250, 40], flower: [150, 106], pot: [150, 210], soil: [150, 210] }
    },
    heart: {
      match: /\bheart\b/i,
      svg: '<path d="M150 210C80 160 50 120 60 84c8-30 46-40 70-18l20 18 20-18c24-22 62-12 70 18 10 36-20 76-90 126z" class="vz-fill"/><path d="M150 84v-50M130 60c-10-20-30-26-40-20M170 60c10-20 30-26 40-20"/><path d="M150 84v90M100 120h100" stroke-dasharray="4 4"/>',
      anchors: { atrium: [110, 100], atria: [110, 100], ventricle: [130, 160], ventricles: [130, 160], aorta: [150, 40], valve: [150, 120], artery: [100, 44], vein: [200, 44], left: [190, 140], right: [110, 140] }
    }
  };
  const artFor = (object, text) => { for (const [k, a] of Object.entries(ART)) if (a.match.test(object || '') || (!object && a.match.test(text || ''))) return k; return null; };
  const anchorFor = (art, part) => {
    const p = String(part).toLowerCase();
    for (const [k, xy] of Object.entries(ART[art].anchors)) if (p.includes(k)) return xy;
    return null;
  };

  /* ---------- maths visuals built from the question (never from the model) ---------- */
  const show = v => SparkMath.show(v);
  const isZero = v => SparkMath.near(v, SparkMath.Q(0n));
  const neg = v => SparkMath.ops.neg(v);
  function linTerm(a, b, x) {
    // a·x + b as school notation: "5x − 8", "x", "−2x + 3", "12"
    const parts = [];
    if (!isZero(a)) {
      const s = show(a), [n, d] = s.replace('-', '').split('/'), sign = s.startsWith('-') ? '−' : '';
      parts.push(d ? `${sign}${n === '1' ? '' : n}${x}/${d}` : s === '1' ? x : s === '-1' ? `−${x}` : `${sign}${n}${x}`);
    }
    if (!isZero(b) || !parts.length) { const s = show(b); if (!parts.length) parts.push(s.replace('-', '−')); else parts.push(s.startsWith('-') ? `− ${s.slice(1)}` : `+ ${s}`); }
    return parts.join(' ');
  }
  /* Balance-scale steps for a linear equation in the question, solved exactly. null if there isn't exactly one. */
  function equationSteps(question) {
    const p = SparkMath.problemOf(question);
    if (!p || p.kind !== 'equation' || p.roots.length !== 1 || p.none || p.identity) return null;
    const [L, R] = p.eq.split('=');
    const x = p.x, at = (side, t) => SparkMath.evaluate(side, { [x]: SparkMath.Q(BigInt(t)) });
    const coef = side => { const b = at(side, 0), a = SparkMath.ops.sub(at(side, 1), b); const c = at(side, 2); return SparkMath.near(SparkMath.ops.add(b, SparkMath.ops.mul(a, SparkMath.Q(2n))), c) ? [a, b] : null; };
    let l = coef(L), r = coef(R);
    if (!l || !r) return null; // not linear (quadratics get the normal worked answer)
    const steps = [{ left: L.trim().replace(/-/g, '−'), right: R.trim().replace(/-/g, '−'), say: 'Here is the equation. Both pans of the scale weigh the same.' }];
    const push = (say, op) => steps.push({ left: linTerm(l[0], l[1], x), right: linTerm(r[0], r[1], x), say, op });
    // Brackets first: 3(2x − 5) becomes 6x − 15, because the 3 multiplies both terms inside.
    const flat = t => t.replace(/[\s−-]/g, m => (m.trim() ? '-' : '')).replace(/\*/g, '');
    if (flat(linTerm(l[0], l[1], x)) !== flat(L) || flat(linTerm(r[0], r[1], x)) !== flat(R)) push(/\(/.test(L + R) ? 'Open the brackets: the number outside multiplies every term inside.' : 'Tidy up each side first.');
    if (isZero(l[0])) { [l, r] = [r, l]; push(`Swap the sides so ${x} is on the left. The scale is still balanced.`); }
    if (!isZero(r[0])) {
      const k = r[0], t = linTerm(k.n < 0n ? neg(k) : k, SparkMath.Q(0n), x);
      l = [SparkMath.ops.sub(l[0], k), l[1]]; r = [SparkMath.Q(0n), r[1]];
      push(k.n > 0n ? `Take ${t} away from both sides, so all the ${x}'s are on one side.` : `Add ${t} to both sides, so all the ${x}'s are on one side.`, k.n > 0n ? `− ${t}` : `+ ${t}`);
    }
    if (!isZero(l[1])) {
      const b = l[1];
      l = [l[0], SparkMath.Q(0n)]; r = [r[0], SparkMath.ops.sub(r[1], b)];
      push(b.n > 0n ? `Take ${show(b)} away from both sides to undo the + ${show(b)}.` : `Add ${show(neg(b))} to both sides to undo the − ${show(neg(b))}.`, b.n > 0n ? `− ${show(b)}` : `+ ${show(neg(b))}`);
    }
    if (!SparkMath.near(l[0], SparkMath.Q(1n))) {
      const a = l[0];
      l = [SparkMath.Q(1n), SparkMath.Q(0n)]; r = [r[0], SparkMath.ops.div(r[1], a)];
      // x/3 = 5 is undone by multiplying by 3; 5x = 40 by dividing by 5.
      if (a.d !== 1n) { const m = show(SparkMath.ops.div(SparkMath.Q(1n), a)).replace('-', '−'); push(`Multiply both sides by ${m}, so one whole ${x} is left.`, `× ${m}`); }
      else push(`Divide both sides by ${show(a).replace('-', '−')}, so one ${x} is left.`, `÷ ${show(a).replace('-', '−')}`);
    }
    const root = p.roots[0];
    if (!SparkMath.near(r[1], root)) return null; // never show steps that disagree with the exact answer
    const lv = SparkMath.evaluate(L, { [x]: root }), rv = SparkMath.evaluate(R, { [x]: root });
    // The check shows the original equation with the answer put in: both pans must weigh the same.
    const put = side => side.trim().replace(new RegExp(`(\\d)\\s*${x}\\b`, 'g'), `$1(${show(root)})`).replace(new RegExp(`\\b${x}\\b`, 'g'), `(${show(root)})`).replace(/-/g, '−');
    steps.push({ left: `${put(L)} = ${show(lv).replace('-', '−')}`, right: `${put(R)} = ${show(rv).replace('-', '−')}`, check: true, say: `Check: put ${x} = ${show(root)} back into the original equation. Both sides come to ${show(lv)}, so it balances. ${x} = ${show(root)} is right!` });
    return { type: 'equation', title: `Balancing ${p.eq.replace(/-/g, '−')}`, intro: 'Let\u2019s keep the scale balanced, one step at a time!', x, steps, answer: show(root), alt: `A balance scale solving ${p.eq}: ${steps.slice(1, -1).map(s => s.say).join(' ')} So ${x} = ${show(root)}.` };
  }
  /* Visuals that are fully decided by the question itself. */
  function localSpec(question, route) {
    const q = String(question || '');
    if (route && route.subject === 'math') {
      const eq = equationSteps(q);
      if (eq) return eq;
      const f = /(?:^|[^\d/])(\d{1,2})\s*\/\s*(\d{1,2})(?![\d/])/.exec(q);
      if (f && /\b(fraction|show|visual|what is|picture|draw|explain|mean)\b/i.test(q) && !/[=+×*÷-]/.test(q.replace(/\d\s*\/\s*\d/g, ''))) return { type: 'fraction', numerator: Number(f[1]), denominator: Number(f[2]), intro: 'Let\u2019s see it as slices of a pizza!' };
      const pc = /(\d{1,3}(?:\.\d)?)\s*%/.exec(q);
      if (pc && /\b(show|visual|what (is|does)|mean|picture|grid)\b/i.test(q) && !/\bof\b/i.test(q)) return { type: 'percent', percent: Number(pc[1]), intro: 'Let\u2019s colour it in on a grid of 100 squares!' };
    }
    if (/\b(solar system|planets?)\b/i.test(q) && !/\d/.test(q)) return { type: 'planets', intro: 'Let\u2019s fly past the planets! Tap one to visit it.' };
    if (/\b(electricity|electric circuit|circuit|light (a|the) bulb|bulb (glow|light)|switch and (a )?bulb)\b/i.test(q)) return { type: 'circuit', intro: 'Close the switch and watch what happens to the bulb!' };
    return null;
  }

  /* ---------- validation ---------- */
  const numbersIn = t => (String(t || '').replace(/(\d),(?=\d{2,3}\b)/g, '$1').match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  /* Checks a spec (from the model or local code) and returns a clean copy, or null if it can't be shown safely.
     ctx: { question, answer } — numbers in maths-like visuals must appear in them, so the picture agrees with the text. */
  function validate(raw, ctx = {}) {
    if (!raw || typeof raw !== 'object' || !TYPES.includes(raw.type)) return null;
    const t = raw.type, known = numbersIn(`${ctx.question || ''} ${ctx.answer || ''}`);
    const seen = v => !known.length || known.some(k => Math.abs(k - v) < 1e-9);
    const out = { type: t, title: str(raw.title, 70), intro: str(raw.intro, 110), alt: str(raw.alt, 400), note: str(raw.note, 140) };
    const emoji = typeof raw.emoji === 'string' && EMOJI.exec(raw.emoji); out.emoji = emoji ? emoji[0] : '';
    const followups = Array.isArray(raw.followups) ? raw.followups.map(f => str(f, 80)).filter(Boolean).slice(0, 3) : [];
    out.followups = followups;
    switch (t) {
      case 'labelled': {
        out.object = str(raw.object, 40);
        const parts = (Array.isArray(raw.parts) ? raw.parts : []).map(p => ({ name: str(p && p.name, 28), info: str(p && p.info, 240) })).filter(p => p.name && p.info);
        const uniq = []; for (const p of parts) if (!uniq.some(u => u.name.toLowerCase() === p.name.toLowerCase())) uniq.push(p);
        if (uniq.length < 2 || !out.object) return null;
        out.parts = uniq.slice(0, 6); out.art = artFor(out.object, ctx.question); break;
      }
      case 'fraction': {
        const n = num(raw.numerator), d = num(raw.denominator);
        if (!Number.isInteger(n) || !Number.isInteger(d) || d < 1 || d > 16 || n < 0 || n > d * 3) return null;
        if (!seen(n) || !seen(d)) return null;
        Object.assign(out, { numerator: n, denominator: d }); break;
      }
      case 'percent': {
        const p = num(raw.percent); if (!(p >= 0 && p <= 100) || !seen(p)) return null;
        out.percent = Math.round(p * 10) / 10; break;
      }
      case 'equation': {
        // Only steps rebuilt from the question are trusted.
        const eq = equationSteps(ctx.question);
        if (!eq) return null;
        return Object.assign(eq, { intro: out.intro || eq.intro, followups });
      }
      case 'numberline': {
        const start = num(raw.start), moves = (Array.isArray(raw.moves) ? raw.moves : []).map(num);
        if (!Number.isInteger(start) || Math.abs(start) > 20 || !moves.length || moves.length > 4 || moves.some(m => !Number.isInteger(m) || m === 0 || Math.abs(m) > 20)) return null;
        let pos = start; const path = [start];
        for (const m of moves) { pos += m; if (Math.abs(pos) > 30) return null; path.push(pos); }
        if (!seen(start) || !moves.every(m => seen(m) || seen(-m))) return null;
        Object.assign(out, { start, moves, path }); break;
      }
      case 'circuit': case 'planets': break;
      case 'process': {
        const steps = (Array.isArray(raw.steps) ? raw.steps : []).map(s => ({ title: str(s && s.title, 40), text: str(s && s.text, 220), icon: (s && typeof s.icon === 'string' && EMOJI.exec(s.icon) || [''])[0] })).filter(s => s.title && s.text);
        if (steps.length < 2) return null;
        Object.assign(out, { steps: steps.slice(0, 8), cycle: raw.cycle === true }); break;
      }
      case 'compare': {
        const side = s => ({ title: str(s && s.title, 40), items: (s && Array.isArray(s.items) ? s.items : []).map(i => str(i, 140)).filter(Boolean).slice(0, 5) });
        const left = side(raw.left), right = side(raw.right);
        if (!left.title || !right.title || !left.items.length || !right.items.length) return null;
        Object.assign(out, { left, right }); break;
      }
      case 'timeline': {
        const events = (Array.isArray(raw.events) ? raw.events : []).map(e => ({ when: str(e && e.when, 24), text: str(e && e.text, 160) })).filter(e => e.when && e.text);
        if (events.length < 2) return null;
        out.events = events.slice(0, 8); break;
      }
      case 'profit': {
        const cp = num(raw.cp), sp = num(raw.sp), qty = raw.quantity == null ? 1 : num(raw.quantity);
        if (!(cp > 0) || !(sp > 0) || !Number.isInteger(qty) || qty < 1 || qty > 1000) return null;
        if (!seen(cp) || !seen(sp)) return null;
        Object.assign(out, { cp, sp, quantity: qty, item: str(raw.item, 30) || 'item' }); break;
      }
      case 'triangle': {
        let a = (Array.isArray(raw.angles) ? raw.angles : []).map(num).filter(v => v > 0 && v < 180).slice(0, 3);
        if (a.length === 2 && a[0] + a[1] < 180) a.push(180 - a[0] - a[1]);
        if (a.length !== 3 || Math.abs(a[0] + a[1] + a[2] - 180) > 1e-6) return null;
        out.angles = a.map(v => Math.round(v * 10) / 10); break;
      }
    }
    return out;
  }

  /* ---------- rendering (trusted markup only) ---------- */
  let MASCOT = '';
  const head = (s, fallbackTitle) => `<div class="vz-head">${MASCOT}${s.emoji ? `<span class="vz-emoji" aria-hidden="true">${s.emoji}</span>` : ''}<div><b>${esc(s.title || fallbackTitle)}</b>${s.intro ? `<span>${esc(s.intro)}</span>` : ''}</div></div>`;
  const foot = s => `${s.note ? `<p class="vz-note">${esc(s.note)}</p>` : ''}${s.followups && s.followups.length ? `<div class="vz-follow">${s.followups.map(f => `<button type="button" data-vz-ask="${esc(f)}">${esc(f)}</button>`).join('')}</div>` : ''}`;
  const svgBox = (w, h, inner, label) => `<svg class="vz-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">${inner}</svg>`;

  const R = {
    labelled(s) {
      const pins = s.art ? s.parts.map((p, i) => { const xy = anchorFor(s.art, p.name); return xy ? `<g class="vz-pin" data-vz-part="${i}"><circle cx="${xy[0]}" cy="${xy[1]}" r="11"/><text x="${xy[0]}" y="${xy[1] + 4}">${i + 1}</text></g>` : ''; }).join('') : '';
      const pic = s.art ? svgBox(320, 230, `<g class="vz-art">${ART[s.art].svg}</g>${pins}`, `${s.object} with labelled parts`) : `<div class="vz-bigemoji" role="img" aria-label="${esc(s.object)}">${s.emoji || '🔍'}</div>`;
      return `${head(s, s.object)}<div class="vz-labelled"><div class="vz-pic">${pic}</div><ol class="vz-parts">${s.parts.map((p, i) => `<li><button type="button" data-vz-part="${i}" aria-expanded="false"><span class="vz-n">${i + 1}</span>${esc(p.name)}</button></li>`).join('')}</ol></div>
        <div class="vz-detail" data-vz-detail hidden aria-live="polite"></div>
        <p class="vz-hint">Tap a part to see what it does.</p>${foot(s)}`;
    },
    fraction(s) {
      const { numerator: n, denominator: d } = s, wholes = Math.max(1, Math.ceil(n / d));
      const pizza = k => {
        const filled = Math.max(0, Math.min(d, n - k * d)); let g = '';
        for (let i = 0; i < d; i++) {
          const a0 = (i / d) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / d) * 2 * Math.PI - Math.PI / 2;
          const p = (r, a) => `${(60 + r * Math.cos(a)).toFixed(2)} ${(60 + r * Math.sin(a)).toFixed(2)}`;
          g += d === 1 ? `<circle cx="60" cy="60" r="52" class="${i < filled ? 'vz-on' : 'vz-off'}" data-vz-slice="${k * d + i}"/>` : `<path d="M60 60L${p(52, a0)}A52 52 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(52, a1)}Z" class="${i < filled ? 'vz-on' : 'vz-off'}" data-vz-slice="${k * d + i}"/>`;
        }
        return svgBox(120, 120, g, `circle cut into ${d} equal parts, ${filled} shaded`);
      };
      const bar = Array.from({ length: d }, (_, i) => `<span class="${i < Math.min(n, d) ? 'vz-on' : 'vz-off'}"></span>`).join('');
      return `${head(s, `What ${n}/${d} looks like`)}<div class="vz-pizzas">${Array.from({ length: wholes }, (_, k) => pizza(k)).join('')}</div>
        <div class="vz-bar" aria-hidden="true">${bar}</div>
        <p class="vz-say" data-vz-frac>Cut into <b>${d}</b> equal parts and take <b>${n}</b>: that is <b>${n}/${d}</b>${n > d ? ` (more than one whole)` : n === d ? ' (one whole)' : ''}.</p>
        <div class="vz-row"><button type="button" data-vz-frac-step="-1" aria-label="One fewer part">−</button><span>Change the top number</span><button type="button" data-vz-frac-step="1" aria-label="One more part">+</button></div>${foot(s)}`;
    },
    equation(s) {
      return `${head(s, 'Balancing the equation')}<div class="vz-balance" data-vz-steps="${s.steps.length}" data-vz-at="0">
        ${svgBox(320, 150, '<path d="M160 30v100M110 140h100M40 50h240" class="vz-beam"/><path d="M40 50l-24 44h48zM280 50l-24 44h48z" class="vz-pan"/><circle cx="160" cy="30" r="6"/>', 'a balanced scale')}
        <div class="vz-pans"><span data-vz-left>${esc(s.steps[0].left)}</span><span class="vz-eq">=</span><span data-vz-right>${esc(s.steps[0].right)}</span></div>
        <p class="vz-op" data-vz-op hidden></p>
        <p class="vz-say" data-vz-say>${esc(s.steps[0].say)}</p>
        <div class="vz-row"><button type="button" data-vz-step="-1" disabled>‹ Back</button><span data-vz-count>Step 1 of ${s.steps.length}</span><button type="button" data-vz-step="1">Next ›</button></div>
      </div>${foot(s)}`;
    },
    percent(s) {
      const cells = Array.from({ length: 100 }, (_, i) => `<span class="${i < Math.round(s.percent) ? 'vz-on' : 'vz-off'}"></span>`).join('');
      return `${head(s, `${s.percent}% on a 100-square grid`)}<div class="vz-grid100" data-vz-grid aria-hidden="true">${cells}</div>
        <p class="vz-say" data-vz-pct><b>${s.percent}</b> out of every <b>100</b> squares are shaded: that is ${s.percent}%.</p>
        <label class="vz-slider">Try another: <input type="range" min="0" max="100" value="${Math.round(s.percent)}" data-vz-range aria-label="Percentage to shade"></label>${foot(s)}`;
    },
    numberline(s) {
      const lo = Math.min(...s.path) - 2, hi = Math.max(...s.path) + 2, W = 320, X = v => 20 + ((v - lo) / (hi - lo)) * (W - 40);
      let g = `<path d="M10 70H${W - 10}" class="vz-axis"/>`;
      for (let v = lo; v <= hi; v++) g += `<path d="M${X(v)} 64v12"/><text x="${X(v)}" y="94" class="${v === 0 ? 'vz-zero' : ''}">${v}</text>`;
      s.path.slice(1).forEach((p, i) => { const a = X(s.path[i]), b = X(p), m = (a + b) / 2; g += `<path d="M${a} 62Q${m} ${30 - i * 6} ${b} 62" class="vz-hop" data-vz-hop="${i}"/><text x="${m}" y="${36 - i * 6}" class="vz-hoplabel" data-vz-hop="${i}">${s.moves[i] > 0 ? '+' : '−'}${Math.abs(s.moves[i])}</text>`; });
      g += `<circle cx="${X(s.path[s.path.length - 1])}" cy="70" r="6" class="vz-dot"/>`;
      return `${head(s, 'On the number line')}${svgBox(W, 104, g, `number line from ${s.start}, moves ${s.moves.join(', ')}, ending at ${s.path[s.path.length - 1]}`)}
        <p class="vz-say">Start at <b>${s.start}</b>, ${s.moves.map(m => (m > 0 ? `jump right ${m}` : `jump left ${-m}`)).join(', then ')}: you land on <b>${s.path[s.path.length - 1]}</b>.</p>${foot(s)}`;
    },
    circuit(s) {
      return `${head(Object.assign({ title: 'A simple electric circuit', intro: s.intro || 'Close the switch and watch the bulb.' }, s), 'A simple electric circuit')}
        <div class="vz-circuit" data-vz-circuit="off">
        ${svgBox(320, 190, '<rect x="30" y="80" width="44" height="64" rx="6" class="vz-fill"/><path d="M42 80v-8h20v8"/><text x="52" y="118" class="vz-small">+  −</text><path d="M52 80V30h90M178 30h112v60M290 130v30H52v-16" class="vz-wire"/><path d="M142 30l34-18" class="vz-switch-open"/><path d="M142 30h36" class="vz-switch-closed"/><circle cx="142" cy="30" r="4"/><circle cx="178" cy="30" r="4"/><circle cx="290" cy="110" r="22" class="vz-bulb"/><path d="M282 118l8-14 8 14"/><g class="vz-current"><circle cx="52" cy="60" r="3"/><circle cx="230" cy="30" r="3"/><circle cx="290" cy="150" r="3"/><circle cx="150" cy="160" r="3"/></g><text x="52" y="164" class="vz-small">battery</text><text x="160" y="56" class="vz-small">switch</text><text x="290" y="80" class="vz-small">bulb</text>', 'battery, wires, switch and bulb in a loop')}
        <button type="button" class="vz-toggle" data-vz-switch aria-pressed="false">Close the switch</button>
        <p class="vz-say" data-vz-circuit-say>The switch is open, so there is a gap in the loop. No electricity can flow, and the bulb stays dark.</p></div>
        <p class="vz-note">${esc(s.note || 'A simplified model: real circuits have more parts, but the idea of a complete loop is the same.')}</p>${foot(Object.assign({}, s, { note: '' }))}`;
    },
    process(s) {
      return `${head(s, 'Step by step')}<ol class="vz-process ${s.cycle ? 'vz-cycle' : ''}" data-vz-proc="${s.steps.length}" data-vz-at="0">${s.steps.map((st, i) => `<li class="${i === 0 ? 'vz-now' : ''}" data-vz-pstep="${i}"><button type="button" data-vz-goto="${i}"><span class="vz-icon" aria-hidden="true">${st.icon || i + 1}</span><b>${esc(st.title)}</b></button></li>`).join('')}</ol>
        <p class="vz-say" data-vz-ptext><b>${esc(s.steps[0].title)}:</b> ${esc(s.steps[0].text)}</p>
        <div class="vz-row"><button type="button" data-vz-pmove="-1" disabled>‹ Back</button><span data-vz-pcount>Step 1 of ${s.steps.length}${s.cycle ? ' (it repeats)' : ''}</span><button type="button" data-vz-pmove="1">Next ›</button></div>${foot(s)}`;
    },
    planets(s) {
      const sun = '<circle cx="-20" cy="60" r="44" class="vz-sun"/>';
      let x = 50, g = sun;
      PLANETS.forEach(([name, , r, col], i) => { x += r + 8; g += `<g class="vz-planet" data-vz-planet="${i}" tabindex="0" role="button" aria-label="${name}"><circle cx="${x}" cy="60" r="${r}" fill="${col}"/>${name === 'Saturn' ? `<ellipse cx="${x}" cy="60" rx="${r + 9}" ry="5" class="vz-ring"/>` : ''}<text x="${x}" y="${60 + r + 16}" class="vz-small">${name}</text></g>`; x += r + 8; });
      return `${head(Object.assign({ title: 'The planets in order from the Sun', intro: s.intro || 'Tap a planet to learn about it.' }, s), '')}
        <div class="vz-scroll">${svgBox(x + 10, 120, g, 'The eight planets in order from the Sun: ' + PLANETS.map(p => p[0]).join(', '))}</div>
        <p class="vz-say" data-vz-planet-say>Tap a planet to learn about it.</p>
        <p class="vz-note">Not to scale: the real planets are much farther apart, and the Sun is far bigger than shown.</p>${foot(Object.assign({}, s, { note: '' }))}`;
    },
    compare(s) {
      const col = c => `<div class="vz-col"><b>${esc(c.title)}</b><ul>${c.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;
      return `${head(s, `${s.left.title} vs ${s.right.title}`)}<div class="vz-compare">${col(s.left)}<span class="vz-vs" aria-hidden="true">vs</span>${col(s.right)}</div>${foot(s)}`;
    },
    timeline(s) {
      return `${head(s, 'Timeline')}<ol class="vz-timeline">${s.events.map(e => `<li><span class="vz-when">${esc(e.when)}</span><span>${esc(e.text)}</span></li>`).join('')}</ol>${foot(s)}`;
    },
    profit(s) {
      const tc = s.cp * s.quantity, ts = s.sp * s.quantity, diff = ts - tc, max = Math.max(tc, ts);
      const money = v => '₹' + (Math.round(v * 100) / 100).toLocaleString('en-IN');
      const pct = tc ? Math.round((Math.abs(diff) / tc) * 10000) / 100 : 0;
      return `${head(s, diff >= 0 ? 'Profit: selling for more than it cost' : 'Loss: selling for less than it cost')}<div class="vz-bars">
        <div class="vz-barrow"><span>Cost price${s.quantity > 1 ? ` (${s.quantity} × ${money(s.cp)})` : ''}</span><div class="vz-barbox"><i style="width:${(tc / max) * 100}%" class="vz-cost"></i></div><b>${money(tc)}</b></div>
        <div class="vz-barrow"><span>Selling price${s.quantity > 1 ? ` (${s.quantity} × ${money(s.sp)})` : ''}</span><div class="vz-barbox"><i style="width:${(ts / max) * 100}%" class="vz-sell"></i></div><b>${money(ts)}</b></div></div>
        <p class="vz-say">${diff === 0 ? 'No profit and no loss: the selling price equals the cost.' : `${diff > 0 ? 'Profit' : 'Loss'} = ${money(ts)} − ${money(tc)} = <b>${money(Math.abs(diff))}</b> ${diff > 0 ? 'profit' : 'loss'}, which is <b>${pct}%</b> of the cost price.`}</p>${foot(s)}`;
    },
    triangle(s) {
      return `${head(s, 'Angles in a triangle')}<div class="vz-tri" data-vz-tri="${s.angles.join(',')}">${triSvg(s.angles)}
        <label class="vz-slider">Angle A <input type="range" min="10" max="150" value="${Math.round(s.angles[0])}" data-vz-angle="0" aria-label="Angle A"></label>
        <label class="vz-slider">Angle B <input type="range" min="10" max="150" value="${Math.round(s.angles[1])}" data-vz-angle="1" aria-label="Angle B"></label>
        <p class="vz-say" data-vz-tri-say>${triSay(s.angles)}</p></div>${foot(s)}`;
    }
  };
  function triPoints(a, b) {
    const A = [30, 150], B = [290, 150], ra = (a * Math.PI) / 180, rb = (b * Math.PI) / 180;
    const t = (260 * Math.sin(rb)) / Math.sin(ra + rb); // length of side from A
    return [A, B, [A[0] + t * Math.cos(ra), A[1] - t * Math.sin(ra)]];
  }
  function triSvg(angles) {
    const [A, B, C] = triPoints(angles[0], angles[1]);
    const ok = C[1] > 4;
    const pts = ok ? `${A.join(',')} ${B.join(',')} ${C[0].toFixed(1)},${C[1].toFixed(1)}` : `${A.join(',')} ${B.join(',')} 160,4`;
    return svgBox(320, 175, `<polygon points="${pts}" class="vz-fill" data-vz-poly/><text x="${A[0] + 22}" y="${A[1] - 8}" class="vz-small" data-vz-al="0">A ${angles[0]}°</text><text x="${B[0] - 58}" y="${B[1] - 8}" class="vz-small" data-vz-al="1">B ${angles[1]}°</text><text x="${ok ? C[0] - 22 : 138}" y="${ok ? C[1] + 22 : 26}" class="vz-small" data-vz-al="2">C ${angles[2]}°</text>`, `triangle with angles ${angles.join('°, ')}°`);
  }
  const triSay = a => `${a[0]}° + ${a[1]}° + ${a[2]}° = <b>180°</b>. Change A or B and C changes too, because the three angles of a triangle always add up to 180°.`;

  function render(spec, opts = {}) {
    if (!spec || !R[spec.type]) return '';
    const size = opts.band === 'young' ? ' vz-young' : '';
    MASCOT = opts.mascot || '';
    return `<figure class="vz vz-t-${spec.type}${size}" data-vz-type="${spec.type}">${R[spec.type](spec)}${spec.alt ? `<figcaption class="vz-sr">${esc(spec.alt)}</figcaption>` : ''}</figure>`;
  }

  /* ---------- interactions (event delegation; state lives in the DOM, nothing is executed from the spec) ---------- */
  function handle(e, spec, fig, cb = {}) {
    const t = e.target;
    const ask = t.closest('[data-vz-ask]'); if (ask) { cb.ask && cb.ask(ask.dataset.vzAsk); return true; }
    if (spec.type === 'labelled') {
      const b = t.closest('[data-vz-part]'); if (!b) return false;
      const i = Number(b.dataset.vzPart), p = spec.parts[i]; if (!p) return false;
      const d = fig.querySelector('[data-vz-detail]');
      fig.querySelectorAll('[data-vz-part]').forEach(x => { x.classList.toggle('vz-sel', Number(x.dataset.vzPart) === i); if (x.tagName === 'BUTTON') x.setAttribute('aria-expanded', String(Number(x.dataset.vzPart) === i)); });
      d.hidden = false;
      d.innerHTML = `<b>${esc(p.name)}</b><p>${esc(p.info)}</p><button type="button" data-vz-ask="${esc(`Tell me more about the ${p.name.toLowerCase()} of the ${spec.object.toLowerCase()}`)}">Ask Sparky about the ${esc(p.name.toLowerCase())}</button>`;
      cb.part && cb.part(p);
      return true;
    }
    if (spec.type === 'equation') {
      const b = t.closest('[data-vz-step]'); if (!b) return false;
      const box = fig.querySelector('.vz-balance'), at = Math.max(0, Math.min(spec.steps.length - 1, Number(box.dataset.vzAt) + Number(b.dataset.vzStep)));
      const st = spec.steps[at]; box.dataset.vzAt = at;
      fig.querySelector('[data-vz-left]').textContent = st.left; fig.querySelector('[data-vz-right]').textContent = st.right;
      const op = fig.querySelector('[data-vz-op]'); op.hidden = !st.op; op.textContent = st.op ? `${st.op} on both sides` : '';
      fig.querySelector('[data-vz-say]').textContent = st.say; fig.querySelector('[data-vz-count]').textContent = `Step ${at + 1} of ${spec.steps.length}`;
      box.classList.toggle('vz-done', !!st.check);
      fig.querySelector('[data-vz-step="-1"]').disabled = at === 0; fig.querySelector('[data-vz-step="1"]').disabled = at === spec.steps.length - 1;
      if (st.check) cb.celebrate && cb.celebrate();
      return true;
    }
    if (spec.type === 'process') {
      const mv = t.closest('[data-vz-pmove]'), go = t.closest('[data-vz-goto]'); if (!mv && !go) return false;
      const list = fig.querySelector('[data-vz-proc]'), n = spec.steps.length;
      let at = go ? Number(go.dataset.vzGoto) : Number(list.dataset.vzAt) + Number(mv.dataset.vzPmove);
      at = Math.max(0, Math.min(n - 1, at)); list.dataset.vzAt = at;
      fig.querySelectorAll('[data-vz-pstep]').forEach(li => li.classList.toggle('vz-now', Number(li.dataset.vzPstep) === at));
      fig.querySelector('[data-vz-ptext]').innerHTML = `<b>${esc(spec.steps[at].title)}:</b> ${esc(spec.steps[at].text)}`;
      fig.querySelector('[data-vz-pcount]').textContent = `Step ${at + 1} of ${n}${spec.cycle ? ' (it repeats)' : ''}`;
      fig.querySelector('[data-vz-pmove="-1"]').disabled = at === 0; fig.querySelector('[data-vz-pmove="1"]').disabled = at === n - 1;
      return true;
    }
    if (spec.type === 'circuit') {
      const b = t.closest('[data-vz-switch]'); if (!b) return false;
      const box = fig.querySelector('[data-vz-circuit]'), on = box.dataset.vzCircuit !== 'on';
      box.dataset.vzCircuit = on ? 'on' : 'off'; b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'Open the switch' : 'Close the switch';
      fig.querySelector('[data-vz-circuit-say]').textContent = on ? 'The switch is closed, so the loop is complete. Electricity flows from the battery, through the wires and the bulb, and back. The bulb lights up!' : 'The switch is open, so there is a gap in the loop. No electricity can flow, and the bulb stays dark.';
      return true;
    }
    if (spec.type === 'planets') {
      const g = t.closest('[data-vz-planet]'); if (!g) return false;
      const [name, fact] = PLANETS[Number(g.dataset.vzPlanet)];
      fig.querySelectorAll('[data-vz-planet]').forEach(x => x.classList.toggle('vz-sel', x === g));
      fig.querySelector('[data-vz-planet-say]').innerHTML = `<b>${name}</b> (planet ${Number(g.dataset.vzPlanet) + 1} from the Sun): ${esc(fact)}`;
      return true;
    }
    if (spec.type === 'fraction') {
      const b = t.closest('[data-vz-frac-step]'); if (!b) return false;
      const n = Math.max(0, Math.min(spec.denominator * 3, (Number(fig.dataset.vzN || spec.numerator)) + Number(b.dataset.vzFracStep)));
      fig.dataset.vzN = n;
      const d = spec.denominator, html = R.fraction(Object.assign({}, spec, { numerator: n, title: spec.title || `What ${spec.numerator}/${d} looks like` }));
      const tmp = fig.ownerDocument.createElement('div'); tmp.innerHTML = html;
      fig.querySelector('.vz-pizzas').replaceWith(tmp.querySelector('.vz-pizzas')); fig.querySelector('.vz-bar').replaceWith(tmp.querySelector('.vz-bar')); fig.querySelector('[data-vz-frac]').replaceWith(tmp.querySelector('[data-vz-frac]'));
      return true;
    }
    return false;
  }
  function input(e, spec, fig) {
    const t = e.target;
    if (spec.type === 'percent' && t.matches('[data-vz-range]')) {
      const v = Number(t.value);
      fig.querySelectorAll('[data-vz-grid] span').forEach((c, i) => { c.className = i < v ? 'vz-on' : 'vz-off'; });
      fig.querySelector('[data-vz-pct]').innerHTML = `<b>${v}</b> out of every <b>100</b> squares are shaded: that is ${v}%.`;
      return true;
    }
    if (spec.type === 'triangle' && t.matches('[data-vz-angle]')) {
      const box = fig.querySelector('[data-vz-tri]'), a = box.dataset.vzTri.split(',').map(Number);
      a[Number(t.dataset.vzAngle)] = Number(t.value);
      if (a[0] + a[1] >= 175) { a[Number(t.dataset.vzAngle)] = 175 - a[1 - Number(t.dataset.vzAngle)]; t.value = a[Number(t.dataset.vzAngle)]; }
      a[2] = 180 - a[0] - a[1]; box.dataset.vzTri = a.join(',');
      const tmp = fig.ownerDocument.createElement('div'); tmp.innerHTML = triSvg(a);
      box.querySelector('svg').replaceWith(tmp.firstChild);
      box.querySelector('[data-vz-tri-say]').innerHTML = triSay(a);
      return true;
    }
    return false;
  }

  /* ---------- asking the model for a spec ---------- */
  const SCHEMA = {
    type: 'OBJECT',
    properties: {
      type: { type: 'STRING', enum: ['labelled', 'process', 'compare', 'timeline', 'profit', 'triangle', 'numberline', 'fraction', 'percent', 'equation', 'circuit', 'planets', 'none'] },
      title: { type: 'STRING' }, intro: { type: 'STRING' }, alt: { type: 'STRING' }, emoji: { type: 'STRING' }, note: { type: 'STRING' },
      object: { type: 'STRING' },
      parts: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, info: { type: 'STRING' } }, required: ['name', 'info'] } },
      steps: { type: 'ARRAY', items: { type: 'OBJECT', properties: { title: { type: 'STRING' }, text: { type: 'STRING' }, icon: { type: 'STRING' } }, required: ['title', 'text'] } },
      cycle: { type: 'BOOLEAN' },
      left: { type: 'OBJECT', properties: { title: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['title', 'items'] },
      right: { type: 'OBJECT', properties: { title: { type: 'STRING' }, items: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['title', 'items'] },
      events: { type: 'ARRAY', items: { type: 'OBJECT', properties: { when: { type: 'STRING' }, text: { type: 'STRING' } }, required: ['when', 'text'] } },
      cp: { type: 'NUMBER' }, sp: { type: 'NUMBER' }, quantity: { type: 'NUMBER' }, item: { type: 'STRING' },
      angles: { type: 'ARRAY', items: { type: 'NUMBER' } }, start: { type: 'NUMBER' }, moves: { type: 'ARRAY', items: { type: 'NUMBER' } },
      numerator: { type: 'NUMBER' }, denominator: { type: 'NUMBER' }, percent: { type: 'NUMBER' },
      followups: { type: 'ARRAY', items: { type: 'STRING' } }
    },
    required: ['type', 'title', 'intro', 'alt']
  };
  // What each type must contain, used both in the prompt and to explain a retry.
  const NEEDS = { labelled: 'object, emoji and 3-6 parts', process: '3-8 steps', compare: 'left and right, each with a title and items', timeline: '3-8 events', profit: 'cp, sp, quantity and item', triangle: 'angles', numberline: 'start and moves', fraction: 'numerator and denominator', percent: 'percent' };
  function specPrompt({ question, answer, level, buddy }) {
    const kid = level && level.age ? `${level.age}-year-old` : '10-year-old';
    const few = level && level.band === 'young' ? 'at most 4 parts or steps, very simple words' : level && level.band === 'older' ? 'up to 6 parts or steps, correct subject terms' : 'up to 5 parts or steps, simple words';
    return `You design ONE small visual that helps a ${kid} understand an answer. Return JSON only.
Choose the single most useful type, or "none" if a visual would not really help (greetings, opinions, writing help, very abstract chat):
- labelled: a thing with named parts (a television, bicycle, heart, plant, volcano, computer). object = the thing; parts = [{name, info}] where info says what that part does in 1-2 simple sentences; emoji = one emoji of the thing.
- process: something that happens in steps or a cycle (photosynthesis, water cycle, digestion, how a bill becomes law). steps = [{title, text, icon (one emoji)}]; cycle = true if it repeats.
- compare: two things side by side (metaphor vs simile, literal vs intended meaning, herbivore vs carnivore). left/right = {title, items}.
- timeline: dated events (history). events = [{when, text}].
- profit: buying and selling with numbers from the question or answer. cp = cost price, sp = selling price (each), quantity, item.
- triangle: angles of a triangle given in the question (angles, in degrees).
- numberline: adding or subtracting integers, especially negatives (start, moves).
- fraction / percent / equation / circuit / planets: only if the question is about that (numbers must come from the question).
Rules: every fact must agree with the answer below and be true; never invent numbers; ${few}; title at most 6 words; every text field short (info and step text under 30 words); never repeat words; intro = one short friendly line from ${buddy || 'Sparky'} to the child (e.g. "Let's discover how a television works!"); alt = one sentence describing the visual for someone who can't see it; followups = up to 2 short questions the child might ask next; note = say "A simplified model" if the picture simplifies the science. No markup, no code.
Leave out fields the chosen type doesn't use. Fill EVERY field the chosen type needs; each part needs both a name and an info sentence (${Object.entries(NEEDS).map(([k, v]) => `${k}: ${v}`).join('; ')}). A visual with missing fields cannot be shown.
Example for "What is a bicycle?": {"type":"labelled","title":"Parts of a bicycle","intro":"Let's look at what makes a bicycle go!","alt":"A bicycle with its wheels, pedals, chain, handlebar and seat labelled.","object":"bicycle","emoji":"🚲","parts":[{"name":"Pedals","info":"You push them with your feet to turn the chain."},{"name":"Chain","info":"Carries the push from the pedals to the back wheel."},{"name":"Wheels","info":"Roll along the ground to move you forward."},{"name":"Handlebar","info":"Lets you steer left and right."},{"name":"Brakes","info":"Squeeze them to slow down and stop safely."}],"followups":["How do gears work?"]}

QUESTION: ${JSON.stringify(String(question).slice(0, 600))}
ANSWER: ${JSON.stringify(String(answer).slice(0, 2500))}`;
  }
  /* Is a visual worth trying for this turn? Saves a model call for chit-chat, hints, attempts and writing. */
  function wanted(route, text) {
    if (!route) return false;
    if (['chat', 'hint', 'attempt', 'explain-step', 'creative'].includes(route.kind) || route.voice) return false;
    if (route.subject === 'writing') return false;
    return String(text || '').trim().length >= 6;
  }

  /* Why a spec couldn't be shown, so one retry can ask for exactly what was missing. */
  const missing = raw => raw && TYPES.includes(raw.type) ? `Your JSON for type "${raw.type}" was missing or had invalid fields. It needs: ${NEEDS[raw.type] || 'its fields'}. Reply with the complete JSON.` : 'Reply with complete JSON for one visual type.';
  return { validate, render, handle, input, localSpec, equationSteps, specPrompt, wanted, missing, SCHEMA, PLANETS, ART, TYPES };
});
