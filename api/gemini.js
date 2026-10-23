// Server-side gateway to Gemini so the API key never reaches the browser.
// Set GEMINI_API_KEY in the Vercel project's Environment Variables, or OPENROUTER_API_KEY to reach Gemini through
// OpenRouter instead (see api/_openrouter.js). GEMINI_API_KEY wins when both are set.
// The gateway only forwards the request shapes Spark itself sends: chat with an optional maths checker
// (code execution) or Google Search, structured JSON jobs, and text-to-speech. It adds child-safe
// content filters and a per-visitor rate limit, so the key can't be used as a general-purpose proxy.
const { Readable } = require('node:stream');
const openrouter = require('./_openrouter.js');
const P = require('./_parent.js');
const { store } = require('./_store.js');

const MODEL = /^gemini-[a-z0-9.\-]{1,60}$/;
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
  .map(category => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }));
const LIMITS = { contents: 80, parts: 3000, textChars: 400000, maxOutputTokens: 8192, perMinute: 30, perDay: 800 };
const GEN_KEYS = ['temperature', 'topP', 'topK', 'maxOutputTokens', 'thinkingConfig', 'responseMimeType', 'responseSchema', 'responseModalities', 'speechConfig', 'candidateCount', 'stopSequences'];
const INLINE_MIME = /^(image\/(png|jpe?g|webp|heic|heif|gif)|application\/pdf|text\/plain)$/;

/* Best-effort rate limit per visitor. Serverless instances don't share memory, so this slows abuse
   rather than guaranteeing a hard cap; Google's own quota is the final limit. */
const hits = new Map();
function limited(ip, now = Date.now()) {
  const h = hits.get(ip) || { minute: [], day: 0, dayStart: now };
  if (now - h.dayStart > 864e5) { h.day = 0; h.dayStart = now; }
  h.minute = h.minute.filter(t => now - t < 60000);
  if (h.minute.length >= LIMITS.perMinute || h.day >= LIMITS.perDay) { hits.set(ip, h); return true; }
  h.minute.push(now); h.day++; hits.set(ip, h);
  if (hits.size > 5000) hits.delete(hits.keys().next().value);
  return false;
}

/* Rebuilds the request from known fields only. Returns [body] or [null, reason]. */
function clean(model, body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [null, 'Missing request body.'];
  const { contents, systemInstruction, generationConfig, tools } = body;
  if (!Array.isArray(contents) || !contents.length || contents.length > LIMITS.contents) return [null, 'Too many or no messages.'];
  let chars = 0, parts = 0;
  const textOf = p => { if (typeof p.text !== 'string') return false; chars += p.text.length; return true; };
  const cleanParts = (arr, allowInline) => {
    if (!Array.isArray(arr) || !arr.length) return null;
    const out = [];
    for (const p of arr) {
      if (!p || typeof p !== 'object' || ++parts > LIMITS.parts) return null;
      if (textOf(p)) out.push({ text: p.text });
      else if (allowInline && p.inlineData && INLINE_MIME.test(p.inlineData.mimeType || '') && typeof p.inlineData.data === 'string') out.push({ inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } });
      // Earlier model turns can carry the Python the model ran and its result; keep them so follow-ups stay coherent.
      else if (p.executableCode && typeof p.executableCode.code === 'string') { chars += p.executableCode.code.length; out.push({ executableCode: { language: 'PYTHON', code: p.executableCode.code } }); }
      else if (p.codeExecutionResult && typeof p.codeExecutionResult.output === 'string') { chars += p.codeExecutionResult.output.length; out.push({ codeExecutionResult: { outcome: String(p.codeExecutionResult.outcome || 'OUTCOME_OK'), output: p.codeExecutionResult.output } }); }
      else return null;
    }
    return out;
  };
  const out = { contents: [] };
  for (const c of contents) {
    if (!c || (c.role !== 'user' && c.role !== 'model')) return [null, 'Bad message role.'];
    const ps = cleanParts(c.parts, true); if (!ps) return [null, 'Bad message content.'];
    out.contents.push({ role: c.role, parts: ps });
  }
  if (systemInstruction) {
    const ps = cleanParts(systemInstruction.parts, false); if (!ps) return [null, 'Bad system instruction.'];
    out.systemInstruction = { parts: ps };
  }
  if (chars > LIMITS.textChars) return [null, 'That conversation is too long. Start a new notebook.'];
  if (generationConfig && typeof generationConfig === 'object') {
    out.generationConfig = {};
    for (const k of GEN_KEYS) if (k in generationConfig) out.generationConfig[k] = generationConfig[k];
    const m = Number(out.generationConfig.maxOutputTokens) || LIMITS.maxOutputTokens;
    out.generationConfig.maxOutputTokens = Math.min(Math.max(1, m), LIMITS.maxOutputTokens);
    if (out.generationConfig.candidateCount) out.generationConfig.candidateCount = 1;
  }
  if (tools !== undefined) {
    if (!Array.isArray(tools) || tools.length > 2) return [null, 'Bad tools.'];
    out.tools = [];
    for (const t of tools) {
      if (t && t.googleSearch) out.tools.push({ googleSearch: {} });
      else if (t && t.codeExecution) out.tools.push({ codeExecution: {} });
      else return [null, 'That tool is not allowed.'];
    }
    if (!out.tools.length) delete out.tools;
  }
  // Text-to-speech models only read text aloud; every other model gets child-safe filters.
  if (!/tts/.test(model)) out.safetySettings = SAFETY;
  return [out];
}

