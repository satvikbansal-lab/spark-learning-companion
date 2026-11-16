// Tappable key words: the model writes [[word|easy meaning]]; md() makes it tappable, stripTerms() makes it plain.
const test = require('node:test');
const assert = require('node:assert');
const A = require('../spark-ai.js');

test('a tag becomes a tappable word with its meaning', () => {
  const h = A.md('Four friends set up an [[entity|a group with its own name that can own things]] and share the [[profits|money left after paying costs]].');
  assert.match(h, /<span class="kt" role="button" tabindex="0" data-def="a group with its own name that can own things">entity<\/span>/);
  assert.match(h, /data-def="money left after paying costs">profits<\/span>/);
  assert.doesNotMatch(h, /\[\[|\]\]/);
});
test('tags inside table cells do not break the table', () => {
  const h = A.md('| term | note |\n|---|---|\n| [[cost|what you pay]] | x |');
  assert.match(h, /<td><span class="kt"[^>]*>cost<\/span><\/td><td>x<\/td>/);
});
test('a half-streamed tag shows only its word', () => {
  assert.doesNotMatch(A.md('Streaming an [[entit'), /\[\[/);
  assert.match(A.md('an [[entity|a group with'), /an entity/);
});
test('meanings are escaped', () => {
  assert.match(A.md('[[x|a "quote" <b>]]'), /data-def="a &quot;quote&quot; &lt;b&gt;"/);
});
test('stripTerms leaves the plain word for speech and prompts', () => {
  assert.strictEqual(A.stripTerms('the [[profits|money left]] and [[entity]]'), 'the profits and entity');
});
test('the prompt asks for tags in text replies, not voice calls', () => {
  assert.match(A.systemPrompt({ grade: '7' }), /TAPPABLE KEY WORDS/);
  assert.doesNotMatch(A.systemPrompt({ grade: '7', voice: true }), /TAPPABLE KEY WORDS/);
});
