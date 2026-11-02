// Offline tests for learning from checked examples (spark-examples.js). Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../spark-examples.js');

const seed = () => [
  ['A shopkeeper buys a fan for ₹800 and sells it at 15% profit. Find the selling price.', 'SP = 920', 'math', 'second'],
  ['Solve 2x + 5 = 17', 'x = 6', 'math', 'exact'],
  ['Find the area of a circle of radius 7 cm. Use π = 22/7.', '154 cm²', 'math', 'exact'],
  ['Why do leaves of desert plants have spines?', 'To reduce water loss.', 'science', 'reviewed']
].reduce((l, [q, a, subject, how]) => E.add(l, { q, a, subject, how }), []);

test('examples: only checked answers are kept, newest first, no repeats, capped', () => {
  let l = seed();
  assert.equal(l.length, 4);
  assert.equal(E.add(l, { q: 'x', a: 'y', how: 'guess' }).length, 4); // not a check Spark knows
  assert.equal(E.add(l, { q: '', a: 'y', how: 'exact' }).length, 4);
  l = E.add(l, { q: 'Solve 2x + 5 = 17.', a: 'x = 6 again', subject: 'math', how: 'exact' });
  assert.equal(l.length, 4); assert.equal(l[0].a, 'x = 6 again'); // same question: replaced, moved to the front
  for (let i = 0; i < E.MAX + 20; i++) l = E.add(l, { q: `Question about ${String.fromCharCode(97 + i % 26)}${String.fromCharCode(97 + Math.floor(i / 26) % 26)}word topics`, a: 'a', how: 'exact' });
  assert.equal(l.length, E.MAX);
});
test('examples: similar questions find their example; unrelated or trivial ones find none', () => {
  const l = seed(), first = (q, subject) => (E.retrieve(q, l, { subject })[0] || {}).q || '';
  assert.match(first('A trader buys a bag for ₹640 and sells it at 20% profit. What is the selling price?', 'math'), /shopkeeper/);
  assert.match(first('Solve 3x − 4 = 11', 'math'), /2x \+ 5/);
  assert.equal(E.retrieve('Solve 3x − 4 = 11', l, { subject: 'math' }).length, 1); // not the circle too
  assert.match(first('What is the area of a circle with radius 14 cm?', 'math'), /circle/);
  assert.deepEqual(E.retrieve('Who wrote the national anthem?', l), []);
  assert.deepEqual(E.retrieve('What is 45 + 37?', l, { subject: 'math' }), []);
  assert.deepEqual(E.retrieve('Why do leaves of desert plants have spines?', l, { subject: 'math' }), []); // other subject
});
test('examples: the prompt says to work it out fresh and names how each was checked', () => {
  const b = E.promptBlock(E.retrieve('Solve 3x − 4 = 11', seed(), { subject: 'math' }));
  assert.match(b, /never copy their numbers or answer/); assert.match(b, /exact calculator/); assert.match(b, /2x \+ 5 = 17/);
  assert.equal(E.promptBlock([]), '');
});
test('examples: only bank questions a person reviewed are shipped', () => {
  const q = { id: 'science-c6-001', class: 6, subject: 'science', type: 'mcq', q: 'The ends of a bar magnet are called', options: ['Tips', 'Terminals', 'Edges', 'Poles'], answer: 'D', explanation: 'Magnetism is strongest at the poles.', reviewed: false };
  assert.equal(E.fromBank(q), null);
  const ex = E.fromBank(Object.assign({}, q, { reviewed: true }));
  assert.equal(ex.how, 'reviewed'); assert.match(ex.a, /^\(D\) Poles/); assert.match(ex.q, /\(D\) Poles/);
});
test('examples: matching works the same with one saved example as with many, and stays strict', () => {
  const one = E.add([], { q: 'A shopkeeper buys a fan for ₹800 and sells it at 15% profit. Find the selling price.', a: '₹920', subject: 'math', how: 'second' });
  assert.equal(E.retrieve('A trader buys a bag for ₹640 and sells it at 20% profit. What is the selling price?', one, { subject: 'math' }).length, 1);
  assert.deepEqual(E.retrieve('Find the area of a rectangle 7 cm by 5 cm.', seed(), { subject: 'math' }), []); // not the circle
  assert.match((E.retrieve('Why do cactus plants have spines?', seed(), { subject: 'science' })[0] || {}).q || '', /desert plants/);
});
