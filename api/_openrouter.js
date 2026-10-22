// Gemini through OpenRouter. Used by api/gemini.js when the site has OPENROUTER_API_KEY instead of GEMINI_API_KEY.
// Spark's browser code speaks Gemini's request format; this file translates it to OpenRouter's chat format and
// translates the answer (streamed or whole) back, so nothing in the app has to change.
// Only Google models, served only by Google (Vertex or AI Studio), as OpenRouter's provider routing allows.
// Gemini's own code-execution and Google Search tools aren't available through OpenRouter: they are dropped,
// and GET /api/gemini tells the app, so Sparky never claims a calculator or web check that didn't happen.
// Sparky's voice uses Google's Gemini TTS through OpenRouter's speech endpoint (same voice names, e.g. Leda).
// The file name starts with "_" so Vercel doesn't publish it as its own endpoint.

const BASE = 'https://openrouter.ai/api/v1';
const MAIN = process.env.OPENROUTER_MODEL || 'google/gemini-3.7-flash';
const LITE = process.env.OPENROUTER_LITE_MODEL || 'google/gemini-3.5-flash-lite';
const PROVIDER = { only: ['google-vertex', 'google-ai-studio'], allow_fallbacks: false };
const TTS = process.env.OPENROUTER_TTS_MODEL || 'google/gemini-3.8-flash-tts';
const VOICES = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'];
// Delivery is sent as instructions, never inside the text, so it isn't read aloud.
const VOICE_STYLE = 'Speak warmly and naturally, like a kind, friendly older friend explaining something to a child. Normal pace, clear, with natural pauses between sentences. Not over-excited.';

/* Spark asks for Gemini model names; lighter background jobs (progress, quizzes) ask for "lite" ones. */
function modelFor(geminiModel) {
  if (/tts/.test(geminiModel)) return null; // voices go through speak() below, not the chat endpoint
  return /lite/.test(geminiModel) ? LITE : MAIN;
}
/* Gemini's schema types are upper-case ("OBJECT"); JSON Schema wants lower-case. */
function jsonSchema(s) {
  if (Array.isArray(s)) return s.map(jsonSchema);
  if (!s || typeof s !== 'object') return s;
  const out = {};
  for (const [k, v] of Object.entries(s)) out[k] = k === 'type' && typeof v === 'string' ? v.toLowerCase() : jsonSchema(v);
  return out;
}
function partsToContent(parts, role) {
  const out = [];
  for (const p of parts) {
    if (typeof p.text === 'string') out.push({ type: 'text', text: p.text });
    else if (p.inlineData) {
      const { mimeType, data } = p.inlineData;
      if (mimeType === 'text/plain') out.push({ type: 'text', text: Buffer.from(data, 'base64').toString('utf8') });
      else if (mimeType === 'application/pdf') out.push({ type: 'file', file: { filename: 'notes.pdf', file_data: `data:${mimeType};base64,${data}` } });
      else out.push({ type: 'image_url', image_url: { url: `data:${mimeType};base64,${data}` } });
    } else if (p.executableCode || p.codeExecutionResult) continue;
  }
  // Earlier assistant turns are plain text.
  if (role === 'assistant' || out.every(c => c.type === 'text')) return out.map(c => c.text).join('\n');
  return out;
}
/* Gemini request body → OpenRouter chat request. Returns null for a model OpenRouter can't serve here. */
function toChat(geminiModel, body, stream) {
  const model = modelFor(geminiModel); if (!model) return null;
  const messages = [];
  const sys = body.systemInstruction && body.systemInstruction.parts.map(p => p.text || '').join('\n');
  if (sys) messages.push({ role: 'system', content: sys });
  for (const c of body.contents) {
    const role = c.role === 'model' ? 'assistant' : 'user';
    messages.push({ role, content: partsToContent(c.parts, role) });
  }
  const g = body.generationConfig || {};
  const req = { model, messages, stream: !!stream, provider: PROVIDER };
  if (g.maxOutputTokens) req.max_tokens = g.maxOutputTokens;
  if (typeof g.temperature === 'number') req.temperature = g.temperature;
  if (g.responseSchema) req.response_format = { type: 'json_schema', json_schema: { name: 'result', strict: false, schema: jsonSchema(g.responseSchema) } };
  else if (g.responseMimeType === 'application/json') req.response_format = { type: 'json_object' };
  return req;
}
const FINISH = { stop: 'STOP', length: 'MAX_TOKENS', content_filter: 'SAFETY', error: 'OTHER', tool_calls: 'STOP' };
const geminiChunk = (text, finish, model) => ({ candidates: [Object.assign({ content: { role: 'model', parts: text ? [{ text }] : [] } }, finish ? { finishReason: FINISH[finish] || 'OTHER' } : {})], modelVersion: model });

