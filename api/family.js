// /api/family: Parent View on the server. POST { op, ... } from this site's own pages only.
// Child's device (header x-spark-device): status, setup, unlock, recover, reset-request, child (which features are
// on), events (learning activity). Parent session (HttpOnly cookie after unlocking): lock, controls, controls-set,
// report, ask, safety, safety-seen, audit, pin-change, reset-cancel, delete.
// The rules live in api/_parent.js; storage in api/_store.js. See _parent.js for the security model and its limits.
const P = require('./_parent.js');
const { store } = require('./_store.js');
let ai = require('./_ai.js').callJSON;

const DAY = 86400, KEEP_EVENTS = 60 * DAY, KEEP_SAFETY = 180 * DAY, KEEP_REPORT = 35 * DAY;
const COOKIE = 'spark_parent';

function sameSite(req) {
  const from = req.headers.origin || req.headers.referer;
  if (!from) return false;
  try { return new URL(from).host === req.headers.host; } catch (e) { return false; }
}
const ipOf = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
const cookieOf = req => { const m = /(?:^|;\s*)spark_parent=([A-Za-z0-9_-]{43})/.exec(req.headers.cookie || ''); return m ? m[1] : null; };
const secure = req => (req.headers['x-forwarded-proto'] || '').includes('https') || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '');
const setCookie = (req, res, tok, maxAge) => res.setHeader('Set-Cookie', `${COOKIE}=${tok || ''}; HttpOnly; Path=/api/family; SameSite=Strict; Max-Age=${maxAge}${secure(req) ? '; Secure' : ''}`);
const fail = (res, code, error, extra) => res.status(code).json(Object.assign({ error }, extra || {}));
const J = s => { try { return s ? JSON.parse(s) : null; } catch (e) { return null; } };

async function familyOfDevice(st, req) {
  const t = req.headers['x-spark-device'];
  if (!P.validToken(t)) return null;
  return st.get('dev:' + P.sha(t));
}
async function loadFamily(st, fid) { return fid ? J(await st.get('fam:' + fid)) : null; }
async function saveFamily(st, fam) { await st.set('fam:' + fam.fid, JSON.stringify(fam)); }
const audit = (fam, what) => { fam.audit = [{ ts: Date.now(), what }, ...(fam.audit || [])].slice(0, 50); };
async function controlsOf(st, fid) { return P.cleanControls(J(await st.get('ctl:' + fid)) || {}); }

/* A parent session is valid only for the family of the device it's used from, and only for a limited time. */
async function parentSession(st, req) {
  const tok = cookieOf(req); if (!tok) return null;
  const s = J(await st.get('ses:' + P.sha(tok)));
  if (!s || Date.now() - s.created > P.SESSION_MAX * 1000) return null;
  const fid = await familyOfDevice(st, req);
  if (!fid || fid !== s.fid) return null;
  await st.expire('ses:' + P.sha(tok), P.SESSION_IDLE); // sliding idle timeout
  return s;
}
async function startSession(st, req, res, fid) {
  const tok = P.newToken();
  await st.set('ses:' + P.sha(tok), JSON.stringify({ fid, created: Date.now() }), P.SESSION_IDLE);
  setCookie(req, res, tok, P.SESSION_MAX);
}
/* Wrong-PIN protection: per family (longer and longer lockouts) and per network address. */
async function locked(st, fid) { const f = J(await st.get('fail:' + fid)) || { n: 0, until: 0 }; return f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 1000) : 0; }
async function noteFailure(st, fid) {
  const f = J(await st.get('fail:' + fid)) || { n: 0, until: 0 };
  f.n++; const wait = P.lockoutFor(f.n); f.until = wait ? Date.now() + wait * 1000 : 0;
  await st.set('fail:' + fid, JSON.stringify(f), DAY);
  return { retryAfter: wait, left: Math.max(0, 5 - f.n) };
}
async function ipBlocked(st, req, add) {
  const k = 'ipfail:' + P.sha(ipOf(req));
  const n = add ? await st.incr(k, 3600) : Number(await st.get(k)) || 0;
  return n > 30;
}

