// Offline tests for the visual learning engine (spark-visuals.js): validation, safety, maths agreement,
// local visuals and rendering. Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const V = require('../spark-visuals.js');
const AI = require('../spark-ai.js');
const M = require('../spark-math.js');

/* ---------- maths visuals always agree with the exact answer ---------- */
test('equation: balance steps for 5x − 8 = 32 add 8, divide by 5, then check by substitution', () => {
  const e = V.equationSteps('Explain why 5x - 8 = 32.');
  assert.deepEqual(e.steps.map(s => `${s.left} | ${s.right}`), ['5x − 8 | 32', '5x | 40', 'x | 8', '5(8) − 8 = 32 | 32 = 32']);
  assert.deepEqual(e.steps.map(s => s.op || ''), ['', '+ 8', '÷ 5', '']);
  assert.equal(e.answer, '8');
  assert.ok(e.steps[e.steps.length - 1].check);
});
test('equation: brackets are opened first, x terms gathered, and the root matches the exact solver', () => {
  for (const q of ['Solve 3(2x − 5) = 4x + 7', 'Solve 7 − 2x = 3x − 8', 'Solve x/3 + 2 = 7', 'Solve −4(x + 2) = 2(x − 7)', 'Solve 0.5x − 1.2 = 0.3x + 0.4']) {
    const e = V.equationSteps(q), exact = M.problemOf(q).roots[0];
    assert.ok(e, q);
    assert.equal(e.answer, M.show(exact), q);
    const last = e.steps[e.steps.length - 1], [lhs, rhs] = [last.left.split('=').pop(), last.right.split('=').pop()].map(t => t.trim());
    assert.equal(lhs, rhs, `${q}: both sides of the check are equal`);
  }
  assert.match(V.equationSteps('Solve 3(2x − 5) = 4x + 7').steps[1].say, /Open the brackets/);
  assert.equal(V.equationSteps('Solve x/3 + 2 = 7').steps[2].op, '× 3', 'x/3 is undone by multiplying');
});
test('equation: no visual for quadratics, identities or ambiguous notation', () => {
  assert.equal(V.equationSteps('Solve x² − 5x + 6 = 0'), null);
  assert.equal(V.equationSteps('Solve 2(x + 3) = 2x + 6'), null);
  assert.equal(V.equationSteps('Solve 1/2x = 4'), null);
});
test('equation specs from the model are ignored: only steps rebuilt from the question are drawn', () => {
  const fake = { type: 'equation', steps: [{ left: 'x', right: '99' }] };
  const v = V.validate(fake, { question: 'Explain why 5x - 8 = 32.' });
  assert.equal(v.answer, '8');
  assert.equal(V.validate(fake, { question: 'What is a fraction?' }), null);
});

/* ---------- local visuals ---------- */
test('local visuals: fraction, percent, planets and circuit come from the question itself', () => {
  const l = q => V.localSpec(q, AI.route(q));
  assert.deepEqual({ ...l('What is 3/4? Show me visually.'), intro: undefined }, { type: 'fraction', numerator: 3, denominator: 4, intro: undefined });
  assert.equal(l('Show me 35% on a grid').percent, 35);
  assert.equal(l('Explain the solar system.').type, 'planets');
  assert.equal(l('How does electricity light a bulb?').type, 'circuit');
  assert.equal(l('Explain why 5x - 8 = 32.').type, 'equation');
  assert.equal(l('What is a television?'), null, 'objects go to the model');
  assert.equal(l('What is 3/4 + 1/2?'), null, 'a sum is not a single fraction picture');
});