/* Sparky's voice: a Gemini TTS request becomes an OpenRouter speech request. Gemini TTS only returns raw PCM
   (16-bit, 24 kHz, mono), which goes back labelled the way Gemini labels it, so the app's player handles it as before. */
function toSpeech(body) {
  const input = (body.contents || []).flatMap(c => c.parts || []).map(p => p.text || '').join(' ').trim().slice(0, 3000);
  const asked = body.generationConfig && body.generationConfig.speechConfig && body.generationConfig.speechConfig.voiceConfig && body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig && body.generationConfig.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName;
  return { model: TTS, input, voice: VOICES.includes(asked) ? asked : 'Leda', instructions: VOICE_STYLE, response_format: 'pcm' };
}
async function speak(res, { body, key, signal }) {
  const req = toSpeech(body);
  if (!req.input) return res.status(400).json({ error: { code: 400, message: 'Nothing to say.' } });
  let up;
  try {
    up = await fetch(`${BASE}/audio/speech`, { method: 'POST', signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Spark' }, body: JSON.stringify(req) });
  } catch (e) { return res.status(502).json({ error: { code: 502, message: 'Could not reach OpenRouter.' } }); }
  if (!up.ok) {
    let msg = ''; try { const j = await up.json(); msg = (j.error && j.error.message) || ''; } catch (e) {}
    return res.status(up.status).json({ error: { code: up.status, message: msg || 'The voice is unavailable right now.' } });
  }
  const audio = Buffer.from(await up.arrayBuffer());
  if (!audio.length) return res.status(502).json({ error: { code: 502, message: 'The voice came back empty.' } });
  return res.status(200).json({ candidates: [{ content: { role: 'model', parts: [{ inlineData: { mimeType: 'audio/L16;codec=pcm;rate=24000', data: audio.toString('base64') } }] }, finishReason: 'STOP' }], modelVersion: TTS });
}

/* Sends the request and writes a Gemini-shaped reply to res (a Node/Vercel response). */
async function forward(res, { model: geminiModel, stream, body, key, signal }) {
  if (/tts/.test(geminiModel)) return speak(res, { body, key, signal });
  const chat = toChat(geminiModel, body, stream);
  if (!chat) return res.status(501).json({ error: { code: 501, message: 'That model is not available through OpenRouter.' } });
  let up;
  try {
    up = await fetch(`${BASE}/chat/completions`, { method: 'POST', signal, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Spark' }, body: JSON.stringify(chat) });
  } catch (e) { return res.status(502).json({ error: { code: 502, message: 'Could not reach OpenRouter.' } }); }
  if (!up.ok) {
    let msg = ''; try { const j = await up.json(); msg = (j.error && j.error.message) || ''; } catch (e) {}
    // 402 = the OpenRouter account is out of credits; the app shows the message instead of retrying.
    return res.status(up.status).json({ error: { code: up.status, message: up.status === 402 ? 'Spark’s AI credits have run out. Ask the site owner to top them up.' : msg || 'OpenRouter error.' } });
  }
  if (!stream) {
    const j = await up.json();
    const ch = (j.choices || [])[0] || {};
    if (j.error) return res.status(502).json({ error: { code: 502, message: j.error.message || 'OpenRouter error.' } });
    return res.status(200).json(geminiChunk((ch.message && ch.message.content) || '', ch.finish_reason || 'stop', j.model));
  }
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream');
  const send = o => res.write(`data: ${JSON.stringify(o)}\r\n\r\n`);
  const dec = new TextDecoder(); let buf = '', finished = false;
  try {
    for await (const chunk of up.body) {
      buf += dec.decode(chunk, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue; // ": OPENROUTER PROCESSING" keep-alives and blank lines
        const data = line.slice(5).trim(); if (!data || data === '[DONE]') continue;
        let j; try { j = JSON.parse(data); } catch (e) { continue; }
        if (j.error) { send({ error: { code: j.error.code || 502, message: j.error.message || 'The model stopped unexpectedly.' } }); finished = true; continue; }
        const ch = (j.choices || [])[0]; if (!ch || finished) continue;
        const text = ch.delta && ch.delta.content;
        if (text || ch.finish_reason) send(geminiChunk(text || '', ch.finish_reason, j.model));
        if (ch.finish_reason) finished = true; // the usage chunk repeats finish_reason; ignore the repeat
      }
    }
  } catch (e) { if (!finished) send({ error: { code: 504, message: 'The connection to the model dropped.' } }); }
  res.end();
}

module.exports = { toChat, toSpeech, forward, modelFor, jsonSchema, MAIN, LITE, TTS };