async function eventsFor(st, fid, days) {
  const out = {}, all = await st.hgetallMany(days.map(d => `ev:${fid}:${d}`));
  days.forEach((d, i) => { out[d] = Object.values(all[i] || {}).map(J).filter(Boolean); });
  return out;
}
/* The period a parent asked for: an end day within the kept history, and 1, 7, 14 or 30 days back from it. */
function periodOf(b) {
  const end = typeof b.end === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.end) ? b.end : P.dayOf(Date.now());
  const age = (Date.now() - new Date(end + 'T12:00:00Z').getTime()) / 864e5;
  const days = [1, 7, 14, 30].includes(b.days) ? b.days : 7;
  return age < -1.5 || age > 45 ? null : { end, days, list: [...Array(days)].map((_, i) => P.addDays(end, i - days + 1)) };
}
/* Reports: the facts are recomputed from stored events; the AI part is cached until the facts change, and only
   regenerated on demand at most once a minute. A failed AI call falls back to a plain facts-only summary. */
async function report(st, fid, period, date, refresh, ctl) {
  const days = period === 'day' ? [date] : [...Array(14)].map((_, i) => P.addDays(date, i - 13));
  const byDay = await eventsFor(st, fid, days);
  const facts = period === 'day' ? P.dayFacts(byDay[date], date) : P.weekFacts(byDay, date, days.slice(0, 7).flatMap(d => byDay[d]), ctl.goalDays);
  const key = `rep:${fid}:${period}:${date}`, hash = P.sha(JSON.stringify(facts)), cached = J(await st.get(key));
  if (cached && cached.hash === hash && !(refresh && Date.now() - cached.generated > 60000)) return Object.assign(cached, { facts, cached: true });
  let interp, aiError = false;
  if (!facts.active) interp = P.fallbackReport(facts);
  else {
    try { interp = P.validateReport(await ai({ prompt: P.reportPrompt(facts, ctl.klass), schema: P.REPORT_SCHEMA }), facts); } catch (e) { interp = null; }
    if (!interp) { interp = P.fallbackReport(facts); aiError = true; }
  }
  const rep = { period, date, hash, generated: Date.now(), interpretation: interp, aiError };
  await st.set(key, JSON.stringify(rep), KEEP_REPORT);
  return Object.assign(rep, { facts, cached: false });
}

