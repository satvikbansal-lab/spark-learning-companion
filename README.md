# Spark

An AI learning companion for students aged 6–15 (Class 1–10), built for the ForgeX AI Hackathon at Mesa School of Business. Its mascot, Sparky, teaches any school subject in a way designed for children.

- **Study notebooks:** one chat for every subject. Concept questions use the Spark Funnel (a story first, then a closer look, then the exact answer). Maths problems are solved step by step with a check, and Gemini's Python tool verifies the numbers. A Progress tab tracks concepts as solid, learning or shaky, but only from the student's own answers.
- **Learn from Notes:** upload a PDF, photo or text file and Spark teaches from it.
- **My Thoughts:** private pages. Spark only joins a page when you switch "Talk with Spark" on.
- **Voice buddy:** talk to Sparky out loud; maths is read as words.
- Light and dark themes, switched with the bulb.

## How a question is answered

1. `spark-ai.js` routes the question with cheap keyword rules: the subject, whether it's a problem or a concept, whether the student wants it directly or is confused, and whether tools are needed.
2. The system prompt is built for the student's class and that route. Maths gets accuracy rules: restate the problem, flag missing or ambiguous information, solve one step per line, substitute back to check, and finish with an answer line.
3. Tools are attached in the API request only when they're useful. **Code execution** is used for maths and number reasoning. **Google Search** is used for time-sensitive questions such as news, current leaders and prices.
4. The reply streams back. Thought summaries are dropped. The Python the model ran becomes a "✓ Checked with a calculator" note, shown only if the code actually ran successfully. Web sources appear as links. Cut-off, blocked and failed replies are reported as such.
5. Answers render with headings, lists, tables, code blocks and LaTeX maths (KaTeX).

## Run locally

```bash
python3 -m http.server 5173
```

Open http://localhost:5173 and paste a Gemini API key in Settings (it stays in that browser).

## Deploy on Vercel

1. Import this repository in Vercel. No build settings are needed.
2. In **Settings → Environment Variables**, add `GEMINI_API_KEY` with your key from Google AI Studio.
3. Redeploy. The site then uses the server key through `/api/gemini`, and visitors don't need their own key.

`/api/gemini` only forwards the request shapes Spark sends. It only allows the code-execution and Google Search tools, adds child-safe content filters, caps output length and request size, refuses requests that don't come from the site itself, and rate-limits each visitor.

Google Search grounding depends on your Gemini plan. On the free plan it is usually refused; Spark then answers without it and says the information may be out of date.

## Tests

```bash
node --test tests/              # offline: routing, prompt, parsing, rendering, gateway (no key or network)
node tests/live-eval.mjs        # live: ~30 real questions graded for correctness (uses Gemini quota)
GEMINI_API_KEY=... node tests/live-eval.mjs   # live, straight to Google instead of the deployed site
```

Live results are saved in `tests/results/`.

Notebooks, pages and memories are saved in each visitor's browser. "What Spark remembers" shows every saved note about the student, and each one can be deleted.
