// A tiny Redis client over a plain TCP/TLS connection, for when the database is connected with a single REDIS_URL
// (redis://user:password@host:port, or rediss:// for TLS) instead of Upstash's REST keys. Node built-ins only.
// It speaks just enough of the Redis protocol (RESP) for api/_store.js: commands are sent as arrays of strings, and
// replies (simple strings, errors, integers, bulk strings, arrays) are read back in order. One connection is reused
// while the serverless instance stays warm, and reopened if it drops.
// The file name starts with "_" so Vercel doesn't publish it as its own endpoint.
const net = require('node:net');
const tls = require('node:tls');

/* Reads one complete reply from buf at i. Returns [value, nextIndex] or null if more bytes are needed. */
function parse(buf, i = 0) {
  if (i >= buf.length) return null;
  const end = buf.indexOf('\r\n', i); if (end < 0) return null;
  const type = String.fromCharCode(buf[i]), line = buf.toString('utf8', i + 1, end), next = end + 2;
  if (type === '+') return [line, next];
  if (type === '-') return [new ReplyError(line), next];
  if (type === ':') return [Number(line), next];
  if (type === '$') {
    const n = Number(line); if (n < 0) return [null, next];
    if (buf.length < next + n + 2) return null;
    return [buf.toString('utf8', next, next + n), next + n + 2];
  }
  if (type === '*') {
    const n = Number(line); if (n < 0) return [null, next];
    const out = []; let at = next;
    for (let k = 0; k < n; k++) { const r = parse(buf, at); if (!r) return null; out.push(r[0]); at = r[1]; }
    return [out, at];
  }
  throw new Error('redis: bad reply');
}
class ReplyError extends Error {}
const encode = args => '*' + args.length + '\r\n' + args.map(a => { const s = String(a); return '$' + Buffer.byteLength(s) + '\r\n' + s + '\r\n'; }).join('');

function client(redisUrl, { timeoutMs = 8000 } = {}) {
  const u = new URL(redisUrl);
  const opts = { host: u.hostname, port: Number(u.port) || 6379 };
  const user = decodeURIComponent(u.username || ''), pass = decodeURIComponent(u.password || '');
  let sock = null, ready = null, buf = Buffer.alloc(0), waiting = [];
  const failAll = err => { const w = waiting; waiting = []; for (const p of w) p.reject(err); sock = null; ready = null; buf = Buffer.alloc(0); };
  function connect() {
    if (ready) return ready;
    ready = new Promise((resolve, reject) => {
      const s = u.protocol === 'rediss:' ? tls.connect(Object.assign({ servername: opts.host }, opts)) : net.connect(opts);
      s.setTimeout(timeoutMs, () => s.destroy(new Error('redis: timeout')));
      s.on('data', chunk => {
        buf = Buffer.concat([buf, chunk]);
        for (;;) {
          let r; try { r = parse(buf); } catch (e) { s.destroy(e); return; }
          if (!r) break;
          buf = buf.subarray(r[1]);
          const p = waiting.shift(); if (!p) continue;
          r[0] instanceof ReplyError ? p.reject(new Error('redis: ' + r[0].message)) : p.resolve(r[0]);
        }
      });
      s.on('error', e => { failAll(e); reject(e); });
      s.on('close', () => failAll(new Error('redis: connection closed')));
      s.once(u.protocol === 'rediss:' ? 'secureConnect' : 'connect', () => {
        s.setTimeout(0); sock = s;
        if (!pass) return resolve();
        send(user ? ['AUTH', user, pass] : ['AUTH', pass]).then(() => resolve(), e => { s.destroy(); reject(e); });
      });
    });
    return ready;
  }
  function send(args) {
    return new Promise((resolve, reject) => { waiting.push({ resolve, reject }); sock.write(encode(args)); });
  }
  const cmd = async (...args) => { await connect(); return send(args); };
  const toObj = a => { const o = {}; for (let i = 0; i < (a || []).length; i += 2) o[a[i]] = a[i + 1]; return o; };
  return {
    kind: 'redis',
    get: k => cmd('GET', k),
    set: (k, v, ttl) => (ttl ? cmd('SET', k, v, 'EX', Math.max(1, Math.round(ttl))) : cmd('SET', k, v)),
    del: k => cmd('DEL', k),
    incr: async (k, ttl) => { const n = await cmd('INCR', k); if (ttl && n === 1) await cmd('EXPIRE', k, Math.round(ttl)); return n; },
    expire: (k, ttl) => cmd('EXPIRE', k, Math.round(ttl)),
    hset: async (k, f, v, ttl) => { await cmd('HSET', k, f, v); if (ttl) await cmd('EXPIRE', k, Math.round(ttl)); },
    hgetall: async k => toObj(await cmd('HGETALL', k)),
    hlen: k => cmd('HLEN', k),
    // Pipelined: every request goes out at once, replies come back in order.
    hgetallMany: async keys => { await connect(); return (await Promise.all(keys.map(k => send(['HGETALL', k])))).map(toObj); },
    lpush: async (k, v, max, ttl) => { await cmd('LPUSH', k, v); if (max) await cmd('LTRIM', k, 0, max - 1); if (ttl) await cmd('EXPIRE', k, Math.round(ttl)); },
    lrange: (k, a, b) => cmd('LRANGE', k, a, b).then(x => x || []),
    _close: () => { if (sock) sock.destroy(); }
  };
}
module.exports = { client, parse, encode };
