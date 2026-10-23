// Server-side storage for parent-only data (parent PIN hashes, sessions, content controls, learning activity,
// reports, safety events). Upstash Redis over its REST API: Vercel's Upstash integration sets KV_REST_API_URL and
// KV_REST_API_TOKEN (older setups: UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN), or a plain REDIS_URL
// (see api/_redis.js).
// Without those, an in-memory store is used ONLY when SPARK_DEV_MEMORY=1 (local dev and tests); in production
// store() returns null and the parent features say they aren't set up, rather than pretending to be secure.
// The file name starts with "_" so Vercel doesn't publish it as its own endpoint.

// The integration can add a custom prefix (e.g. STORAGE_KV_REST_API_URL), so any prefix is accepted.
const envEnding = (...ends) => { for (const e of ends) { if (process.env[e]) return process.env[e]; const k = Object.keys(process.env).find(n => n.endsWith('_' + e) && process.env[n]); if (k) return process.env[k]; } return ''; };
const URL_ = envEnding('KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL');
const TOKEN = envEnding('KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN');
// Or a single connection string (redis:// or rediss://), which some Redis integrations add instead.
const REDIS_URL = envEnding('REDIS_URL', 'KV_URL');

/* Upstash: each command is a JSON array; a pipeline is an array of them. */
function upstash(url, token) {
  const call = async (path, body) => {
    const r = await fetch(url.replace(/\/$/, '') + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(`store ${r.status}`);
    return r.json();
  };
  const cmd = async (...args) => { const j = await call('', args.map(String)); if (j.error) throw new Error('store: ' + j.error); return j.result; };
  return {
    kind: 'upstash',
    get: k => cmd('GET', k),
    set: (k, v, ttl) => (ttl ? cmd('SET', k, v, 'EX', Math.max(1, Math.round(ttl))) : cmd('SET', k, v)),
    del: k => cmd('DEL', k),
    incr: async (k, ttl) => { const n = await cmd('INCR', k); if (ttl && n === 1) await cmd('EXPIRE', k, Math.round(ttl)); return n; },
    expire: (k, ttl) => cmd('EXPIRE', k, Math.round(ttl)),
    hset: async (k, field, v, ttl) => { await cmd('HSET', k, field, v); if (ttl) await cmd('EXPIRE', k, Math.round(ttl)); },
    hgetall: async k => { const a = (await cmd('HGETALL', k)) || []; const o = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; },
    hlen: k => cmd('HLEN', k),
    /* Many hashes in one round trip (Upstash pipeline). */
    hgetallMany: async keys => {
      if (!keys.length) return [];
      const r = await call('/pipeline', keys.map(k => ['HGETALL', k]));
      return r.map(x => { const a = (x && x.result) || [], o = {}; for (let i = 0; i < a.length; i += 2) o[a[i]] = a[i + 1]; return o; });
    },
    lpush: async (k, v, max, ttl) => { await cmd('LPUSH', k, v); if (max) await cmd('LTRIM', k, 0, max - 1); if (ttl) await cmd('EXPIRE', k, Math.round(ttl)); },
    lrange: (k, a, b) => cmd('LRANGE', k, a, b).then(x => x || [])
  };
}

/* Local dev and tests only: same interface, kept in this process, with expiry. */
function memory() {
  const m = new Map(), exp = new Map();
  const live = k => { const e = exp.get(k); if (e && e <= Date.now()) { m.delete(k); exp.delete(k); } return m.has(k); };
  const ttlOf = (k, ttl) => { if (ttl) exp.set(k, Date.now() + ttl * 1000); };
  return {
    kind: 'memory',
    get: async k => (live(k) ? m.get(k) : null),
    set: async (k, v, ttl) => { m.set(k, String(v)); exp.delete(k); ttlOf(k, ttl); return 'OK'; },
    del: async k => { m.delete(k); exp.delete(k); return 1; },
    incr: async (k, ttl) => { const n = (live(k) ? Number(m.get(k)) : 0) + 1; m.set(k, String(n)); if (n === 1) ttlOf(k, ttl); return n; },
    expire: async (k, ttl) => { ttlOf(k, ttl); return 1; },
    hset: async (k, f, v, ttl) => { const h = live(k) ? m.get(k) : {}; h[f] = String(v); m.set(k, h); ttlOf(k, ttl); },
    hgetall: async k => Object.assign({}, live(k) ? m.get(k) : {}),
    hlen: async k => (live(k) ? Object.keys(m.get(k)).length : 0),
    hgetallMany: async keys => keys.map(k => Object.assign({}, live(k) ? m.get(k) : {})),
    lpush: async (k, v, max, ttl) => { const l = live(k) ? m.get(k) : []; l.unshift(String(v)); if (max) l.length = Math.min(l.length, max); m.set(k, l); ttlOf(k, ttl); },
    lrange: async (k, a, b) => (live(k) ? m.get(k).slice(a, b < 0 ? undefined : b + 1) : []),
    _clear: () => { m.clear(); exp.clear(); }
  };
}

let shared = null;
function store() {
  if (shared) return shared;
  if (URL_ && TOKEN) return (shared = upstash(URL_, TOKEN));
  if (/^rediss?:\/\//.test(REDIS_URL)) return (shared = require('./_redis.js').client(REDIS_URL));
  if (process.env.SPARK_DEV_MEMORY === '1') return (shared = memory());
  return null;
}
module.exports = { store, memory, _reset: () => { shared = null; } };
