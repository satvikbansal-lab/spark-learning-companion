// Live maths benchmark: sends every case through Spark's real prompt, routing, tools and (for the current code)
// the independent answer re-check, then grades the reply with tests/maths-grade.js. Each result is appended to
// tests/results/maths-<LABEL>.jsonl as soon as it arrives, so a quota stop loses nothing; rerun to resume.
//
//   node tests/maths-eval.mjs                          # current code, all 151 cases + 8 tutoring scenarios
//   SUITE=tutor node tests/maths-eval.mjs              # tutoring scenarios only (bench | tutor | all)
//   ONLY=linear,lin-2 node tests/maths-eval.mjs        # categories and/or case ids
//   TRIALS=3 ONLY=pl-1 node tests/maths-eval.mjs       # repeat trials for nondeterminism
//   SPARK_AI=/path/old/spark-ai.js LABEL=baseline node tests/maths-eval.mjs   # measure an older version
//   GEMINI_API_KEY=... node tests/maths-eval.mjs       # straight to Google; otherwise via SPARK_URL's /api/gemini
//   node tests/maths-report.mjs LABEL [BASELINE_LABEL] # summary tables
import { createRequire } from 'node:module';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const AI = require(resolve(process.env.SPARK_AI || join(here, '..', 'spark-ai.js')));
const SparkMath = require('../spark-math.js');
const { grade, overlap } = require('./maths-grade.js');
const BENCH = require('./maths-cases.js'), TUTOR = require('./tutor-cases.js');

const SITE = (process.env.SPARK_URL || 'https://spark-learning-companion.vercel.app').replace(/\/$/, '');
const KEY = process.env.GEMINI_API_KEY || '';
const MODELS = (process.env.MODELS || 'gemini-3.5-flash-lite').split(',');
const GAP = Number(process.env.GAP_MS || 6000);
const LABEL = process.env.LABEL || 'current';
const TRIALS = Number(process.env.TRIALS || 1);
const GRADE = process.env.CLASS || 'Class 8';
const RECHECK = process.env.RECHECK !== 'off' && typeof AI.recheckInstruction === 'function';
const suite = process.env.SUITE || 'all';
const only = (process.env.ONLY || '').split(',').filter(Boolean);
// The app's real language rule (index.html langRule, auto mode).
const LANG = 'LANGUAGE: Reply in the language the student is using: English, Hindi (as Hinglish) or Punjabi (as Roman Punjabi). If they switch, switch with them. ALWAYS WRITE IN ENGLISH LETTERS ONLY. Never use Devanagari, Gurmukhi or any other script, even if the student does. Hindi is written as natural Hinglish, the way Indian kids text (e.g. "Imagine karo ki tum ek naye sheher mein ho"). Punjabi is written in Roman Punjabi (e.g. "Socho ki tusi ek nave sheher vich ho"). Use simple, everyday words, and keep school terms (like map, photosynthesis, fraction) in English.';

// Which tools the server's connection really has (OpenRouter has no code execution or search), so the prompt never promises them.
const INFO = KEY ? { tools: { code: true, search: true } } : await fetch(`${SITE}/api/gemini`).then(r => r.json()).catch(() => ({}));
const AVAIL = INFO.tools || {};
const out = join(here, 'results', `maths-${LABEL}.jsonl`);
mkdirSync(join(here, 'results'), { recursive: true });
const done = new Set(existsSync(out) && !process.env.FRESH ? readFileSync(out, 'utf8').split('\n').filter(Boolean).map(l => { const r = JSON.parse(l); return r.error ? null : `${r.id}#${r.trial}`; }).filter(Boolean) : []);

async function post(model, body) {
  const url = KEY ? `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse` : `${SITE}/api/gemini`;
  const headers = KEY ? { 'Content-Type': 'application/json', 'x-goog-api-key': KEY } : { 'Content-Type': 'application/json', Origin: SITE };
  return fetch(url, { method: 'POST', headers, body: JSON.stringify(KEY ? body : { model, stream: true, body }), signal: AbortSignal.timeout(150000) });
}
async function stream(model, body) {
  const t0 = Date.now(); const r = await post(model, body);
  if (!r.ok) return { status: r.status, error: (await r.text()).slice(0, 200).replace(/\s+/g, ' ') };
  const acc = AI.newReply(), dec = new TextDecoder(); let buf = '';
  for await (const chunk of r.body) { buf += dec.decode(chunk, { stream: true }); const o = AI.sseEvents(buf); buf = o.rest; for (const j of o.events) if (!j._malformed) AI.absorb(acc, j); }
  for (const j of AI.sseEvents(buf + '\n').events) if (!j._malformed) AI.absorb(acc, j);
  return { acc, ms: Date.now() - t0 };
}
const fixture = name => readFileSync(join(here, 'fixtures', name)).toString('base64');

