# Spark

An AI learning companion for students aged 6–15 (Class 1–10), built for the ForgeX AI Hackathon at Mesa School of Business. Its mascot, Sparky, teaches any school subject in a way designed for children.

- **Study notebooks:** one chat for every subject. Concept questions use the Spark Funnel (a story first, then a closer look, then the exact answer). Maths problems are solved step by step with a check, and Gemini's Python tool verifies the numbers. A Progress tab tracks concepts as solid, learning or shaky, but only from the student's own answers.
- **Learn from Notes:** upload a PDF, photo or text file and Spark teaches from it.
- **My Thoughts:** private pages. Spark only joins a page when you switch "Talk with Spark" on.
- **Voice buddy:** talk to Sparky out loud. It waits for natural pauses, asks you to check anything it misheard, says what each maths step does (the equation stays on screen), and you can tap Sparky to interrupt.
- **Quiz cards after every lesson:** when Sparky finishes teaching something (the funnel's final stage, a worked solution, an explanation, a part of uploaded notes), a four-choice quiz card checks what the student understood, one question at a time. Right answers get a small party-popper around Sparky (once; never replayed, and a still 🎉 with reduced motion) and praise that's honest about hints. Wrong answers get the likely misconception and a hint, then an easier question, then the answer; never a red screen. "🎯 Quiz me" (or typing "quiz me on fractions") starts one any time. Greetings, jokes, hints and the student's own answers never trigger one. The engine is `spark-quiz.js`: maths answer keys are recalculated exactly (a question whose key can't be confirmed is dropped), equivalent answers count (8, x = 8, 16/2, 8 cm), and every result saved is a real answer.
- **Study packs from notes:** the Study pack tab turns an upload into units with page numbers, key terms, formulas, worked examples, common mistakes, memory tricks, long-answer practice, flashcards and a chapter quiz with an answer key. Sparky's additions are labelled, unreadable parts are listed instead of guessed, and everything is editable and printable. Modes: learn part by part, revise, practise, mock test (marked at the end) and review mistakes.
- **Teacher workspace:** make assessments, lesson plans and student notes from an upload or a topic; edit every question; approve (which re-checks each question) before sharing as a link students open in their own Spark. Students' results come back as a code the teacher pastes in, for completion and the class's most common mistakes, plus support or stretch follow-up practice. There are no accounts or server database, so no class lists, invitations or automatic tracking.
- **Visual learning cards:** after each answer, Sparky opens a small interactive visual when it helps: labelled objects you can tap (a TV, a bicycle, the heart, a plant), a balance scale that solves equations step by step, fraction pizzas, a 100-square percentage grid, number lines, a circuit with a working switch, the planets in order (not to scale), step-by-step processes, side-by-side comparisons, timelines, profit and loss bars and an adjustable triangle. The model only describes the visual; `spark-visuals.js` validates it and draws it, and maths visuals are rebuilt from the question with the exact checker.
- **Real pictures for every question:** 3-4 free, openly licensed photos from Wikipedia/Wikimedia Commons under each answer (tap for a bigger view with the photographer's credit and licence). Only article titles or the question's key words are sent to Wikipedia, never the whole message; private My Thoughts pages never fetch pictures. No key and no cost.
- **A room that fits the subject:** a faint maths, science, history, geography, language, writing or coding pattern sits behind the chat, decided from your own questions and steady across a conversation.
- **Learn, My Study Space, My Progress:** the home screen is a launchpad (continue learning, learn from my notes, learn something new, practise for my exam) with recent topics, revision suggestions, recent quizzes and a streak, shown only when there is real data behind them.
- **Parent View, protected on the server:** a parent sets a 6–8 digit parent PIN (hashed with scrypt on the server, never stored in the browser; escalating lockouts; a one-time recovery code; a reset without it waits 24 hours and stays in the history). Unlocking gives an HttpOnly session cookie; closing, reloading or 5 idle minutes locks it. Sections: **Home** (today and the chosen period, measured tiles with definitions, one priority insight and one action, milestones), **Learning journey** (every topic with status, evidence, confidence and a next step; a status only with 3+ quiz answers, else “Not enough data”), **Strengths & gaps**, **Reports** (daily and weekly, any date in the last 45 days, facts apart from the labelled AI summary, trends only with comparable data), **Ask Spark** (answers only from the last 30 days of the record, with the evidence it used), **Activity & privacy** (a timeline of learning activity, never messages), **Safety & settings** (each control marked as enforced by the server, an app setting, or not available; loosening a protection needs confirmation). One status rule is used everywhere, so a topic never shows two different statuses.
- **Content & safety controls, enforced by the server:** homework help (guide / hints first / direct), extra care on sensitive topics, class, explanation style, language, web lookups, voice, uploads and fun extras. Core child-safety rules can’t be switched off. A safety check on each message adds a caring response where needed (with India helplines Tele-MANAS 14416 and Childline 1098) and logs only the category, time and what Spark did, never the message.
- Seven themes (Light, Warm light, Sunshine, Ocean, Forest, Ambient, Dark), switched with the bulb or in Settings. One more tap after Dark starts a 30-second disco: DJ Sparky moonwalks in and DJs to his own beat (made by the browser, no music files; "🔊 Music on" turns it off), then a crew of seven coloured Sparkys runs in and dances cute routines on the beat while the lights blink (never faster than twice a second) and lasers sweep. The crew runs off, DJ Sparky waves goodbye and the room goes back to Light. Tap Sparky, the bulb, "Stop the party" or Esc to end it early.

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

## Parent View storage

Parent View needs a small database: in Vercel, **Storage → Create Database → Upstash for Redis**, connected to this project (it adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`). Optional: `SPARK_PIN_PEPPER`, a long random secret mixed into PIN hashes. Without the database, Parent View says it isn’t set up; it never falls back to a browser-only lock. Locally, `scripts/dev.mjs` uses an in-memory store that forgets everything when it stops.

Limits, stated plainly: there are no accounts, so whoever sets the PIN first controls Parent View; activity is recorded by the app on the child’s device; the controls apply to everything done in Spark but can’t stop a child using another website.

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
node --test tests/              # offline: 139 tests (maths checker, routing, prompts, rendering, visuals, quiz engine, study packs, teacher review, Parent View security, controls, safety, reports, OpenRouter, gateway)
python3 tests/verify_expected.py    # recomputes every benchmark answer with Python/sympy
SPARK_URL=http://localhost:5174 MODELS=gemini-flash-latest LABEL=mine node tests/maths-eval.mjs   # 152-case maths benchmark + 8 tutoring scenarios, live
node tests/maths-report.mjs mine [other-label]   # summary and comparison
node tests/live-eval.mjs        # live: ~30 real questions graded for correctness (uses Gemini quota)
GEMINI_API_KEY=... node tests/live-eval.mjs   # live, straight to Google instead of the deployed site
```

Live results are saved in `tests/results/`.

Notebooks, pages and memories are saved in each visitor's browser. "What Spark remembers" shows every saved note about the student, and each one can be deleted.
