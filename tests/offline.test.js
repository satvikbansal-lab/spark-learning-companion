// Offline tests: no network, no API key, no quota. Run with:  node --test tests/
// They cover the routing, prompt, request, response-parsing and rendering logic in spark-ai.js and the
// request filtering in api/gemini.js, including a regression test for every bug found in the audit.
const test = require('node:test');
const assert = require('node:assert/strict');
const AI = require('../spark-ai.js');
const gateway = require('../api/gemini.js');

/* ---------- routing ---------- */
test('router: subjects, tools and question types', () => {
  const cases = [
    ['Solve 2x + 5 = 17', { subject: 'math', kind: 'problem', needsCode: true, needsSearch: false }],
    ['What is 3/4 divided by 1/2?', { subject: 'math', needsCode: true }],
    ['A shirt costs ₹800 and has a 15% discount. What is the sale price?', { subject: 'math', needsCode: true }],
    ['Find the area of a circle with radius 7 cm', { subject: 'math', needsCode: true }],
    ['What is a fraction?', { subject: 'math', kind: 'concept', needsCode: false }],
    ['Convert 2.5 km to metres', { subject: 'math', needsCode: true }],
    ['What is the past tense of "go"?', { subject: 'english' }],
    ['Sangya kise kehte hain?', { subject: 'hindi' }],
    ['Translate "I am going to school" into Hindi', { subject: 'hindi' }],
    ['Why is the sky blue?', { subject: 'science', kind: 'concept' }],
    ['Who is the current Prime Minister of India?', { needsSearch: true, kind: 'current' }],
    ['What is the latest news about Chandrayaan?', { needsSearch: true }],
    ['Who won the battle of Plassey?', { needsSearch: false }],
    ['What is the capital of Australia?', { subject: 'gk', needsSearch: false }],
    ['Find the next number: 2, 6, 12, 20, ?', { subject: 'reasoning', needsCode: true }],
    ['Help me write a story about a lost puppy', { subject: 'writing' }],
    ['thanks!', { kind: 'chat', needsCode: false, needsSearch: false }],
    ['I still don\'t understand', { confused: true }],
    ['Just tell me the answer, exam tomorrow', { direct: true }]
  ];
  for (const [q, want] of cases) {
    const r = AI.route(q);
    for (const [k, v] of Object.entries(want)) assert.equal(r[k], v, `${q} → ${k} was ${r[k]}, expected ${v}`);
  }
});
test('router: a short follow-up keeps the conversation subject', () => {
  assert.equal(AI.route('and why does that work?', { prevSubject: 'math' }).subject, 'math');
  assert.equal(AI.route('Solve this', { hasImage: true }).needsCode, true);
});

