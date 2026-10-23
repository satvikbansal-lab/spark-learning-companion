// One structured (JSON) AI call made by the server itself, for parent reports and Ask Spark: the data never passes
// through the child's browser. Uses GEMINI_API_KEY when set, else OPENROUTER_API_KEY (Google models only, served
// only by Google, as api/_openrouter.js does). Tries a lighter model if one is busy; throws when none answers.
// The file name starts with "_" so Vercel doesn't publish it as its own endpoint.
const openrouter = require('./_openrouter.js');

const MODELS = ['gemini-flash-latest', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
const SAFETY = ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'].map(category => ({ category, threshold: 'BLOCK_MEDIUM_AND_ABOVE' }));

async function callJSON({ prompt, schema, maxTokens = 1500, timeoutMs = 25000 }) {
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens, responseMimeType: 'application/json', responseSchema: schema }, safetySettings: SAFETY };
  const gem = process.env.GEMINI_API_KEY, or = !gem && process.env.OPENROUTER_API_KEY;
  if (!gem && !or) throw new Error('no AI key');
  let last;
  for (const model of MODELS) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      let text;
      if (gem) {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': gem }, body: JSON.stringify(body) });
        if (!r.ok) { last = new Error(`AI ${r.status}`); if ([429, 500, 502, 503, 504, 404].includes(r.status)) continue; throw last; }
        const j = await r.json(), parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
        text = (parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
      } else {
        const chat = openrouter.toChat(model, body, false);
        const r = await fetch('https://openrouter.ai/api/v1/chat/completions', { method: 'POST', signal: ctl.signal, headers: { Authorization: `Bearer ${or}`, 'Content-Type': 'application/json', 'X-Title': 'Spark' }, body: JSON.stringify(chat) });
        if (!r.ok) { last = new Error(`AI ${r.status}`); if (r.status === 402) throw last; if ([429, 500, 502, 503, 504].includes(r.status)) continue; throw last; }
        const j = await r.json(); text = j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
      }
      if (!text) { last = new Error('empty AI reply'); continue; }
      return JSON.parse(text);
    } catch (e) { last = e; if (e.name === 'AbortError') continue; if (e instanceof SyntaxError) continue; throw e; }
    finally { clearTimeout(timer); }
  }
  throw last || new Error('AI unavailable');
}
module.exports = { callJSON };
