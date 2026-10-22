// Server-side gateway to Gemini so the API key never reaches the browser.
// Set GEMINI_API_KEY in the Vercel project's Environment Variables.
const { Readable } = require('node:stream');

const MODEL = /^gemini-[a-z0-9.\-]+$/;

module.exports = async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'GET') return res.status(200).json({ configured: Boolean(key) });
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Use POST.' } });

  // Only this site's own pages may use the key.
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch (e) {}
    if (host !== req.headers.host) return res.status(403).json({ error: { message: 'Not allowed.' } });
  }
  if (!key) return res.status(500).json({ error: { message: 'GEMINI_API_KEY is not set on the server.' } });

  const { model, stream, body } = req.body || {};
  if (!MODEL.test(model || '') || !body || typeof body !== 'object') return res.status(400).json({ error: { message: 'Bad request.' } });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;
  let upstream;
  try {
    upstream = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key }, body: JSON.stringify(body) });
  } catch (e) {
    return res.status(502).json({ error: { message: 'Could not reach Gemini.' } });
  }

  res.status(upstream.status);
  res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
  if (!upstream.body) return res.end();
  Readable.fromWeb(upstream.body).pipe(res);
};