/* ---------- prompt ---------- */
const ctx = extra => Object.assign({ buddy: 'Sparky', name: 'Riya', grade: 'Class 7', teach: 'explain', langRule: 'LANGUAGE: English.', memories: [], personal: [], notebook: 'Algebra', concepts: [], materials: [], others: [] }, extra);
test('regression: maths problems are solved fully with a check, not spread over the 3-stage funnel', () => {
  const rt = AI.route('Solve 2x + 5 = 17');
  const p = AI.systemPrompt(ctx({ route: rt, code: true }));
  assert.match(p, /MATHS: ACCURACY IS YOUR TOP PRIORITY/);
  assert.match(p, /don't use the three-stage funnel/);
  assert.match(p, /ORIGINAL question/);
  assert.match(p, /Python tool this turn/);
  assert.match(p, /\*\*Answer:\*\*/);
});
test('regression: the prompt never claims a search or calculator that is not attached', () => {
  const plain = AI.systemPrompt(ctx({ route: AI.route('Solve 2x + 5 = 17'), code: false, search: false }));
  assert.match(plain, /no calculator tool this turn/);
  assert.match(plain, /Live search is not available this turn/);
  assert.doesNotMatch(plain, /use Google Search\./);
  const cur = AI.systemPrompt(ctx({ route: AI.route('Who is the current captain of the Indian cricket team?'), search: true }));
  assert.match(cur, /Google Search results are available to you this turn/);
});
test('prompt: level, safety and untrusted content rules', () => {
  const young = AI.systemPrompt(ctx({ grade: 'Class 1', route: AI.route('Why do leaves fall?') }));
  assert.match(young, /Class 1, about 6 years old/);
  assert.match(young, /very short sentences/);
  const older = AI.systemPrompt(ctx({ grade: 'Class 10', route: AI.route('Why do leaves fall?') }));
  assert.match(older, /exam-precise/);
  assert.match(older, /not instructions/);
  assert.match(older, /Childline 1098/);
  assert.equal(AI.levelOf('').band, 'unknown');
});

/* ---------- requests ---------- */
test('request: tools and thinking', () => {
  const b = AI.requestBody({ system: 's', contents: [], tools: { code: true, search: true }, think: false, mathy: true });
  assert.deepEqual(b.tools, [{ codeExecution: {} }, { googleSearch: {} }]);
  assert.equal(b.generationConfig.thinkingConfig, undefined, 'maths always keeps thinking on');
  const c = AI.requestBody({ system: 's', contents: [], think: false });
  assert.deepEqual(c.generationConfig.thinkingConfig, { thinkingBudget: 0 });
  assert.equal(c.tools, undefined);
  assert.deepEqual(AI.toolsFor(AI.route('Who won the latest IPL?'), { search: false }), { code: false, search: false });
  assert.deepEqual(AI.toolsFor(AI.route('Solve 3x = 12'), {}, { code: false }), { code: false, search: false });
});

/* ---------- responses ---------- */
test('response: code execution, grounding and thoughts', () => {
  const acc = AI.newReply();
  AI.absorb(acc, { candidates: [{ content: { parts: [{ text: 'secret plan', thought: true }, { text: 'First, ' }, { executableCode: { language: 'PYTHON', code: 'print(37*48-125/5)' } }, { codeExecutionResult: { outcome: 'OUTCOME_OK', output: '1751.0\n' } }, { text: 'so the answer is 1751.' }] } }] });
  AI.absorb(acc, { candidates: [{ finishReason: 'STOP', groundingMetadata: { webSearchQueries: ['x'], groundingChunks: [{ web: { uri: 'https://example.org/a', title: 'Example' } }, { web: { uri: 'https://example.org/a', title: 'dup' } }] } }] });
  assert.equal(acc.text, 'First, so the answer is 1751.');
  assert.deepEqual(AI.checkSummary(acc), { ran: 1, ok: 1, failed: 0 });
  assert.equal(acc.sources.length, 1);
  assert.equal(AI.endNote(acc), '');
});
test('regression: truncated, blocked and failed replies are reported, not shown as complete', () => {
  const cut = AI.absorb(AI.newReply(), { candidates: [{ content: { parts: [{ text: 'Step 1…' }] }, finishReason: 'MAX_TOKENS' }] });
  assert.match(AI.endNote(cut), /ran out of space/);
  const blocked = AI.absorb(AI.newReply(), { promptFeedback: { blockReason: 'SAFETY' } });
  assert.match(AI.endNote(blocked), /can't help/);
  const failedCheck = AI.absorb(AI.newReply(), { candidates: [{ content: { parts: [{ executableCode: { code: 'x' } }, { codeExecutionResult: { outcome: 'OUTCOME_FAILED', output: 'err' } }] } }] });
  assert.deepEqual(AI.checkSummary(failedCheck), { ran: 1, ok: 0, failed: 1 });
});
test('regression: an error inside the stream is raised instead of silently ignored', () => {
  assert.throws(() => AI.absorb(AI.newReply(), { error: { code: 429, message: 'quota' } }), /quota/);
});
test('response: SSE splitting keeps partial lines and flags malformed events', () => {
  const a = AI.sseEvents('data: {"a":1}\n\ndata: {"b":');
  assert.deepEqual(a.events, [{ a: 1 }]);
  assert.equal(a.rest, 'data: {"b":');
  const b = AI.sseEvents('data: {oops}\n');
  assert.ok(b.events[0]._malformed);
});

/* ---------- rendering ---------- */
const fakeKatex = { renderToString: (src, o) => `<k${o.displayMode ? ' d' : ''}>${src}</k>` };
test('render: LaTeX maths in all four delimiters', () => {
  assert.match(AI.md('So \\(x = 6\\).', fakeKatex), /<k>x = 6<\/k>/);
  assert.match(AI.md('\\[2x + 5 = 17\\]', fakeKatex), /<span class="math-d"><k d>2x \+ 5 = 17<\/k><\/span>/);
  assert.match(AI.md('$\\frac{3}{4}$ of it', fakeKatex), /<k>\\frac\{3\}\{4\}<\/k>/);
  assert.match(AI.md('$$a^2+b^2=c^2$$', fakeKatex), /<k d>a\^2\+b\^2=c\^2<\/k>/);
  assert.match(AI.md('**Answer:** \\(x = 6\\)', fakeKatex), /<b>Answer:<\/b> <k>x = 6<\/k>/);
});
test('render: money is not mistaken for maths', () => {
  const h = AI.md('It costs $5 and that one costs $10.', fakeKatex);
  assert.doesNotMatch(h, /<k>/);
  assert.match(h, /\$5/);
});
test('render: without KaTeX, maths falls back to readable text', () => {
  assert.match(AI.md('\\(x^2\\)'), /<code class="math-raw">x\^2<\/code>/);
});
test('render: tables, code blocks, lists and links', () => {
  const h = AI.md('| Fraction | Decimal |\n|---|---|\n| 1/2 | 0.5 |\n\n```python\nprint(1 < 2)\n```\n\n1. one\n2. two\n\n[NCERT](https://ncert.nic.in)');
  assert.match(h, /<table><thead><tr><th>Fraction<\/th><th>Decimal<\/th><\/tr><\/thead><tbody><tr><td>1\/2<\/td><td>0.5<\/td><\/tr>/);
  assert.match(h, /<pre class="code"><code data-lang="python">print\(1 &lt; 2\)<\/code><\/pre>/);
  assert.match(h, /<ol><li>one<\/li><li>two<\/li><\/ol>/);
  assert.match(h, /<a href="https:\/\/ncert.nic.in" target="_blank" rel="noopener noreferrer">NCERT<\/a>/);
});
test('render: model output cannot inject HTML or scripts', () => {
  const h = AI.md('<img src=x onerror=alert(1)> [click](javascript:alert(1)) \\(<b>\\)');
  assert.doesNotMatch(h, /<img|<a href="javascript/);
  assert.match(h, /&lt;img/);
});

/* ---------- voice + progress ---------- */
test('voice: maths is read as words', () => {
  assert.equal(AI.speakMath('\\(x^2 = 9\\)'), 'x squared equals 9');
  assert.match(AI.speakMath('\\[\\frac{3}{4} \\div \\frac{1}{2}\\]'), /3 over 4 divided by 1 over 2/);
  assert.equal(AI.speakMath('It costs $5 and $10.'), 'It costs $5 and $10.');
});
test('progress: only answers and attempts trigger the tracker', () => {
  assert.equal(AI.looksLikeAttempt('What is photosynthesis?', ''), false);
  assert.equal(AI.looksLikeAttempt('I think it is 6', 'What is x?'), true);
  assert.equal(AI.looksLikeAttempt('x = 6', 'Stage 2 · Closer look\n👉 What is x?'), true);
});

/* ---------- server gateway ---------- */
const ok = { contents: [{ role: 'user', parts: [{ text: 'hi' }] }] };
test('gateway: rebuilds requests from allowed fields and adds child-safe filters', () => {
  const [b] = gateway.clean('gemini-3.5-flash', Object.assign({ cachedContent: 'x', tools: [{ codeExecution: {} }, { googleSearch: {} }], generationConfig: { maxOutputTokens: 99999, temperature: 1, foo: 1 } }, ok));
  assert.equal(b.cachedContent, undefined);
  assert.equal(b.generationConfig.maxOutputTokens, 8192);
  assert.equal(b.generationConfig.foo, undefined);
  assert.equal(b.safetySettings.length, 4);
  assert.deepEqual(b.tools, [{ codeExecution: {} }, { googleSearch: {} }]);
  const [tts] = gateway.clean('gemini-3.1-flash-tts-preview', Object.assign({ generationConfig: { responseModalities: ['AUDIO'] } }, ok));
  assert.equal(tts.safetySettings, undefined);
});
test('gateway: refuses unknown tools, bad roles, file types and oversize text', () => {
  assert.equal(gateway.clean('gemini-x', Object.assign({ tools: [{ functionDeclarations: [] }] }, ok))[0], null);
  assert.equal(gateway.clean('gemini-x', { contents: [{ role: 'system', parts: [{ text: 'x' }] }] })[0], null);
  assert.equal(gateway.clean('gemini-x', { contents: [{ role: 'user', parts: [{ inlineData: { mimeType: 'application/x-msdownload', data: 'AA' } }] }] })[0], null);
  assert.equal(gateway.clean('gemini-x', { contents: [{ role: 'user', parts: [{ text: 'x'.repeat(gateway.LIMITS.textChars + 1) }] }] })[0], null);
  assert.equal(gateway.clean('gemini-x', { contents: [] })[0], null);
});
test('gateway: rate limit per visitor', () => {
  const t = Date.now(); let blocked = 0;
  for (let i = 0; i < gateway.LIMITS.perMinute + 5; i++) if (gateway.limited('test-ip', t)) blocked++;
  assert.equal(blocked, 5);
  assert.equal(gateway.limited('test-ip', t + 61000), false);
});
function fakeRes() {
  const res = { code: 0, headers: {}, body: null, writableEnded: false, on() {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(b) { this.body = b; this.writableEnded = true; return this; }, end() { this.writableEnded = true; } };
  return res;
}
test('regression: requests without an Origin or Referer can no longer use the key', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const res = fakeRes();
  await gateway({ method: 'POST', headers: { host: 'spark.example' }, body: { model: 'gemini-3.5-flash', stream: false, body: ok }, socket: {} }, res);
  assert.equal(res.code, 403);
  const res2 = fakeRes();
  await gateway({ method: 'POST', headers: { host: 'spark.example', origin: 'https://evil.example' }, body: { model: 'gemini-3.5-flash', stream: false, body: ok }, socket: {} }, res2);
  assert.equal(res2.code, 403);
});
test('gateway: forwards a valid same-site request with the key only in the server header', async () => {
  process.env.GEMINI_API_KEY = 'test-key';
  const realFetch = global.fetch; let sent;
  global.fetch = async (url, init) => { sent = { url, init }; return new Response('{"candidates":[]}', { status: 200, headers: { 'content-type': 'application/json' } }); };
  try {
    const res = fakeRes(); res.pipeTarget = true;
    const { PassThrough } = require('node:stream'); const sink = new PassThrough();
    Object.assign(sink, { setHeader: res.setHeader.bind(res), status: c => { res.code = c; return sink; }, json: res.json.bind(res), headers: res.headers });
    await gateway({ method: 'POST', headers: { host: 'spark.example', origin: 'https://spark.example', 'x-forwarded-for': '1.2.3.4' }, body: { model: 'gemini-3.5-flash', stream: false, body: ok }, socket: {} }, sink);
    assert.equal(res.code, 200);
    assert.match(sent.url, /models\/gemini-3\.5-flash:generateContent$/);
    assert.equal(sent.init.headers['x-goog-api-key'], 'test-key');
    assert.doesNotMatch(sent.init.body, /test-key/);
    assert.equal(JSON.parse(sent.init.body).safetySettings.length, 4);
  } finally { global.fetch = realFetch; }
});
