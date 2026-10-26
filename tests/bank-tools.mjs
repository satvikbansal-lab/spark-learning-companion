// Tools for the AI-drafted question banks (science, social science, English, Hindi; Classes 1-12) in tests/bank/.
// Nothing here is trusted as fact: every question is AI-drafted, marked "unverified" and "reviewed: false" until a
// person reviews it, and topics are the drafting model's reading of the NCERT/CBSE syllabus, not checked against it.
//
//   node tests/bank-tools.mjs assemble science 6     # tests/bank/_parts/science-c6-p*.json → tests/bank/science/class-6.json
//   node tests/bank-tools.mjs blind science 6        # what the second model sees: MCQs without their keys
//   node tests/bank-tools.mjs merge science 6        # adds the second model's answers (…/_checks/science-c6.json)
//   node tests/bank-tools.mjs status                 # counts, levels, cross-check agreement for every set
//   node tests/bank-tools.mjs sample 40              # a review sheet: disagreements first, then a spread sample
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, 'bank');
export const SUBJECTS = { science: 'Science (EVS in Classes 1-5)', social: 'Social Science (EVS in Classes 1-5)', english: 'English', hindi: 'Hindi' };
const fileOf = (s, k) => join(root, s, `class-${k}.json`);
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const LETTERS = ['A', 'B', 'C', 'D'];

/* Problems with one question, or [] when it's well formed. */
export function problems(q, subject, topics) {
  const out = [], s = v => typeof v === 'string' && v.trim().length > 0;
  if (!s(q.q) || q.q.length > 600) out.push('question text');
  if (![1, 2, 3].includes(q.level)) out.push('level');
  if (!s(q.topic) || (topics && !topics.includes(q.topic))) out.push(`topic "${q.topic}"`);
  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(s)) out.push('needs 4 options');
    else if (new Set(q.options.map(o => o.trim().toLowerCase())).size !== 4) out.push('options repeat');
    if (!LETTERS.includes(q.answer)) out.push('answer must be A-D');
  } else if (q.type === 'short') {
    if (!s(q.answer) || q.answer.length > 500) out.push('answer text');
    if (!Array.isArray(q.keyPoints) || !q.keyPoints.length || q.keyPoints.length > 6 || !q.keyPoints.every(s)) out.push('1-6 key points');
  } else out.push('type must be mcq or short');
  if (!s(q.explanation) || q.explanation.length > 700) out.push('explanation');
  if (subject === 'hindi' && !/[ऀ-ॿ]/.test(q.q)) out.push('Hindi question without Devanagari');
  return out;
}

