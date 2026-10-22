# Spark

An AI learning companion for students aged 6–15 (Class 1–10), built for the ForgeX AI Hackathon at Mesa School of Business. Its mascot, Sparky, teaches any school subject in a way designed for children.

- **Study notebooks:** one chat for every subject. Concept questions use the Spark Funnel (a story first, then a closer look, then the exact answer). Maths problems are solved step by step with a check, and Gemini's Python tool verifies the numbers. A Progress tab tracks concepts as solid, learning or shaky, but only from the student's own answers.
- **Learn from Notes:** upload a PDF, photo or text file and Spark teaches from it.
- **My Thoughts:** private pages. Spark only joins a page when you switch "Talk with Spark" on.
- **Voice buddy:** talk to Sparky out loud. It waits for natural pauses, asks you to check anything it misheard, says what each maths step does (the equation stays on screen), and you can tap Sparky to interrupt.
- **Visual learning cards:** after each answer, Sparky opens a small interactive visual when it helps: labelled objects you can tap (a TV, a bicycle, the heart, a plant), a balance scale that solves equations step by step, fraction pizzas, a 100-square percentage grid, number lines, a circuit with a working switch, the planets in order (not to scale), step-by-step processes, side-by-side comparisons, timelines, profit and loss bars and an adjustable triangle. The model only describes the visual; `spark-visuals.js` validates it and draws it, and maths visuals are rebuilt from the question with the exact checker.
- **A room that fits the subject:** a faint maths, science, history, geography, language, writing or coding pattern sits behind the chat, decided from your own questions and steady across a conversation.
- Light and dark themes, switched with the bulb.

## How a question is answered

1. `spark-ai.js` routes the question with cheap keyword rules: the subject, whether it's a problem or a concept, whether the student wants it directly or is confused, and whether tools are needed.
2. The system prompt is built for the student's class and that route. Maths gets accuracy rules: restate the problem, flag missing or ambiguous information, solve one step per line, substitute back to check, and finish with an answer line.
3. Tools are attached in the API request only when they're useful. **Code execution** is used for maths and number reasoning. **Google Search** is used for time-sensitive questions such as news, current leaders and prices.
4. The reply streams back. Thought summaries are dropped. The Python the model ran becomes a "✓ Checked with a calculator" note, shown only if the code actually ran successfully. Web sources appear as links. Cut-off, blocked and failed replies are reported as such.
5. Answers render with headings, lists, tables, code blocks and LaTeX maths (KaTeX).

## Run locally

```bash
OPENROUTER_API_KEY=... node scripts/dev.mjs      # or GEMINI_API_KEY=...; serves http://localhost:5174 with /api/gemini
SPARK_ENV_FILE=../openrouter/.env.local node scripts/dev.mjs   # or read the key from a .env file
```

Without a server key you can also run `python3 -m http.server 5173` and paste a Gemini API key in Settings (it stays in that browser).

## Deploy on Vercel

1. Import this repository in Vercel. No build settings are needed.
2. In **Settings → Environment Variables**, add one of:
   - `GEMINI_API_KEY`: your key from Google AI Studio. Gives the maths checker (code execution), Google Search and Gemini voices.
   - `OPENROUTER_API_KEY`: reaches Google's Gemini models through OpenRouter (Google servers only). Optional `OPENROUTER_MODEL` (default `google/gemini-3.7-flash`) and `OPENROUTER_LITE_MODEL` (default `google/gemini-3.5-flash-lite`). Code execution, search and Gemini voices aren't available this way; Spark knows that, still checks answers with its own exact checker, and speaks with the browser voice.
   If both are set, `GEMINI_API_KEY` is used.
3. Redeploy. The site then uses the server key through `/api/gemini`, and visitors don't need their own key.

`/api/gemini` only forwards the request shapes Spark sends. It only allows the code-execution and Google Search tools, adds child-safe content filters, caps output length and request size, refuses requests that don't come from the site itself, and rate-limits each visitor.

Google Search grounding depends on your Gemini plan. On the free plan it is usually refused; Spark then answers without it and says the information may be out of date.

## Tests

```bash
node --test tests/              # offline: 66 tests (maths checker, routing, prompts, rendering, visuals, backgrounds, voice text, OpenRouter, gateway)
python3 tests/verify_expected.py    # recomputes every benchmark answer with Python/sympy
SPARK_URL=http://localhost:5174 MODELS=gemini-flash-latest LABEL=mine node tests/maths-eval.mjs   # 152-case maths benchmark + 8 tutoring scenarios, live
node tests/maths-report.mjs mine [other-label]   # summary and comparison
node tests/live-eval.mjs        # live: ~30 real questions graded for correctness (uses Gemini quota)
GEMINI_API_KEY=... node tests/live-eval.mjs   # live, straight to Google instead of the deployed site
```

Live results are saved in `tests/results/`.

Notebooks, pages and memories are saved in each visitor's browser. "What Spark remembers" shows every saved note about the student, and each one can be deleted.
