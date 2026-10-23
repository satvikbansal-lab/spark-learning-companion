// Local server that behaves like the Vercel deployment: serves the app and runs api/gemini.js for /api/gemini and
// api/family.js for /api/family (Parent View). Without Upstash keys, Parent View uses an in-memory store here
// (SPARK_DEV_MEMORY=1): it works for testing and forgets everything when the server stops.
//   GEMINI_API_KEY=... node scripts/dev.mjs            or   OPENROUTER_API_KEY=... node scripts/dev.mjs
// Keys come from the environment, or from a .env-style file named in SPARK_ENV_FILE (read here, never printed,
// tolerant of spaces and quotes). Port: PORT (default 5174).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
if (process.env.SPARK_ENV_FILE && existsSync(process.env.SPARK_ENV_FILE)) {
  for (const line of readFileSync(process.env.SPARK_ENV_FILE, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?(GEMINI_API_KEY|OPENROUTER_API_KEY|OPENROUTER_MODEL|OPENROUTER_LITE_MODEL|KV_REST_API_URL|KV_REST_API_TOKEN|SPARK_PIN_PEPPER)\s*=\s*["']?([^"'\s#]+)/.exec(line);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
if (!process.env.KV_REST_API_URL && !process.env.UPSTASH_REDIS_REST_URL && !process.env.SPARK_DEV_MEMORY) process.env.SPARK_DEV_MEMORY = '1';
import { createRequire } from 'node:module';
import { dirname, join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const APIS = { '/api/gemini': require(join(root, 'api', 'gemini.js')), '/api/family': require(join(root, 'api', 'family.js')) };
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const api = APIS[url.pathname];
  if (api) {
    // The small parts of Vercel's response helpers that the handler uses.
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); return res; };
    let raw = ''; for await (const c of req) raw += c;
    try { req.body = raw ? JSON.parse(raw) : {}; } catch (e) { req.body = {}; }
    return api(req, res);
  }
  const path = normalize(url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname));
  if (path.includes('..') || /^\/(\.|tests|scripts|api|node_modules)/.test(path)) { res.statusCode = 404; return res.end('Not found'); }
  try {
    const body = await readFile(join(root, path));
    res.setHeader('Content-Type', TYPES[extname(path)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store'); // always serve the files being edited
    res.end(body);
  } catch (e) { res.statusCode = 404; res.end('Not found'); }
}).listen(Number(process.env.PORT || 5174), () => console.log(`Spark dev server on http://localhost:${process.env.PORT || 5174} (${process.env.GEMINI_API_KEY ? 'Gemini key' : process.env.OPENROUTER_API_KEY ? 'OpenRouter key' : 'no key: demo mode'})`));
