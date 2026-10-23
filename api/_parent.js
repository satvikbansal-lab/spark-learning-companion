// Parent View on the server: the parent PIN, parent sessions, content controls, the safety log, learning activity
// and AI learning reports. Used by api/family.js (the endpoint) and api/gemini.js (which enforces the controls).
//
// Security model, stated plainly:
// - The parent PIN is hashed with scrypt (random salt; optional SPARK_PIN_PEPPER) and only ever compared on the
//   server, in constant time. It never reaches storage or logs in clear. Wrong PINs lock the family out for longer
//   and longer (30 s … 1 h), and each network address is limited too.
// - Unlocking gives a random session token in an HttpOnly, SameSite=Strict cookie scoped to /api/family. Parent-only
//   data (reports, controls, the safety log, Ask Spark) is served only with a valid session for the same family.
// - The child's device holds a device token. It can only send learning activity, read which features are switched on,
//   and try to unlock; it can never read reports, the safety log or change controls.
// - There are no accounts, so there is no parent identity to recover with. A one-time recovery code resets the PIN;
//   without it, a reset only takes effect 24 hours after it is requested, and that stays visible in the audit log.
//   Whoever sets the PIN first becomes the parent, so the app tells parents to set it up themselves.
// - Learning activity is recorded by the app on the child's device, so reports are only as trustworthy as that
//   device; the controls themselves are enforced by the server for everything that goes through Spark.
// The file name starts with "_" so Vercel doesn't publish it as its own endpoint.
const crypto = require('node:crypto');
const shared = require('../spark-parent.js'); // controls, safety rules, facts, journey, reports (also used in the browser)
const { pinProblem, normCode, lockoutFor } = shared;

/* ---------- secrets ---------- */
const b64u = buf => Buffer.from(buf).toString('base64url');
const newToken = () => b64u(crypto.randomBytes(32));
const sha = s => crypto.createHash('sha256').update(String(s)).digest('base64url');
const pepper = s => (process.env.SPARK_PIN_PEPPER ? crypto.createHmac('sha256', process.env.SPARK_PIN_PEPPER).update(s).digest('base64') : s);
const scrypt = (secret, salt) => new Promise((res, rej) => crypto.scrypt(pepper(secret), salt, 32, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))));
async function hashSecret(secret) { const salt = crypto.randomBytes(16); return { h: b64u(await scrypt(secret, salt)), s: b64u(salt) }; }
async function checkSecret(secret, rec) {
  if (!rec || !rec.h || !rec.s) return false;
  const got = await scrypt(secret, Buffer.from(rec.s, 'base64url')), want = Buffer.from(rec.h, 'base64url');
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}
const CODE_ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newRecoveryCode = () => { const b = crypto.randomBytes(16); let s = ''; for (let i = 0; i < 16; i++) s += CODE_ABC[b[i] % CODE_ABC.length]; return s.match(/.{4}/g).join('-'); };
/* Seconds locked after the nth wrong PIN in a row: free tries first, then longer and longer. */
const validToken = t => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

const SESSION_IDLE = 15 * 60, SESSION_MAX = 2 * 3600, RESET_WAIT = 24 * 3600 * 1000;

module.exports = Object.assign({}, shared, { newToken, sha, hashSecret, checkSecret, newRecoveryCode, validToken, SESSION_IDLE, SESSION_MAX, RESET_WAIT });
