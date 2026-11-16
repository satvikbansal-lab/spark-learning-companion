// My Learning World: the personal learning memory engine (spark-learnmem.js). Run with: node --test tests/
const test = require('node:test');
const assert = require('node:assert');
const L = require('../spark-learnmem.js');
const DAY = 864e5, NOW = Date.UTC(2026, 10, 16);
const on = () => Object.assign(L.emptyStore(), { enabled: true });
const vals = (s, cat) => s.memories.filter(m => m.cat === cat && !m.removed).map(m => m.key);

test('extracts cricket and animals as interests, one memory per idea', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'activity', value: 'Playing cricket', explicit: true }, { category: 'interest', value: 'animals', explicit: false }, { category: 'activity', value: 'cricket matches', explicit: false }], NOW);
  assert.deepStrictEqual(vals(s, 'activity'), ['cricket']);
  assert.deepStrictEqual(vals(s, 'interest'), ['animals']);
});
test('re-reading the same page never duplicates, and pages add up', () => {
  const s = on();
  for (let i = 0; i < 3; i++) L.absorb(s, 'p1', [{ category: 'activity', value: 'cricket', explicit: false }], NOW);
  assert.strictEqual(s.memories.length, 1);
  assert.strictEqual(s.memories[0].sources.length, 1);
  L.absorb(s, 'p2', [{ category: 'activity', value: 'cricket', explicit: false }], NOW);
  assert.strictEqual(s.memories[0].sources.length, 2);
  assert.strictEqual(L.frequency(s.memories[0]), 'medium');
});
test('one passing mention is not used; an explicit love or repeats are', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'interest', value: 'drawing', explicit: false }], NOW);
  const m = s.memories[0];
  assert.ok(L.confidence(m, NOW) < L.USE_AT);
  assert.deepStrictEqual(L.retrieve(s, { subject: 'math', text: 'area of a triangle', now: NOW }).familiar, []);
  L.absorb(s, 'p2', [{ category: 'interest', value: 'drawing', explicit: false }], NOW);
  assert.ok(L.confidence(m, NOW) >= L.USE_AT);
  const t = on(); L.absorb(t, 'p1', [{ category: 'activity', value: 'cricket', explicit: true }], NOW);
  assert.ok(L.usable(t.memories[0], NOW));
});
test('confidence grows with pages and fades when not mentioned for months', () => {
  const s = on();
  ['a', 'b', 'c', 'd'].forEach(p => L.absorb(s, p, [{ category: 'activity', value: 'cycling', explicit: false }], NOW));
  const m = s.memories[0];
  assert.strictEqual(L.confidence(m, NOW), 0.85);
  assert.ok(L.confidence(m, NOW + 100 * DAY) < 0.85);
  assert.ok(L.confidence(m, NOW + 200 * DAY) < L.confidence(m, NOW + 100 * DAY));
  assert.ok(L.stale(m, NOW + 200 * DAY));
});
test('sensitive things are never kept, even if the model returns them', () => {
  const s = on();
  L.absorb(s, 'p1', [
    { category: 'experience', value: 'fight with my brother', explicit: true }, { category: 'interest', value: 'feeling sad', explicit: true },
    { category: 'experience', value: 'hospital visit', explicit: false }, { category: 'interest', value: 'temple', explicit: false },
    { category: 'interest', value: 'I went to the market with my mum and we bought lots of things', explicit: false },
    { category: 'experience', value: 'birthday party', explicit: false }, { category: 'interest', value: 'cricket', explicit: true }], NOW);
  assert.deepStrictEqual(s.memories.map(m => m.key).sort(), ['birthday party', 'cricket']);
});
test('subjects and styles only accept school subjects and known styles; tricky needs the student to say so', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'subject_hard', value: 'fractions', explicit: false }, { category: 'subject_like', value: 'pizza', explicit: true }, { category: 'style', value: 'step by step', explicit: true }, { category: 'subject_like', value: 'science', explicit: true }], NOW);
  assert.deepStrictEqual(s.memories.map(m => m.cat + ':' + m.key).sort(), ['style:step-by-step', 'subject_like:science']);
});
test('excluding or deleting a page removes what only it contributed', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'activity', value: 'cricket', explicit: true }, { category: 'interest', value: 'animals', explicit: true }], NOW);
  L.absorb(s, 'p2', [{ category: 'activity', value: 'cricket', explicit: false }], NOW);
  L.setExcluded(s, 'p1', true);
  assert.deepStrictEqual(s.memories.map(m => m.key), ['cricket']);
  assert.deepStrictEqual(s.memories[0].sources.map(x => x.entry), ['p2']);
  assert.deepStrictEqual(L.absorb(s, 'p1', [{ category: 'interest', value: 'animals', explicit: true }], NOW).added, []); // excluded pages are ignored
  L.forgetEntry(s, 'p2');
  assert.strictEqual(s.memories.length, 0);
});
test('a removed memory stays removed; corrections and manual additions are the student’s', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'activity', value: 'football', explicit: true }], NOW);
  const id = s.memories[0].id;
  L.remove(s, id);
  L.absorb(s, 'p2', [{ category: 'activity', value: 'football', explicit: true }], NOW);
  assert.deepStrictEqual(vals(s, 'activity'), []);
  L.restoreMemory(s, id);
  assert.deepStrictEqual(vals(s, 'activity'), ['football']);
  const n = L.correct(s, id, 'basketball', NOW);
  assert.strictEqual(n.key, 'basketball'); assert.ok(n.manual);
  assert.deepStrictEqual(vals(s, 'activity'), ['basketball']);
  assert.strictEqual(L.addManual(s, 'interest', 'my uncle is sick'), null);
  assert.ok(L.addManual(s, 'interest', 'Space'));
});
test('lessons get only relevant, approved interests, and nothing when personalisation is off', () => {
  const s = on();
  L.addManual(s, 'activity', 'cricket'); L.addManual(s, 'activity', 'gardening'); L.addManual(s, 'activity', 'shopping'); L.addManual(s, 'activity', 'cycling');
  assert.ok(L.retrieve(s, { subject: 'math', text: 'what are fractions', now: NOW }).familiar.includes('cricket'));
  assert.deepStrictEqual(L.retrieve(s, { subject: 'science', text: 'explain photosynthesis', now: NOW }).familiar[0], 'gardening');
  assert.deepStrictEqual(L.retrieve(s, { subject: 'science', text: 'what is speed and how do we measure it', now: NOW }).familiar[0], 'cycling');
  assert.strictEqual(L.retrieve(s, { subject: 'math', text: 'find 20 percent discount on a toy', now: NOW }).familiar[0], 'shopping');
  assert.deepStrictEqual(L.retrieve(s, { subject: 'english', text: 'what is a noun', now: NOW }).familiar, []); // nothing forced
  assert.ok(L.retrieve(s, { subject: '', text: 'Fractions and equivalent fractions', now: NOW }).familiar.includes('cricket')); // plurals count
  s.enabled = false;
  assert.deepStrictEqual(L.retrieve(s, { subject: 'math', text: 'fractions', now: NOW }), { familiar: [], styles: [], tricky: [] });
  assert.strictEqual(L.teachingContext(L.retrieve(s, { subject: 'math', text: 'fractions' })), '');
  s.enabled = true;
  assert.deepStrictEqual(L.retrieve(s, { subject: 'math', text: 'fractions', allowed: false }).familiar, []); // a parent turned it off
});
test('recently used examples are rested so lessons vary', () => {
  const s = on();
  L.addManual(s, 'activity', 'cricket'); L.addManual(s, 'activity', 'football');
  const first = L.retrieve(s, { subject: 'math', text: 'angles', now: NOW, max: 1 }).familiar[0];
  L.logLesson(s, 'angles', [first], [first]); L.logLesson(s, 'angles 2', [first], [first]);
  const next = L.retrieve(s, { subject: 'math', text: 'angles', now: NOW, max: 1 }).familiar[0];
  assert.notStrictEqual(next, first);
});
test('the lesson context never carries diary text and forbids mentioning the diary', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'activity', value: 'cricket', explicit: true }], NOW);
  const ctx = L.teachingContext(L.retrieve(s, { subject: 'math', text: 'fractions', now: NOW }));
  assert.match(ctx, /cricket/);
  assert.match(ctx, /never mention a diary/);
  assert.match(ctx, /textbook-style example/);
  assert.doesNotMatch(JSON.stringify(s), /sentence|wrote today/);
});
test('profile view, summary, usage detection and the extraction safeguards', () => {
  const s = on();
  L.absorb(s, 'p1', [{ category: 'activity', value: 'cricket', explicit: true }, { category: 'interest', value: 'drawing', explicit: true }, { category: 'interest', value: 'animals', explicit: true }], NOW);
  const p = L.profile(s, NOW);
  assert.strictEqual(p.categories.activity[0].name, 'cricket');
  assert.deepStrictEqual(p.categories.activity[0].sources, ['p1']);
  assert.match(L.summary(s, NOW), /^Spark knows you enjoy .*cricket.* and /);
  assert.deepStrictEqual(L.usedIn('Imagine your team needs 12 runs in cricket…', ['cricket', 'cycling']), ['cricket']);
  assert.match(L.extractPrompt('I love cricket'), /NEVER include: names of people/);
  assert.strictEqual(L.hash('abc'), L.hash('abc')); assert.notStrictEqual(L.hash('abc'), L.hash('abd'));
  assert.strictEqual(L.retryAt(5, NOW), null); assert.strictEqual(L.retryAt(1, NOW), NOW + 30000);
  L.wipe(s); assert.strictEqual(s.memories.length, 0); assert.strictEqual(s.enabled, true);
});