/* ---------- validation and safety ---------- */
test('validate: numbers in a visual must come from the question or the answer', () => {
  assert.equal(V.validate({ type: 'fraction', numerator: 5, denominator: 9 }, { question: 'What is 3/4?' }), null);
  assert.equal(V.validate({ type: 'profit', cp: 100, sp: 150 }, { question: 'Explain profit', answer: 'Buy at ₹200, sell at ₹250' }), null);
  const p = V.validate({ type: 'profit', cp: 200, sp: 250, item: 'bat' }, { answer: 'Buy at ₹200, sell at ₹250' });
  assert.equal(p.cp, 200);
  assert.equal(V.validate({ type: 'triangle', angles: [50, 60, 80] }), null, 'angles must add to 180');
  assert.deepEqual(V.validate({ type: 'triangle', angles: [50, 60] }).angles, [50, 60, 70]);
  assert.equal(V.validate({ type: 'percent', percent: 140 }), null);
  assert.equal(V.validate({ type: 'numberline', start: 3, moves: [-5, 4] }, { question: 'What is 3 − 5 + 4?' }).path.join(','), '3,-2,2');
});
test('validate: missing pieces mean no visual, never a broken one', () => {
  assert.equal(V.validate(null), null);
  assert.equal(V.validate({ type: 'video', src: 'x' }), null, 'unknown types');
  assert.equal(V.validate({ type: 'labelled', object: 'tv', parts: [{ name: 'Screen' }] }), null, 'parts need explanations');
  assert.equal(V.validate({ type: 'process', steps: [{ title: 'One', text: 'x' }] }), null, 'a process needs 2+ steps');
  assert.equal(V.validate({ type: 'compare', left: { title: 'A', items: [] }, right: { title: 'B', items: ['x'] } }), null);
  assert.match(V.missing({ type: 'labelled' }), /3-6 parts/);
});
test('safety: model text cannot inject markup, scripts or attributes', () => {
  const v = V.validate({ type: 'labelled', object: 'TV"><script>alert(1)</script>', emoji: '📺<img src=x onerror=alert(1)>', title: '<b onmouseover=x>hi</b>', parts: [{ name: '<svg onload=alert(1)>', info: '"><img src=x>' }, { name: 'Remote', info: 'Changes "channels" & more' }] }, { question: 'What is a TV?' });
  const html = V.render(v);
  // Angle brackets from the model are removed, so its words can only ever be text, never tags or attributes.
  assert.doesNotMatch(html, /<script|<img|<svg onload/i);
  assert.doesNotMatch(html, /<[^>]*\son\w+\s*=/i, 'no event-handler attribute inside any tag');
  assert.equal(v.emoji, '📺');
  assert.equal(v.parts[1].info, 'Changes "channels" & more', 'ordinary punctuation is kept');
  assert.match(html, /aria-label="TV&quot;scriptalert\(1\)\/script with labelled parts"/, 'quotes are escaped inside attributes');
  const proc = V.render(V.validate({ type: 'process', steps: [{ title: 'A', text: 'x', icon: '<b>' }, { title: 'B', text: 'y', icon: '🌧️' }] }));
  assert.match(proc, /<span class="vz-icon" aria-hidden="true">1<\/span>/, 'a non-emoji icon is replaced by the step number');
  assert.match(proc, /<span class="vz-icon" aria-hidden="true">🌧️<\/span>/);
});