const OPS = {
  /* ---- the child's device ---- */
  async status(st, req) {
    const fid = await familyOfDevice(st, req), fam = await loadFamily(st, fid);
    return { linked: !!fam, pinSet: !!(fam && fam.pin), resetAt: fam && fam.resetAt || null, unlocked: !!(fam && await parentSession(st, req)), storage: st.kind };
  },
  async setup(st, req, res, b) {
    const why = P.pinProblem(b.pin); if (why) return fail(res, 400, why);
    if (b.pin !== b.confirm) return fail(res, 400, 'The two PINs don’t match.');
    let fid = await familyOfDevice(st, req), fam = await loadFamily(st, fid), deviceToken = null;
    if (fam && fam.pin && !(fam.resetAt && Date.now() >= fam.resetAt)) return fail(res, 409, 'A parent PIN is already set on this device. Unlock with it, or use the recovery code.');
    if (!fam) {
      if ((await st.incr('setupip:' + P.sha(ipOf(req)), 3600)) > 10) return fail(res, 429, 'Too many new setups from this network. Try again later.');
      fid = P.newToken().slice(0, 22); deviceToken = P.newToken();
      fam = { fid, created: Date.now(), audit: [] };
      await st.set('dev:' + P.sha(deviceToken), fid);
      await st.set('ctl:' + fid, JSON.stringify(P.cleanControls(b.controls || {})));
      audit(fam, 'Parent View set up');
    } else audit(fam, 'Parent PIN replaced after the 24-hour reset wait (no recovery code was used)');
    const code = P.newRecoveryCode();
    fam.pin = await P.hashSecret(b.pin); fam.rec = await P.hashSecret(P.normCode(code)); fam.resetAt = null;
    await saveFamily(st, fam); await st.del('fail:' + fid);
    await startSession(st, req, res, fid);
    return { ok: true, deviceToken, recoveryCode: code };
  },
  async unlock(st, req, res, b) {
    const fid = await familyOfDevice(st, req), fam = await loadFamily(st, fid);
    if (!fam || !fam.pin) return fail(res, 404, 'Parent View isn’t set up on this device yet.');
    if (await ipBlocked(st, req)) return fail(res, 429, 'Too many wrong PINs from this network. Try again in an hour.', { retryAfter: 3600 });
    const wait = await locked(st, fid); if (wait) return fail(res, 429, `Too many wrong PINs. Try again in ${wait} seconds.`, { retryAfter: wait });
    if (!(await P.checkSecret(String(b.pin || ''), fam.pin))) {
      await ipBlocked(st, req, true); const f = await noteFailure(st, fid);
      return fail(res, 401, f.retryAfter ? `Wrong PIN. Parent View is locked for ${f.retryAfter} seconds.` : `Wrong PIN. ${f.left} tr${f.left === 1 ? 'y' : 'ies'} left before a short lock.`, { retryAfter: f.retryAfter });
    }
    await st.del('fail:' + fid);
    await startSession(st, req, res, fid);
    return { ok: true, resetAt: fam.resetAt || null };
  },
  async recover(st, req, res, b) {
    const fid = await familyOfDevice(st, req), fam = await loadFamily(st, fid);
    if (!fam || !fam.rec) return fail(res, 404, 'Parent View isn’t set up on this device yet.');
    const why = P.pinProblem(b.pin); if (why) return fail(res, 400, why);
    if (await ipBlocked(st, req)) return fail(res, 429, 'Too many tries from this network. Try again in an hour.', { retryAfter: 3600 });
    const wait = await locked(st, fid); if (wait) return fail(res, 429, `Too many tries. Try again in ${wait} seconds.`, { retryAfter: wait });
    if (!(await P.checkSecret(P.normCode(b.code), fam.rec))) { await ipBlocked(st, req, true); const f = await noteFailure(st, fid); return fail(res, 401, 'That recovery code isn’t right.', { retryAfter: f.retryAfter }); }
    const code = P.newRecoveryCode();
    fam.pin = await P.hashSecret(b.pin); fam.rec = await P.hashSecret(P.normCode(code)); fam.resetAt = null;
    audit(fam, 'Parent PIN changed with the recovery code (a new code was issued)');
    await saveFamily(st, fam); await st.del('fail:' + fid);
    await startSession(st, req, res, fid);
    return { ok: true, recoveryCode: code };
  },
  async 'reset-request'(st, req, res) {
    const fid = await familyOfDevice(st, req), fam = await loadFamily(st, fid);
    if (!fam) return fail(res, 404, 'Parent View isn’t set up on this device yet.');
    if (!fam.resetAt) { fam.resetAt = Date.now() + P.RESET_WAIT; audit(fam, 'PIN reset requested without the recovery code (takes effect after 24 hours)'); await saveFamily(st, fam); }
    return { ok: true, resetAt: fam.resetAt };
  },
  async child(st, req) {
    const fid = await familyOfDevice(st, req); if (!fid) return { linked: false };
    const c = await controlsOf(st, fid);
    return { linked: true, features: { voice: c.voice, uploads: c.uploads, fun: c.fun, web: c.web }, homework: c.homework, language: c.language };
  },
  async events(st, req, res, b) {
    const fid = await familyOfDevice(st, req); if (!fid) return fail(res, 401, 'This device isn’t linked to Parent View.');
    if ((await st.incr('evrate:' + fid, 60)) > 30) return fail(res, 429, 'Too many updates. Try again in a minute.');
    const evs = P.cleanEvents(b.events);
    let saved = 0;
    for (const e of evs) {
      const k = `ev:${fid}:${e.day}`;
      if ((await st.hlen(k)) >= 400) continue; // a day's cap
      await st.hset(k, e.id, JSON.stringify(e), KEEP_EVENTS); saved++; // same id = same event: a resend never duplicates
    }
    return { ok: true, saved, ids: evs.map(e => e.id) };
  },

  /* ---- parent session only ---- */
  async lock(st, req, res) {
    const tok = cookieOf(req); if (tok) await st.del('ses:' + P.sha(tok));
    setCookie(req, res, '', 0);
    return { ok: true };
  },
  async controls(st, req, res, b, s) { return { controls: await controlsOf(st, s.fid), options: P.OPTIONS }; },
  async 'controls-set'(st, req, res, b, s) {
    const c = P.cleanControls(b.controls, await controlsOf(st, s.fid));
    await st.set('ctl:' + s.fid, JSON.stringify(c));
    return { ok: true, controls: c };
  },
  async report(st, req, res, b, s) {
    const period = b.period === 'week' ? 'week' : 'day', date = typeof b.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : P.dayOf(Date.now());
    const age = (Date.now() - new Date(date + 'T12:00:00Z').getTime()) / 864e5;
    if (age < -1.5 || age > 45) return fail(res, 400, 'Reports cover the last 45 days.');
    const c = await controlsOf(st, s.fid);
    return report(st, s.fid, period, date, !!b.refresh, c);
  },
  /* The learning journey for a period: topics with status and evidence, strengths, gaps, milestones, consistency. */
  async journey(st, req, res, b, s) {
    const p = periodOf(b); if (!p) return fail(res, 400, 'Choose a period within the last 45 days.');
    const c = await controlsOf(st, s.fid);
    return P.journey(await eventsFor(st, s.fid, p.list), p.end, p.days, c.goalDays);
  },
  async timeline(st, req, res, b, s) {
    const p = periodOf(b); if (!p) return fail(res, 400, 'Choose a period within the last 45 days.');
    const byDay = await eventsFor(st, s.fid, p.list);
    return { period: { from: p.list[0], to: p.end, days: p.days }, items: P.timeline(p.list.flatMap(d => byDay[d])) };
  },
  /* Ask Spark: answered only from the last 30 days of the learning record, with the evidence it used. */
  async ask(st, req, res, b, s) {
    const q = P.str(b.question, 400); if (q.length < 3) return fail(res, 400, 'Type a question first.');
    if ((await st.incr('ask:' + s.fid, 3600)) > 20) return fail(res, 429, 'That’s a lot of questions for one hour. Try again later.');
    const p = periodOf({ end: b.date, days: 30 }) || periodOf({ days: 30 });
    const c = await controlsOf(st, s.fid), j = P.journey(await eventsFor(st, s.fid, p.list), p.end, 30, c.goalDays);
    if (!j.active) return { answer: 'There’s no learning activity recorded in the last 30 days, so I can’t answer that from Spark’s records yet.', evidence: [], estimate: false, insufficient: true };
    try {
      const r = P.validateAsk(await ai({ prompt: P.askPrompt2(q, j, c.klass), schema: P.ASK2_SCHEMA, maxTokens: 800 }));
      if (!r) throw new Error('empty');
      return r;
    } catch (e) { return fail(res, 503, 'Ask Spark isn’t available right now. Try again in a minute.', { code: 'ai_unavailable' }); }
  },
  async safety(st, req, res, b, s) {
    const list = (await st.lrange('safe:' + s.fid, 0, 99)).map(J).filter(Boolean);
    return { events: list, unseen: list.filter(e => !e.seen).length };
  },
  async 'safety-seen'(st, req, res, b, s) {
    const list = (await st.lrange('safe:' + s.fid, 0, 199)).map(J).filter(Boolean);
    await st.del('safe:' + s.fid);
    for (const e of list.reverse()) await st.lpush('safe:' + s.fid, JSON.stringify(Object.assign(e, { seen: true })), 200, KEEP_SAFETY);
    return { ok: true };
  },
  async audit(st, req, res, b, s) { const fam = await loadFamily(st, s.fid); return { audit: fam.audit || [], resetAt: fam.resetAt || null }; },
  async 'reset-cancel'(st, req, res, b, s) {
    const fam = await loadFamily(st, s.fid);
    if (fam.resetAt) { fam.resetAt = null; audit(fam, 'PIN reset request cancelled by the parent'); await saveFamily(st, fam); }
    return { ok: true };
  },
  async 'pin-change'(st, req, res, b, s) {
    const fam = await loadFamily(st, s.fid);
    if (!(await P.checkSecret(String(b.old || ''), fam.pin))) { const f = await noteFailure(st, s.fid); return fail(res, 401, 'Your current PIN isn’t right.', { retryAfter: f.retryAfter }); }
    const why = P.pinProblem(b.pin); if (why) return fail(res, 400, why);
    if (b.pin !== b.confirm) return fail(res, 400, 'The two PINs don’t match.');
    fam.pin = await P.hashSecret(b.pin); audit(fam, 'Parent PIN changed'); await saveFamily(st, fam);
    return { ok: true };
  },
  /* Deletes every parent-side record for this family (the child's own notebooks stay on their device). */
  async delete(st, req, res, b, s) {
    const fam = await loadFamily(st, s.fid);
    if (!(await P.checkSecret(String(b.pin || ''), fam.pin))) { const f = await noteFailure(st, s.fid); return fail(res, 401, 'Your PIN isn’t right.', { retryAfter: f.retryAfter }); }
    const today = P.dayOf(Date.now());
    for (let i = -1; i < 62; i++) await st.del(`ev:${s.fid}:${P.addDays(today, -i)}`);
    for (const k of ['fam:', 'ctl:', 'safe:', 'fail:']) await st.del(k + s.fid);
    const t = req.headers['x-spark-device']; if (P.validToken(t)) await st.del('dev:' + P.sha(t));
    await OPS.lock(st, req, res);
    return { ok: true };
  }
};
const DEVICE_OPS = new Set(['status', 'setup', 'unlock', 'recover', 'reset-request', 'child', 'events', 'lock']);

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return fail(res, 405, 'Use POST.');
  if (!sameSite(req)) return fail(res, 403, 'Not allowed.'); // with SameSite=Strict cookies, this blocks cross-site requests
  const st = store();
  if (!st) return fail(res, 503, 'Parent View isn’t set up on this site yet: its database still needs to be connected.', { code: 'no_store' });
  const b = req.body && typeof req.body === 'object' ? req.body : {}, op = typeof b.op === 'string' ? b.op : '';
  const fn = Object.prototype.hasOwnProperty.call(OPS, op) ? OPS[op] : null;
  if (!fn) return fail(res, 400, 'Unknown request.');
  try {
    let s = null;
    if (!DEVICE_OPS.has(op)) { s = await parentSession(st, req); if (!s) return fail(res, 401, 'Parent View is locked.', { code: 'locked' }); }
    const out = await fn(st, req, res, b, s);
    if (!res.writableEnded && !res.headersSent) return res.status(200).json(out);
  } catch (e) {
    console.error('family error', e && e.message); // never the request body: it can hold a PIN
    if (!res.headersSent) return fail(res, 500, 'Something went wrong. Try again.');
  }
};
module.exports._setAI = fn => { ai = fn; };
module.exports._ops = OPS;