/* ---------- parent controls and the safety pipeline (rules in api/_parent.js) ----------
   A device linked to Parent View sends x-spark-device. The server looks up that family's controls and enforces
   them here, so the browser can't switch them off. Chat requests (not background JSON jobs) also get the core
   safety rules and a safety check of the child's latest message; anything it flags is logged for the parent as a
   category only, never the message. */
const FAM_CACHE = new Map();
async function familyContext(req) {
  const t = req.headers['x-spark-device'];
  if (!P.validToken(t)) return null;
  const k = P.sha(t), hit = FAM_CACHE.get(k);
  if (hit && Date.now() - hit.at < 30000) return hit.ctx;
  const st = store(); if (!st) return null;
  let ctx;
  try {
    const fid = await st.get('dev:' + k);
    ctx = fid ? { fid, st, controls: P.cleanControls(JSON.parse((await st.get('ctl:' + fid)) || '{}')) } : null;
  } catch (e) { ctx = { fid: null, st: null, controls: P.cleanControls({}) }; } // storage trouble: the safe defaults
  FAM_CACHE.set(k, { at: Date.now(), ctx });
  if (FAM_CACHE.size > 2000) FAM_CACHE.delete(FAM_CACHE.keys().next().value);
  return ctx;
}
const isChat = body => !(body.generationConfig && (body.generationConfig.responseMimeType === 'application/json' || body.generationConfig.responseSchema));
const lastUserText = body => { const u = [...body.contents].reverse().find(c => c.role === 'user'); return u ? u.parts.map(p => p.text || '').join(' ') : ''; };
const hasUploads = body => { const u = [...body.contents].reverse().find(c => c.role === 'user'); return !!(u && u.parts.some(p => p.inlineData)); };
/* Applies the family's controls and the safety layer to a cleaned request. Returns [body] or [null, status, error]. */
function applyControls(model, body, fam, hits) {
  const c = fam ? fam.controls : null;
  if (c && /tts/.test(model) && !c.voice) return [null, 403, { code: 'voice_off', message: 'Your parent has switched voice off in Spark.' }];
  if (/tts/.test(model)) return [body];
  if (c && !c.uploads && hasUploads(body)) return [null, 403, { code: 'uploads_off', message: 'Your parent has switched off photos and uploads in Spark.' }];
  if (c && !c.web && body.tools) { body.tools = body.tools.filter(t => !t.googleSearch); if (!body.tools.length) delete body.tools; }
  if (c && c.sensitive === 'extra') body.safetySettings = (body.safetySettings || []).map(x => (/SEXUALLY|DANGEROUS/.test(x.category) ? { category: x.category, threshold: 'BLOCK_LOW_AND_ABOVE' } : x));
  if (isChat(body)) {
    const extra = [P.CORE_SAFETY, c ? P.parentRules(c) : '', P.safetyInstruction(hits)].filter(Boolean).join('\n\n');
    body.systemInstruction = { parts: [...((body.systemInstruction && body.systemInstruction.parts) || []), { text: extra }] };
  }
  return [body];
}
/* Safety log entries: one per category per 10 minutes, never the message. */
async function logSafety(fam, hits) {
  if (!fam || !fam.fid || !fam.st || !hits.length) return;
  for (const h of hits) {
    try {
      if ((await fam.st.incr(`safedup:${fam.fid}:${h.category}`, 600)) > 1) continue;
      await fam.st.lpush('safe:' + fam.fid, JSON.stringify(P.safetyEvent(h)), 200, 180 * 86400);
    } catch (e) { /* logging must never break the child's answer */ }
  }
}

