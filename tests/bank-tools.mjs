// Tools for the AI-drafted question banks (science, social science, English, Hindi; Classes 1-12) in tests/bank/.
// Nothing here is trusted as fact: every question is AI-drafted, marked "unverified" and "reviewed: false" until a
// person reviews it, and topics are the drafting model's reading of the NCERT/CBSE syllabus, not checked against it.
//
//   node tests/bank-tools.mjs assemble science 6     # tests/bank/_parts/science-c6-p*.json → tests/bank/science/class-6.json
//   node tests/bank-tools.mjs blind science 6        # what the second model sees: MCQs without their keys
//   node tests/bank-tools.mjs merge science 6        # adds the second model's answers (…/_checks/science-c6.json)
//   node tests/bank-tools.mjs status                 # counts, levels, cross-check agreement for every set
//   node tests/bank-tools.mjs sample 60              # review page: flagged first, then short answers, then MCQs → tests/bank/review.html
//   node tests/bank-tools.mjs apply-review spark-review.json  # the reviewer's decisions: reviewed or rejected
//   node tests/bank-tools.mjs export-reviewed        # questions a person marked reviewed → examples/reviewed.json (shipped)
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = join(here, 'bank');
export const SUBJECTS = {
  science: 'Science (EVS in Classes 1-5)', social: 'Social Science (EVS in Classes 1-5)', english: 'English', hindi: 'Hindi',
  computer: 'Computer Science and AI literacy',
  physics: 'Physics', chemistry: 'Chemistry', biology: 'Biology', // Classes 11-12
  accountancy: 'Accountancy', business: 'Business Studies', economics: 'Economics', history: 'History', geography: 'Geography', polsci: 'Political Science', psychology: 'Psychology', sociology: 'Sociology', // Class 11-12 electives
  'jee-main': 'JEE Main practice (original, exam-style)', 'jee-adv': 'JEE Advanced practice (original, exam-style)', neet: 'NEET (UG) practice (original, exam-style)', cat: 'CAT practice (original, exam-style)', upsc: 'UPSC Prelims GS practice (original, exam-style)'
};
// Exam practice sets have no class: they are stored as "class 0" in tests/bank/<exam>/exam.json.
export const EXAMS = new Set(['jee-main', 'jee-adv', 'neet', 'cat', 'upsc']);
const CLASSES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const fileOf = (s, k) => join(root, s, Number(k) === 0 ? 'exam.json' : `class-${k}.json`);
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
    else if (new Set(q.options.map(o => o.trim())).size !== 4) out.push('options repeat'); // case matters: Tt and tt are different genotypes
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
      const key = (String(q.q || '') + ' | ' + (q.options || []).join(' | ')).trim().toLowerCase().replace(/\s+/g, ' '); // same stem, different options = a different question
      const why = problems(q, subject, meta && meta.topics);
      if (seen.has(key)) why.push('duplicate');
      if (why.length) { rejected.push({ q: String(q.q || '').slice(0, 80), why }); continue; }
      seen.add(key);
      qs.push(q);
    }
  }
  if (!meta) throw new Error('the first part needs "topics"');
  const questions = qs.slice(0, 500).map((q, i) => ({
    id: `${subject}-${Number(klass) ? 'c' + klass : 'exam'}-${String(i + 1).padStart(3, '0')}`, board: EXAMS.has(subject) ? SUBJECTS[subject] : 'CBSE', class: Number(klass), subject, topic: q.topic, level: q.level, type: q.type, q: q.q.trim(),
    ...(q.type === 'mcq' ? { options: q.options.map(o => o.trim()), answer: q.answer } : { answer: q.answer.trim(), keyPoints: q.keyPoints }),
    explanation: q.explanation.trim(), source: 'ai-drafted', status: 'unverified', reviewed: false
  }));
  mkdirSync(join(root, subject), { recursive: true });
  const out = { board: EXAMS.has(subject) ? SUBJECTS[subject] : 'CBSE', class: Number(klass), subject, title: SUBJECTS[subject], topics: meta.topics, syllabus: 'unverified: topics are the drafting model\u2019s reading of the official syllabus (NCERT/CBSE, or the exam\u2019s notified syllabus) and have not been checked against the official documents', drafted_by: meta.model || 'claude', drafted_at: new Date().toISOString().slice(0, 10), crossCheck: null, questions };
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
  for (const s of Object.keys(SUBJECTS)) for (const k of CLASSES) {
    if (!existsSync(fileOf(s, k))) continue;
    const b = read(fileOf(s, k)), n = b.questions.length; total += n;
    const lv = [1, 2, 3].map(l => b.questions.filter(q => q.level === l).length).join('/'), mcq = b.questions.filter(q => q.type === 'mcq').length;
    console.log(`${s.padEnd(11)} ${k ? 'class ' + String(k).padStart(2) : 'exam    '}: ${String(n).padStart(3)} questions (${mcq} MCQ), levels ${lv}, ${b.topics.length} topics, cross-check ${b.crossCheck ? `${b.crossCheck.agree} agree / ${b.crossCheck.disagree} disagree / ${b.crossCheck.unsure} unsure` : 'not run'}`);
  }
  console.log('total', total);
}

