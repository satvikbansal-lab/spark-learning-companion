// Summarises maths benchmark results:  node tests/maths-report.mjs LABEL [BASELINE_LABEL]
// Writes tests/results/maths-<LABEL>.md and prints it. Only the latest result for each case/trial counts,
// and cases that hit API errors are reported as "not run", never as passes.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const load = label => {
  const f = join(here, 'results', `maths-${label}.jsonl`);
  if (!existsSync(f)) return [];
  const rows = new Map();
  for (const l of readFileSync(f, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); const k = `${r.id}#${r.trial}`; if (!rows.has(k) || !r.error) rows.set(k, r); }
  return [...rows.values()];
};
const require = createRequire(import.meta.url);
const { grade } = require('./maths-grade.js');
const ALL = Object.fromEntries([...require('./maths-cases.js'), ...require('./tutor-cases.js')].map(c => [c.id, c]));
/* Every stored reply is graded again with the current grader, so two runs are always judged by the same rules. */
const regrade = rows => rows.map(r => {
  if (r.error || !ALL[r.id]) return r;
  const g = grade(ALL[r.id], { text: r.text, route: r.route, tools: r.tools, checks: r.checks });
  return Object.assign({}, r, { status: g.status, fails: g.fails, flags: g.flags, rubric: g.rubric, overlap: g.overlap });
});
const [label = 'current', base] = process.argv.slice(2);
const cur = regrade(load(label)), old = base ? regrade(load(base)) : [];
const pct = (a, b) => (b ? `${Math.round((a / b) * 100)}%` : '–');
function table(rows) {
  const ran = rows.filter(r => !r.error), pass = ran.filter(r => r.status === 'PASS');
  return { ran: ran.length, pass: pass.length, errors: rows.length - ran.length, rubric: ran.length ? (ran.reduce((a, r) => a + r.rubric.total, 0) / ran.length).toFixed(1) : '–' };
}
const cats = [...new Set(cur.concat(old).map(r => r.cat))];
let md = `# Spark maths benchmark: ${label}${base ? ` vs ${base}` : ''}\n\n`;
const T = table(cur), B = base ? table(old) : null;
const meta = cur.find(r => !r.error) || {};
md += `Model: ${meta.model || '–'} · cases run: ${T.ran} · passed: **${T.pass} (${pct(T.pass, T.ran)})** · not run (API errors): ${T.errors} · mean rubric ${T.rubric}/20\n`;
if (B) md += `\nBaseline (${base}): run ${B.ran} · passed ${B.pass} (${pct(B.pass, B.ran)}) · not run ${B.errors} · mean rubric ${B.rubric}/20\n`;
md += `\n| Category | ${base ? 'Baseline pass | ' : ''}Pass | Run | Not run | Mean rubric |\n|---|${base ? '---|' : ''}---|---|---|---|\n`;
for (const c of cats) {
  const t = table(cur.filter(r => r.cat === c)), b = base && table(old.filter(r => r.cat === c));
  md += `| ${c} | ${b ? `${b.pass}/${b.ran} | ` : ''}${t.pass}/${t.ran} | ${t.ran} | ${t.errors} | ${t.rubric} |\n`;
}
const modes = {};
for (const r of cur.filter(r => !r.error)) for (const f of r.fails) modes[f.mode] = (modes[f.mode] || 0) + 1;
const flags = {};
for (const r of cur.filter(r => !r.error)) for (const f of r.flags || []) { const k = f.slice(0, 1); flags[k] = (flags[k] || 0) + 1; }
md += `\n**Failure modes (count of failed checks):** ${Object.entries(modes).sort().map(([k, v]) => `${k}: ${v}`).join(' · ') || 'none'}\n`;
md += `\n**Flags (not failures):** ${Object.entries(flags).sort().map(([k, v]) => `${k}: ${v}`).join(' · ') || 'none'}\n`;
const rc = cur.filter(r => r.recheck && r.recheck.first === 'disagree');
md += `\n**Independent re-check:** ran on ${cur.filter(r => r.recheck && r.recheck.first !== 'unknown').length} replies; disagreed with the first answer ${rc.length} time(s); fixed after retry ${rc.filter(r => r.recheck.second === 'agree').length}.\n`;
const code = cur.filter(r => r.tools && r.tools.code);
md += `\n**Code execution:** attached on ${code.length} replies, ran on ${code.filter(r => r.checks && r.checks.ran).length}, succeeded on ${code.filter(r => r.checks && r.checks.ok).length}.\n`;
const ms = cur.filter(r => r.ms).map(r => r.ms).sort((a, b) => a - b);
if (ms.length) md += `\n**Latency:** median ${(ms[Math.floor(ms.length / 2)] / 1000).toFixed(1)}s, 90th percentile ${(ms[Math.floor(ms.length * 0.9)] / 1000).toFixed(1)}s.\n`;
const trials = {};
for (const r of cur.filter(r => !r.error)) { (trials[r.id] = trials[r.id] || []).push(r.status); }
const multi = Object.entries(trials).filter(([, v]) => v.length > 1);
if (multi.length) md += `\n**Repeated trials:** ${multi.map(([k, v]) => `${k} ${v.filter(s => s === 'PASS').length}/${v.length}`).join(' · ')}\n`;
md += `\n## Failures\n\n| Case | Trial | Modes | Why |\n|---|---|---|---|\n`;
for (const r of cur.filter(r => !r.error && r.status === 'FAIL')) md += `| ${r.id} | ${r.trial} | ${[...new Set(r.fails.map(f => f.mode))].join(', ')} | ${r.fails.map(f => f.why).join('; ').replace(/\|/g, '/').replace(/\n/g, ' ').slice(0, 220)} |\n`;
const errs = cur.filter(r => r.error);
if (errs.length) md += `\n## Not run (API errors)\n\n${errs.map(r => `- ${r.id}: ${r.error.slice(0, 120)}`).join('\n')}\n`;
writeFileSync(join(here, 'results', `maths-${label}.md`), md);
console.log(md);