/* ---------- rendering ---------- */
const samples = {
  labelled: [{ type: 'labelled', object: 'bicycle', emoji: '🚲', parts: [{ name: 'Pedals', info: 'Push them.' }, { name: 'Chain', info: 'Turns the wheel.' }, { name: 'Brakes', info: 'Stop you.' }] }, { question: 'Explain how a bicycle works.' }],
  fraction: [{ type: 'fraction', numerator: 3, denominator: 4 }, { question: 'What is 3/4?' }],
  equation: [{ type: 'equation' }, { question: 'Explain why 5x - 8 = 32.' }],
  percent: [{ type: 'percent', percent: 35 }, { question: 'Show 35%' }],
  numberline: [{ type: 'numberline', start: -3, moves: [5] }, { question: 'What is -3 + 5?' }],
  circuit: [{ type: 'circuit' }, {}], planets: [{ type: 'planets' }, {}],
  process: [{ type: 'process', cycle: false, steps: [{ title: 'Sunlight', text: 'Leaves catch sunlight.', icon: '☀️' }, { title: 'Water', text: 'Roots bring water.', icon: '💧' }, { title: 'Food', text: 'The plant makes sugar.', icon: '🍃' }] }, {}],
  compare: [{ type: 'compare', left: { title: 'Metaphor', items: ['Says one thing IS another'] }, right: { title: 'Simile', items: ['Uses like or as'] } }, {}],
  timeline: [{ type: 'timeline', events: [{ when: '1857', text: 'First War of Independence' }, { when: '1947', text: 'India becomes independent' }] }, { question: '1857 1947' }],
  profit: [{ type: 'profit', cp: 200, sp: 250, quantity: 2, item: 'bat' }, { answer: '200 250 2' }],
  triangle: [{ type: 'triangle', angles: [47, 68] }, { question: 'Two angles are 47 and 68' }]
};
test('render: every visual type draws, with the right interactive controls and a text description', () => {
  for (const [type, [spec, ctx]] of Object.entries(samples)) {
    const v = V.validate(spec, ctx);
    assert.ok(v, `${type} validates`);
    const html = V.render(Object.assign(v, { alt: `A ${type} visual` }), { mascot: '<img class="vz-buddy" alt="">' });
    assert.match(html, new RegExp(`class="vz vz-t-${type}`), type);
    assert.match(html, /vz-buddy/, `${type}: Sparky introduces it`);
    assert.match(html, /<figcaption class="vz-sr">/, `${type}: has a text description`);
  }
  const r = t => V.render(V.validate(...samples[t]));
  assert.match(r('labelled'), /<svg[^>]*aria-label="bicycle with labelled parts"/, 'known objects get a drawing with pins');
  assert.match(r('labelled'), /data-vz-part="0"/);
  assert.match(r('equation'), /data-vz-step="1"/);
  assert.match(r('circuit'), /data-vz-switch/);
  assert.match(r('planets'), /Not to scale/);
  assert.match(r('profit'), /Profit = ₹500 − ₹400 = <b>₹100<\/b> profit, which is <b>25%<\/b>/, 'bars and words use the same numbers');
  assert.match(r('fraction'), /take <b>3<\/b>: that is <b>3\/4<\/b>/);
  assert.equal((r('fraction').match(/class="vz-on"/g) || []).length, 6, '3 slices on the pizza + 3 on the bar');
  assert.match(V.render(V.validate(...samples.fraction), { band: 'young' }), /vz-young/, 'larger text for young learners');
});
test('wanted: no visual call for chit-chat, hints, attempts, writing help or voice', () => {
  const w = (q, extra) => V.wanted(Object.assign(AI.route(q, { prevSubject: 'math' }), extra || {}), q);
  assert.equal(w('thanks!'), false);
  assert.equal(w('Give me a hint for 2x + 3 = 9'), false);
  assert.equal(w('I got x = 4'), false);
  assert.equal(w('Help me write a story about a dragon'), false);
  assert.equal(w('What is a television?', { voice: true }), false);
  assert.equal(w('What is a television?'), true);
});