function sameSite(req) {
  const from = req.headers.origin || req.headers.referer;
  if (!from) return false;
  try { return new URL(from).host === req.headers.host; } catch (e) { return false; }
}

module.exports = async (req, res) => {
  const key = process.env.GEMINI_API_KEY, orKey = !key && process.env.OPENROUTER_API_KEY;
  res.setHeader('Cache-Control', 'no-store');

  // The app reads which tools this connection has, so it never promises a calculator or web search that won't run.
  if (req.method === 'GET') return res.status(200).json(key ? { configured: true, provider: 'gemini', tools: { code: true, search: true }, tts: true, parent: !!store() }
    : orKey ? { configured: true, provider: 'openrouter', model: openrouter.MAIN, tools: { code: false, search: false }, tts: true, voice: openrouter.TTS, parent: !!store() } : { configured: false, parent: !!store() });
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Use POST.' } });

  // Only this site's own pages may use the key (requests without an Origin or Referer are refused too).
  if (!sameSite(req)) return res.status(403).json({ error: { message: 'Not allowed.' } });
  if (!key && !orKey) return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set on the server.' } });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: { code: 429, message: 'Too many requests from this device. Wait a minute and try again.' } });

  const { model, stream } = req.body || {};
  if (!MODEL.test(model || '')) return res.status(400).json({ error: { message: 'Bad request.' } });
  const [cleaned, why] = clean(model, (req.body || {}).body);
  if (!cleaned) return res.status(400).json({ error: { message: why } });
  const fam = await familyContext(req);
  const hits = !/tts/.test(model) && isChat(cleaned) ? P.classify(lastUserText(cleaned)) : [];
  const [body, status, err] = applyControls(model, cleaned, fam, hits);
  if (!body) return res.status(status).json({ error: err });
  logSafety(fam, hits);

  const ctl0 = new AbortController();
  if (orKey) { res.on('close', () => { if (!res.writableEnded) ctl0.abort(); }); return openrouter.forward(res, { model, stream, body, key: orKey, signal: ctl0.signal }); }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  const ctl = new AbortController();
  res.on('close', () => { if (!res.writableEnded) ctl.abort(); });
  let upstream;
  try {
    upstream = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body), signal: ctl.signal });
  } catch (e) {
    return res.status(502).json({ error: { message: 'Could not reach Gemini.' } });
  }

  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  if (!upstream.body) return res.end();
  const up = Readable.fromWeb(upstream.body);
  if (fam && fam.fid) { let flagged = false; up.on('data', ch => { if (!flagged && /"(finishReason|blockReason)"\s*:\s*"(SAFETY|PROHIBITED_CONTENT|BLOCKLIST)"/.test(String(ch))) { flagged = true; logSafety(fam, [{ category: 'blocked_reply', severity: 'medium', kind: 'blocked', review: false, action: 'Google’s safety filter blocked a reply, and Spark showed a calm message instead' }]); } }); }
  up.on('error', () => res.end()).pipe(res);
};
module.exports.clean = clean;
module.exports.applyControls = applyControls;
module.exports.logSafety = logSafety;
module.exports.familyContext = familyContext;
module.exports.limited = limited;
module.exports.LIMITS = LIMITS;