/* A review sheet for a person: everything the cross-check flagged, then short written answers (where real mistakes
   have turned up), then a spread of MCQs across every set; questions already reviewed are left out. Writes
   tests/bank/review-sample.json and tests/bank/review.html (open it in a browser; no server needed). */
function sample(n = 60) {
  const all = [];
  for (const s of Object.keys(SUBJECTS)) for (const k of CLASSES) if (existsSync(fileOf(s, k))) all.push(...read(fileOf(s, k)).questions);
  const open = all.filter(q => !q.reviewed && q.status !== 'rejected');
  const flagged = open.filter(q => q.crossCheck && q.crossCheck.result !== 'agree');
  const spread = (list, m) => { const step = Math.max(1, Math.floor(list.length / Math.max(1, m))); return list.filter((_, i) => i % step === 0).slice(0, m); };
  const shorts = spread(open.filter(q => q.type === 'short' && !flagged.includes(q)), Math.ceil(n / 2));
  const mcqs = spread(open.filter(q => q.type === 'mcq' && !flagged.includes(q)), Math.floor(n / 2));
  const pick = [...flagged, ...shorts, ...mcqs];
  writeFileSync(join(root, 'review-sample.json'), JSON.stringify(pick, null, 1) + '\n');
  const html = readFileSync(join(root, 'review-template.html'), 'utf8').replace('/*DATA*/[]', JSON.stringify(pick).replace(/</g, '\\u003c'));
  writeFileSync(join(root, 'review.html'), html);
  console.log(`${pick.length} questions to review (${flagged.length} flagged, ${shorts.length} short answers, ${mcqs.length} MCQs) → tests/bank/review.html`);
}
/* Applies a review file downloaded from review.html: "ok" → reviewed (can ship as an example), "wrong" → rejected
   with the reviewer's note (never shipped; fix or replace it). */
function applyReview(file) {
  const dec = new Map(read(file).decisions.map(d => [d.id, d]));
  const tally = { ok: 0, wrong: 0 };
  for (const s of Object.keys(SUBJECTS)) for (const k of CLASSES) {
    if (!existsSync(fileOf(s, k))) continue;
    const b = read(fileOf(s, k)); let changed = false;
    for (const q of b.questions) {
      const d = dec.get(q.id); if (!d) continue;
      if (d.verdict === 'ok') { q.reviewed = true; q.status = 'reviewed'; tally.ok++; }
      else if (d.verdict === 'wrong') { q.reviewed = false; q.status = 'rejected'; tally.wrong++; }
      if (d.note) q.reviewNote = String(d.note).slice(0, 500);
      changed = true;
    }
    if (changed) writeFileSync(fileOf(s, k), JSON.stringify(b, null, 1) + '\n');
  }
  console.log(`${tally.ok} marked reviewed, ${tally.wrong} rejected. Run export-reviewed to ship the reviewed ones as examples.`);
}

/* Only questions with "reviewed": true (set by a person after checking) become shipped examples. */
async function exportReviewed() {
  const E = (await import('../spark-examples.js')).default;
  const out = [];
  for (const s of Object.keys(SUBJECTS)) for (const k of CLASSES) if (existsSync(fileOf(s, k))) for (const q of read(fileOf(s, k)).questions) { const ex = E.fromBank(q); if (ex) out.push(ex); }
  writeFileSync(join(here, '..', 'examples', 'reviewed.json'), JSON.stringify(out) + '\n');
  console.log(`${out.length} reviewed questions → examples/reviewed.json`);
}
/* Evens out which letter is correct by swapping the correct option into a rotation of A-D, only where no option
   refers to the others ("both", "none of the above") and the explanation names no letter, so meaning can't change. */
function rebalance(subject, klass) {
  const p = fileOf(subject, klass), b = read(p);
  const safe = q => !q.options.some(o => /\b(both|either|neither|all of|none of|above|below)\b/i.test(o)) && !/\b(option\s*)?\(?[ABCD]\)?\s*(is|and)\b|\([ABCD]\)/.test(q.explanation);
  let i = 0, moved = 0;
  for (const q of b.questions.filter(x => x.type === 'mcq')) {
    const want = LETTERS[i++ % 4]; if (q.answer === want || !safe(q)) continue;
    const a = LETTERS.indexOf(q.answer), w = LETTERS.indexOf(want);
    [q.options[a], q.options[w]] = [q.options[w], q.options[a]]; q.answer = want; moved++;
  }
  const c = { A: 0, B: 0, C: 0, D: 0 }; for (const q of b.questions) if (q.type === 'mcq') c[q.answer]++;
  b.lettersRebalanced = 'The correct option was swapped into an even rotation of letters after drafting (only where options do not refer to each other and explanations name no letter).';
  writeFileSync(p, JSON.stringify(b, null, 1) + '\n');
  console.log(`${subject} ${klass}: ${moved} moved →`, c);
}
const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'assemble') assemble(a, b);
else if (cmd === 'blind') blind(a, b);
else if (cmd === 'merge') merge(a, b);
else if (cmd === 'status') status();
else if (cmd === 'sample') sample(Number(a) || 60);
else if (cmd === 'apply-review') applyReview(a);
else if (cmd === 'rebalance') rebalance(a, b);
else if (cmd === 'export-reviewed') exportReviewed();
else if (cmd) { console.error('unknown command ' + cmd); process.exit(1); }