/* ---------- real pictures from Wikipedia ---------- */
const fakeWiki = calls => async url => {
  calls.push(url);
  const q = new URL(url).searchParams;
  if (q.get('prop') === 'pageimages') return { query: { normalized: [{ from: 'television', to: 'Television' }], pages: { 1: { title: 'Television', pageimage: 'TV_set.jpg' } } } };
  if (q.get('action') === 'parse') return { parse: { title: 'Television', images: ['Wikipedia-logo.png', 'Old_TV.jpg', 'Diagram.svg', 'Studio.jpg', 'Hack.jpg'] } };
  if (q.get('prop') === 'imageinfo') {
    const page = (title, lic, host = 'https://upload.wikimedia.org/x/900px-a.jpg?utm_source=en.wikipedia.org') => ({ title, imageinfo: [{ thumburl: host, descriptionurl: 'https://commons.wikimedia.org/wiki/' + title, extmetadata: { LicenseShortName: { value: lic }, ImageDescription: { value: `<b>${title}</b> photo` }, Artist: { value: '<a href="x">Ann</a>' } } }] });
    return { query: { pages: { a: page('File:TV set.jpg', 'CC BY-SA 4.0'), b: page('File:Old TV.jpg', 'Public domain', 'https://thumb.wikimedia.org/wikipedia/commons/thumb/b/b0/Old_TV.jpg/960px-Old_TV.jpg'), c: page('File:Studio.jpg', 'Fair use'), d: page('File:Hack.jpg', 'CC0', 'https://evil.example/x.jpg') } } };
  }
  return null;
};
test('pictures: only article titles are sent, and only free Wikimedia images come back', async () => {
  const calls = [];
  const imgs = await V.wikiImages(['television'], fakeWiki(calls));
  assert.equal(imgs.length, 2, 'fair-use and off-site images are dropped');
  assert.deepEqual(imgs.map(i => i.license), ['CC BY-SA 4.0', 'Public domain']);
  assert.ok(imgs.every(i => /^https:\/\/(upload|thumb)\.wikimedia\.org\//.test(i.src)));
  assert.match(imgs[0].src, /\/500px-a\.jpg$/, 'small thumbnails in the gallery (tracking query removed), the large one in the popup');
  assert.equal(imgs[0].title, 'Television', 'lowercase titles are resolved to the real article');
  assert.ok(calls.length <= 4, `few requests (${calls.length})`);
  assert.equal(imgs[0].alt, 'File:TV set.jpg photo', 'descriptions are plain text');
  assert.equal(imgs[0].credit, 'Ann');
  assert.ok(calls.every(u => u.startsWith('https://en.wikipedia.org/w/api.php?')));
  assert.ok(calls.every(u => !/my name|riya/i.test(u)));
  assert.doesNotMatch(calls.find(u => /prop=imageinfo/.test(u)), /logo|\.svg/i, 'logos and diagrams are skipped');
});
test('pictures: unsafe or odd search terms are never sent', async () => {
  assert.deepEqual(V.cleanTerms(['Television', 'Gun violence', 'Pizza', '<script>', 'Hamburger', 'Extra']), ['Television', 'Pizza', 'Hamburger']);
  const calls = [];
  assert.deepEqual(await V.wikiImages(['War crimes', 'Bomb'], fakeWiki(calls)), []);
  assert.equal(calls.length, 0);
});
test('pictures: rendering accepts only Wikimedia addresses and escapes text', () => {
  const html = V.renderImages([
    { src: 'https://upload.wikimedia.org/a/400px-x.jpg', large: 'https://upload.wikimedia.org/a/900px-x.jpg', title: 'TV', alt: 'A "TV" <set>', page: 'https://en.wikipedia.org/wiki/TV' },
    { src: 'javascript:alert(1)', title: 'bad', alt: 'bad' },
    { src: 'https://evil.example/x.jpg', title: 'bad2', alt: 'bad2' }
  ]);
  assert.equal((html.match(/<img /g) || []).length, 1);
  assert.match(html, /alt="A &quot;TV&quot; &lt;set&gt;"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /Pictures from <a href="https:\/\/en.wikipedia.org\/wiki\/TV"/, 'credited to Wikipedia');
  assert.equal(V.renderImages([]), '');
});
test('pictures for every question: search words for any topic, none for small talk', () => {
  const t = q => V.termsFor(q, AI.route(q, { prevSubject: /\d/.test(q) ? 'math' : undefined }));
  assert.deepEqual(t('Why do cats purr?'), ['cats purr']);
  assert.deepEqual(t('How does the internet work?'), ['internet']);
  assert.deepEqual(t('Who was Akbar?'), ['akbar']);
  assert.deepEqual(t('kya hai photosynthesis'), ['photosynthesis'], 'Hinglish filler words are dropped');
  assert.deepEqual(t('burger vs pizza, which is healthier?').slice(0, 2), ['burger', 'pizza'], 'two topics get two searches');
  assert.deepEqual(t('Solve 2x + 5 = 17'), ['Equation'], 'maths gets its topic, not the numbers');
  assert.deepEqual(t('Give me a hint for 5x - 7 = 3x + 9'), ['Equation'], 'hints get pictures too');
  assert.deepEqual(t('What is 3/4?'), ['Fraction']);
  assert.deepEqual(t('Help me write a story about a dragon'), ['dragon'], 'task words (write, story) are not the topic');
  assert.deepEqual(t('hi'), []);
  assert.deepEqual(t('thanks!'), []);
});