function assemble(subject, klass) {
  const parts = readdirSync(join(root, '_parts')).filter(f => f.startsWith(`${subject}-c${klass}-p`) && f.endsWith('.json')).sort((a, b) => Number(a.match(/p(\d+)/)[1]) - Number(b.match(/p(\d+)/)[1]));
  if (!parts.length) throw new Error(`no parts for ${subject} class ${klass}`);
  let meta = null; const qs = [], seen = new Set(), rejected = [];
  for (const f of parts) {
    const j = read(join(root, '_parts', f));
    if (!meta && j.topics) meta = j;
    for (const q of j.questions || []) {
      const key = String(q.q || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const why = problems(q, subject, meta && meta.topics);
      if (seen.has(key)) why.push('duplicate');
      if (why.length) { rejected.push({ q: String(q.q || '').slice(0, 80), why }); continue; }
      seen.add(key);
      qs.push(q);
    }
  }
  if (!meta) throw new Error('the first part needs "topics"');
  const questions = qs.slice(0, 500).map((q, i) => ({
    id: `${subject}-c${klass}-${String(i + 1).padStart(3, '0')}`, board: 'CBSE', class: Number(klass), subject, topic: q.topic, level: q.level, type: q.type, q: q.q.trim(),
    ...(q.type === 'mcq' ? { options: q.options.map(o => o.trim()), answer: q.answer } : { answer: q.answer.trim(), keyPoints: q.keyPoints }),
    explanation: q.explanation.trim(), source: 'ai-drafted', status: 'unverified', reviewed: false
  }));
  mkdirSync(join(root, subject), { recursive: true });
  const out = { board: 'CBSE', class: Number(klass), subject, title: SUBJECTS[subject], topics: meta.topics, syllabus: 'unverified: topics are the drafting model’s reading of the NCERT/CBSE syllabus and have not been checked against the official documents', drafted_by: meta.model || 'claude', drafted_at: new Date().toISOString().slice(0, 10), crossCheck: null, questions };
  writeFileSync(fileOf(subject, klass), JSON.stringify(out, null, 1) + '\n');
  console.log(`${subject} class ${klass}: ${questions.length} questions kept, ${rejected.length} rejected → ${fileOf(subject, klass)}`);
  for (const r of rejected.slice(0, 10)) console.log('  rejected:', r.why.join(', '), '|', r.q);
}

function blind(subject, klass) {
  const b = read(fileOf(subject, klass));
  const items = b.questions.map(q => (q.type === 'mcq' ? { id: q.id, type: 'mcq', q: q.q, options: q.options } : { id: q.id, type: 'short', q: q.q, proposedAnswer: q.answer, keyPoints: q.keyPoints }));
  mkdirSync(join(root, '_blind'), { recursive: true });
  const p = join(root, '_blind', `${subject}-c${klass}.json`);
  writeFileSync(p, JSON.stringify({ class: b.class, subject, items }, null, 1) + '\n');
  console.log(p, items.length);
}

function merge(subject, klass) {
  const b = read(fileOf(subject, klass)), p = join(root, '_checks', `${subject}-c${klass}.json`);
  const checks = new Map(read(p).answers.map(a => [a.id, a]));
  const tally = { agree: 0, disagree: 0, unsure: 0, missing: 0 };
  for (const q of b.questions) {
    const a = checks.get(q.id);
    let result = 'missing';
    if (a && q.type === 'mcq') result = !LETTERS.includes(a.answer) || a.unsure ? 'unsure' : a.answer === q.answer ? 'agree' : 'disagree';
    else if (a) result = a.verdict === 'correct' ? 'agree' : a.verdict === 'incorrect' ? 'disagree' : 'unsure';
    tally[result]++;
    q.crossCheck = Object.assign({ result }, a && a.answer ? { checkerAnswer: a.answer } : {}, a && a.note ? { note: String(a.note).slice(0, 300) } : {});
    q.status = 'unverified'; // a second model agreeing is evidence, not verification
  }
  b.crossCheck = Object.assign({ model: read(p).model || 'claude-haiku', method: 'MCQs answered blind (no key shown); short answers judged against their proposed answer' }, tally);
  writeFileSync(fileOf(subject, klass), JSON.stringify(b, null, 1) + '\n');
  console.log(`${subject} class ${klass}:`, tally);
}

function status() {
  let total = 0;
  for (const s of Object.keys(SUBJECTS)) for (let k = 1; k <= 12; k++) {
    if (!existsSync(fileOf(s, k))) continue;
    const b = read(fileOf(s, k)), n = b.questions.length; total += n;
    const lv = [1, 2, 3].map(l => b.questions.filter(q => q.level === l).length).join('/'), mcq = b.questions.filter(q => q.type === 'mcq').length;
    console.log(`${s.padEnd(8)} class ${String(k).padStart(2)}: ${String(n).padStart(3)} questions (${mcq} MCQ), levels ${lv}, ${b.topics.length} topics, cross-check ${b.crossCheck ? `${b.crossCheck.agree} agree / ${b.crossCheck.disagree} disagree / ${b.crossCheck.unsure} unsure` : 'not run'}`);
  }
  console.log('total', total);
}

function sample(n = 40) {
  const all = [];
  for (const s of Object.keys(SUBJECTS)) for (let k = 1; k <= 12; k++) if (existsSync(fileOf(s, k))) all.push(...read(fileOf(s, k)).questions);
  const dis = all.filter(q => q.crossCheck && q.crossCheck.result !== 'agree');
  const rest = all.filter(q => !dis.includes(q)), step = Math.max(1, Math.floor(rest.length / n));
  const pick = [...dis, ...rest.filter((_, i) => i % step === 0).slice(0, n)];
  writeFileSync(join(root, 'review-sample.json'), JSON.stringify(pick, null, 1) + '\n');
  console.log(`${dis.length} flagged by the cross-check + ${Math.min(n, rest.length)} spread sample → tests/bank/review-sample.json`);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'assemble') assemble(a, b);
else if (cmd === 'blind') blind(a, b);
else if (cmd === 'merge') merge(a, b);
else if (cmd === 'status') status();
else if (cmd === 'sample') sample(Number(a) || 40);
else if (cmd) { console.error('unknown command ' + cmd); process.exit(1); }