/* One student turn, through the same steps as the app's send(): route → prompt → tools → stream → re-check. */
async function ask(c) {
  const prev = (c.history || []).filter(h => h[0] === 'model').pop();
  const rt = AI.route(c.q, { hasImage: !!c.image, prevSubject: c.history ? AI.route(c.history[0][1]).subject : undefined, prevModelText: prev && prev[1] });
  const contents = (c.history || []).map(([role, text]) => ({ role, parts: [{ text }] }));
  contents.push({ role: 'user', parts: [...(c.image ? [{ inlineData: { mimeType: 'image/png', data: fixture(c.image) } }] : []), { text: c.q }] });
  const want = AI.toolsFor(rt, { search: true }, AVAIL), tries = [];
  for (const model of MODELS) {
    for (const tools of [want, { code: want.code }, {}]) {
      const system = AI.systemPrompt({ buddy: 'Sparky', name: 'Riya', grade: GRADE, teach: c.teach || 'explain', langRule: LANG, notebook: 'Maths', route: rt, code: !!tools.code, search: !!tools.search });
      const body = AI.requestBody({ system, contents, tools, think: true, mathy: rt.subject === 'math' || rt.needsCode });
      let r; try { r = await stream(model, body); } catch (e) { tries.push(`${model}: ${e.name}`); break; }
      if (r.error) { tries.push(`${model}${tools.search ? '+search' : ''}${tools.code ? '+code' : ''}: ${r.status} ${r.error}`); if ((r.status === 429 && tools.search) || (r.status === 400 && (tools.search || tools.code))) continue; break; }
      let acc = r.acc, ms = r.ms, recheck = null;
      // The app's independent re-check: an exact solution that disagrees with the answer triggers one retry.
      if (RECHECK) {
        const v = SparkMath.check(c.q, acc.text);
        recheck = { first: v.status };
        if (v.status === 'disagree') {
          const r2 = await stream(model, AI.requestBody({ system: system + AI.recheckInstruction(v), contents, tools, think: true, mathy: true }));
          if (r2.acc) { recheck.firstAnswer = (SparkMath.answerOf(acc.text) || {}).line; acc = r2.acc; ms += r2.ms; recheck.second = SparkMath.check(c.q, acc.text).status; }
        }
      }
      return { model, tools, route: rt, text: acc.text, checks: AI.checkSummary(acc), sources: acc.sources, finish: acc.finish, ms, tries, recheck };
    }
  }
  return { error: tries.join(' | ') || 'no model available', route: rt };
}

let pool = [];
if (suite !== 'tutor') pool.push(...BENCH.map(c => Object.assign({ suite: 'bench' }, c)));
if (suite !== 'bench') pool.push(...TUTOR.map(c => Object.assign({ suite: 'tutor', cat: 'tutoring' }, c)));
if (only.length) pool = pool.filter(c => only.includes(c.id) || only.includes(c.cat));
console.log(`Spark maths eval [${LABEL}] · ${pool.length} cases × ${TRIALS} · ${KEY ? 'direct Gemini API' : SITE}${INFO.provider ? ' (' + INFO.provider + (INFO.model ? ' ' + INFO.model : '') + ')' : ''} · ${MODELS.join(', ')} · ${GRADE} · re-check ${RECHECK ? 'on' : 'off'}`);
let n = 0, quotaStops = 0;
for (const c of pool) {
  for (let trial = 1; trial <= TRIALS; trial++) {
    if (done.has(`${c.id}#${trial}`)) continue;
    if (n++) await new Promise(r => setTimeout(r, GAP));
    const o = await ask(c);
    let row;
    if (o.error) {
      row = { id: c.id, cat: c.cat, suite: c.suite, trial, label: LABEL, error: o.error, route: o.route && { subject: o.route.subject, kind: o.route.kind } };
      quotaStops = /429/.test(o.error) ? quotaStops + 1 : 0;
    } else {
      quotaStops = 0;
      const g = grade(c, o);
      row = { id: c.id, cat: c.cat, suite: c.suite, trial, label: LABEL, q: c.q, status: g.status, fails: g.fails, flags: g.flags, rubric: g.rubric, overlap: g.overlap, verifier: g.verifier, recheck: o.recheck, model: o.model, tools: o.tools, route: { subject: o.route.subject, kind: o.route.kind, needsCode: o.route.needsCode }, checks: o.checks, finish: o.finish, ms: o.ms, text: o.text };
    }
    appendFileSync(out, JSON.stringify(row) + '\n');
    const tag = row.error ? '!' : row.status === 'PASS' ? '✔' : '✘';
    console.log(`${tag} ${c.id.padEnd(10)}${TRIALS > 1 ? '#' + trial : ''} ${row.error ? 'ERROR ' + row.error.slice(0, 140) : `${row.status} ${(row.ms / 1000).toFixed(1)}s rubric ${row.rubric.total}/20${row.checks ? ` code ${row.checks.ok}/${row.checks.ran}` : ''}${row.recheck && row.recheck.first === 'disagree' ? ` recheck ${row.recheck.first}→${row.recheck.second}` : ''} ${row.fails.map(f => f.mode + ': ' + f.why).join(' | ').slice(0, 220)}`}`);
    if (quotaStops >= 4) { console.log('Stopping: the API keeps answering 429 (quota). Rerun later to resume where this stopped.'); process.exit(2); }
  }
}
console.log(`Done → ${out}`);
