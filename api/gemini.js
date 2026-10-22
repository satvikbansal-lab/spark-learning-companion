// Server-side gateway to Gemini so the API key never reaches the browser.
// Set GEMINI_API_KEY in the Vercel project's Environment Variables.
// The gateway only forwards the request shapes Spark itself sends: chat with an optional maths checker
// (code execution) or Google Search, structured JSON jobs, and text-to-speech. It adds child-safe
// content filters and a per-visitor rate limit, so the key can't be used as a general-purpose proxy.
const { Readable } = require('node:stream');

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

function sameSite(req) {
  const from = req.headers.origin || req.headers.referer;
  if (!from) return false;
  try { return new URL(from).host === req.headers.host; } catch (e) { return false; }
}

module.exports = async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') return res.status(200).json({ configured: Boolean(key) });
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Use POST.' } });

  // Only this site's own pages may use the key (requests without an Origin or Referer are refused too).
  if (!sameSite(req)) return res.status(403).json({ error: { message: 'Not allowed.' } });
  if (!key) return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set on the server.' } });
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || 'unknown';
  if (limited(ip)) return res.status(429).json({ error: { code: 429, message: 'Too many requests from this device. Wait a minute and try again.' } });

  const { model, stream } = req.body || {};
  if (!MODEL.test(model || '')) return res.status(400).json({ error: { message: 'Bad request.' } });
  const [body, why] = clean(model, (req.body || {}).body);
  if (!body) return res.status(400).json({ error: { message: why } });

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
  Readable.fromWeb(upstream.body).on('error', () => res.end()).pipe(res);
};
module.exports.clean = clean;
module.exports.limited = limited;
module.exports.LIMITS = LIMITS;
