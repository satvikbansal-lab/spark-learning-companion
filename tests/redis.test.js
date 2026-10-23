// Parent View over a plain REDIS_URL connection (api/_redis.js), against a small fake Redis server that speaks the
// same protocol and needs a password. Runs in its own process so the storage choice is fresh. node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const R = require('../api/_redis.js');

/* A fake Redis: just the commands Spark uses, kept in memory, behind AUTH. */
function fakeRedis(password) {
  const kv = new Map();
  const reply = v => (v === null || v === undefined ? '$-1\r\n' : typeof v === 'number' ? `:${v}\r\n` : Array.isArray(v) ? `*${v.length}\r\n` + v.map(reply).join('') : `$${Buffer.byteLength(String(v))}\r\n${v}\r\n`);
  const run = (a, authed) => {
    const [c, k, ...r] = a; const C = c.toUpperCase();
    if (C === 'AUTH') return (r.length ? r[0] : k) === password ? '+OK\r\n' : '-WRONGPASS invalid password\r\n';
    if (!authed()) return '-NOAUTH Authentication required.\r\n';
    if (C === 'GET') return reply(kv.has(k) ? kv.get(k) : null);
    if (C === 'SET') { kv.set(k, r[0]); return '+OK\r\n'; }
    if (C === 'DEL') return reply(kv.delete(k) ? 1 : 0);
    if (C === 'INCR') { const n = Number(kv.get(k) || 0) + 1; kv.set(k, String(n)); return reply(n); }
    if (C === 'EXPIRE') return reply(1);
    if (C === 'HSET') { const h = kv.get(k) || {}; h[r[0]] = r[1]; kv.set(k, h); return reply(1); }
    if (C === 'HGETALL') return reply(Object.entries(kv.get(k) || {}).flat());
    if (C === 'HLEN') return reply(Object.keys(kv.get(k) || {}).length);
    if (C === 'LPUSH') { const l = kv.get(k) || []; l.unshift(r[0]); kv.set(k, l); return reply(l.length); }
    if (C === 'LTRIM') { const l = kv.get(k) || []; kv.set(k, l.slice(Number(r[0]), Number(r[1]) + 1)); return '+OK\r\n'; }
    if (C === 'LRANGE') { const l = kv.get(k) || [], b = Number(r[1]); return reply(l.slice(Number(r[0]), b < 0 ? undefined : b + 1)); }
    return `-ERR unknown command '${c}'\r\n`;
  };
  return net.createServer(sock => {
    let buf = Buffer.alloc(0), ok = false;
    sock.on('data', d => {
      buf = Buffer.concat([buf, d]);
      for (;;) {
        const p = R.parse(buf); if (!p) break;
        buf = buf.subarray(p[1]);
        const out = run(p[0], () => ok);
        if (p[0][0].toUpperCase() === 'AUTH' && out.startsWith('+')) ok = true;
        // Replies are split into small pieces to exercise reassembly.
        for (let i = 0; i < out.length; i += 7) sock.write(out.slice(i, i + 7));
      }
    });
  });
}

test('the protocol reader handles every reply type, split anywhere', () => {
  const raw = Buffer.from('+OK\r\n:42\r\n$5\r\nhello\r\n$-1\r\n*3\r\n$1\r\na\r\n:2\r\n*1\r\n$1\r\nb\r\n-ERR nope\r\n');
  const out = []; let at = 0;
  for (;;) { const r = R.parse(raw, at); if (!r) break; out.push(r[0]); at = r[1]; }
  assert.deepEqual(out.slice(0, 5), ['OK', 42, 'hello', null, ['a', 2, ['b']]]);
  assert.match(out[5].message, /ERR nope/);
  assert.equal(R.parse(Buffer.from('$5\r\nhel')), null, 'a half-received reply waits for more');
  assert.equal(R.encode(['SET', 'k', 'é']), '*3\r\n$3\r\nSET\r\n$1\r\nk\r\n$2\r\né\r\n');
});

test('Parent View works end to end over REDIS_URL, with the password required', async () => {
  const server = fakeRedis('s3cret-pass'); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  // Wrong password: commands fail instead of silently working.
  const bad = R.client(`redis://default:wrong@127.0.0.1:${port}`);
  await assert.rejects(bad.get('x'), /WRONGPASS/); bad._close();
  process.env.REDIS_URL = `redis://default:s3cret-pass@127.0.0.1:${port}`;
  delete process.env.SPARK_DEV_MEMORY;
  const store = require('../api/_store.js'); store._reset();
  assert.equal(store.store().kind, 'redis');
  const family = require('../api/family.js');
  family._setAI(async () => { throw new Error('no AI in this test'); });
  const call = (body, h = {}) => {
    const res = { code: 200, headers: {}, writableEnded: false, headersSent: false, status(c) { this.code = c; return this; }, json(o) { this.out = o; this.writableEnded = this.headersSent = true; return this; }, setHeader(k, v) { this.headers[k.toLowerCase()] = v; } };
    return family({ method: 'POST', headers: Object.assign({ host: 'spark.test', origin: 'https://spark.test', 'x-forwarded-proto': 'https' }, h), body }, res).then(() => res);
  };
  const setup = await call({ op: 'setup', pin: '739215', confirm: '739215' });
  assert.equal(setup.code, 200, JSON.stringify(setup.out));
  const device = setup.out.deviceToken, cookie = 'spark_parent=' + /spark_parent=([^;]*)/.exec(setup.headers['set-cookie'])[1];
  assert.equal((await call({ op: 'unlock', pin: '000001' }, { 'x-spark-device': device })).code, 401);
  assert.equal((await call({ op: 'unlock', pin: '739215' }, { 'x-spark-device': device })).code, 200);
  const day = new Date().toISOString().slice(0, 10);
  const ev = (id, o) => Object.assign({ id: 'rd-' + id, t: 'quiz', ts: Date.now() - 60000, day, topic: 'Fractions', subject: 'math', correct: true, firstTry: true }, o);
  assert.equal((await call({ op: 'events', events: [ev(1), ev(2), ev(3, { firstTry: false, correct: false, revealed: true })] }, { 'x-spark-device': device })).out.saved, 3);
  const j = await call({ op: 'journey', days: 7 }, { 'x-spark-device': device, cookie });
  assert.equal(j.code, 200); assert.equal(j.out.totals.attempts, 3); assert.equal(j.out.topics[0].statusLabel, 'Practising');
  const rep = await call({ op: 'report', period: 'day', date: day }, { 'x-spark-device': device, cookie });
  assert.equal(rep.out.aiError, true, 'no AI here, so the facts-only summary is used'); assert.match(rep.out.interpretation.summary, /Answered 3 quiz questions/);
  assert.equal((await call({ op: 'journey', days: 7 }, { 'x-spark-device': device })).code, 401);
  store.store()._close(); server.close();
});
