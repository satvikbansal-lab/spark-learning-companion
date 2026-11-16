# My Diary + My Learning World: implementation report

Branch `learning-world` (built on the live `main`, which already had the Notion-style diary).

## How Spark is built, and what that means for this feature

Spark has no user accounts or server database. Each child's notebooks, diary and settings are stored only in their own browser (localStorage plus IndexedDB). The Vercel functions do two things:
- `/api/gemini` passes AI requests through, so the API key never reaches the browser.
- `/api/family` stores Parent View settings and activity categories in Redis.

So this feature has no server tables or logins. The "tables" in the brief became separate stores on the device:

| Brief | Where it lives |
|---|---|
| diary_entries | `S.thoughts` in localStorage `spark.v1` (existing) |
| diary_attachments | IndexedDB `spark-files`, ids `dyf:…`; the page keeps only `data-file="…"` |
| diary_tags, diary_favorites | `t.tags`, `t.fav` on each page |
| diary_versions | IndexedDB `spark-files`, record `dyv:<pageId>` (up to 30 versions per page) |
| diary_preferences | `t.font`, `t.wide`, `t.locked`, `t.cover`, `t.icon`, `t.mood`, `t.writeMs` |
| learning_profiles, learning_memories, learning_memory_sources | localStorage `spark.learn.v1`, kept apart from the diary: `memories[]`, each with `sources[] {entry, at, explicit}` |
| personalization_settings | `spark.learn.v1.enabled`, `excluded{}`, plus the parent control `diaryPersonal` |
| personalized_example_logs | `spark.learn.v1.log[]`: topic, offered and used values only (last 120) |
| extraction jobs | `spark.learn.v1.jobs{}`: page → text fingerprint, status, tries, next retry |

**Data access.** Another student's data is never on the same device, and the diary is never sent to Spark's servers. When personalisation is on, a page's text goes once to the AI through `/api/gemini` to pick out interests; the proxy doesn't keep it.

## Features completed

**My Diary** (from the earlier release, plus this branch)
- Home page:
  - today's date, a greeting, and stats (pages, words, 🔥 day streak, minutes writing)
  - templates, and optional age-based writing prompts
  - a month calendar with dots on days with pages, previous/next month, and tap a day to filter
  - tag chips, and search across titles, writing, tags and dates
  - tabs for Recents, Favourites, Moods, With Spark and Bin
  - download of the whole diary
- Editor:
  - title, automatic dates, autosave, word count and writing time
  - bold, italic, underline and strike; headings; bulleted, numbered and to-do lists
  - toggles, quotes, callouts, dividers and code
  - text colours and highlights, emoji, stickers, and pages inside pages
  - **images** (shrunk to at most 1600 px, stored in IndexedDB)
  - a **drawing pad** (colours, 3 brush sizes, eraser, undo, clear)
  - **voice notes** (MediaRecorder, up to 5 minutes, listen back before keeping)
  - **talk to type** (the browser's speech recognition; en-IN or hi-IN)
  - tags, mood, favourites, lock, fonts and full width
  - **page history** with restore, duplicate, move, the bin, and delete forever (which also removes its files and history)
- **Reliable saving**:
  - 0.4 s debounce after typing
  - an immediate save when the tab is hidden or closed (`pagehide`, `visibilitychange`, `beforeunload`)
  - a version snapshot at most every 3 minutes
  - cross-tab handling over `BroadcastChannel`: a tab that isn't typing takes the newer copy; a tab with unsaved typing asks "Keep mine / Use the other one"
- Works offline (everything is local).

**Privacy**
- Personalisation is off by default and works only after the child turns it on. Parent View can turn it off.
- No automatic AI reply to diary pages.
- **My Learning World** explains in plain words what is kept, what never is, and when text is sent to the AI.
- Three controls: the on/off switch, managing each interest and each page, and delete buttons ("Delete my learning world", "Delete all diary pages" by typing DELETE).
- Downloading the diary.
- The old feature saved free-text notes from the diary and sent them with every lesson. It is removed, and its saved notes are deleted when the app loads.
- The helpline note for a page that suggests a child may be in danger now uses Spark's on-device safety patterns, not AI. Nothing about it is stored beyond the note.

**Personal Learning Memory engine** (`spark-learnmem.js`, pure, tested)
- **Categories:** interest, activity, familiar object, experience, subject they like, subject they say is hard, and learning style.
- **Values:** 1–4 plain words; one entry per idea ("playing cricket", "cricket matches" and "Cricket" are one); a page is never stored as text.
- **Always refused, even if the AI returns them:** health and bodies, feelings, family or friendship conflict, religion, politics, money worries, sentences, digits and links.
- **Confidence:**
  - 1 page = 0.35, so it isn't used yet; 2 = 0.6, 3 = 0.75, 4+ = 0.85
  - +0.15 when the child says "I love…"; anything they add themselves = 0.95
  - × 0.7 after 90 days without a mention; × 0.5 and marked for review after 180
- **Every memory records** the pages it came from and when. "Why is this here?" shows those pages.
- **Re-reading a page** replaces what that page contributed, so nothing is duplicated.
- **Removing a page** from the diary (bin, delete forever or exclude) removes what it contributed.
- **The child's choices stick:** removed items are never re-added by the diary; corrections and their own additions are kept as theirs.
- **Background extraction:**
  - 15 s after the child stops typing, one AI call per page per version of its text (fingerprinted, so it is never repeated)
  - one job at a time, never while the child is still writing
  - retries after 30 s, 1, 2 and 4 minutes, then waits until the page changes
  - a check every minute, and "Re-read all my pages" to rebuild

**Personalised teaching** (lessons, quizzes, pictures)
- **Matching:** each question is matched to approved interests by topic. The topic is recognised from the question, with plurals ("photosynthesis" → biology, "discount" → maths and money); otherwise the subject decides. Each interest has a list of areas it suits (cycling → physics, maths, geography).
- **Choosing:** at most 2 are offered. The one used most recently is set aside so examples vary. Nothing is offered when none fits (for example, nouns), and nothing at all when personalisation is off or a parent has disabled it.
- **The tutor's instruction:** use exactly one interest if it fits naturally, never force it, and never say how you know or mention a diary. Say "Imagine…", not "Remember when you…". Keep facts exact, connect to the textbook term, and add one standard textbook example.
- **Funnel stories** can be set in the child's familiar world, starring them.
- **Quizzes:** question 1 is in the familiar setting, the middle ones in other settings, and the last is textbook-style. After a topic has used familiar examples twice, its quizzes stay standard.
- **Pictures** are built from the personalised answer, so they follow its setting.
- **Lesson log:** what was offered and what the reply actually used, for variety and for the "Recently in your lessons" list.

## AI integration changes
- `spark-ai.js`: the "PERSONAL CONTEXT" block (free-text diary notes) is replaced by `ctx.familiar` (the compact approved block), and the story rule allows a familiar setting.
- `spark-quiz.js`: `ctx.familiar` adds the familiar-to-general question ladder.
- `index.html`: adds `familiarFor()` and `quizFamiliar()`, the extraction queue (`pumpLearn`, `learnReconcile`, `scheduleThoughtLearning`) and the usage log. The settings checkbox is now the personalisation switch.
- `spark-parent.js` / `api/family.js`: a new parent control `diaryPersonal` (default allowed), shown in Parent View as "Diary-based personalisation".

## Tests passed
- `node --test tests/`: **185 pass, 0 fail**, including 12 new engine tests (`tests/learnmem.test.js`):
  - extract cricket and animals; avoid duplicates; frequency and confidence; fading
  - sensitive values refused; subject and style rules
  - exclude a page; deletion propagation
  - remove, restore, correct and add your own
  - retrieval (fractions, percentages → shopping, photosynthesis → gardening, speed → cycling, nothing for nouns), off and parent-off
  - rotation; no diary text or diary mention in the lesson context; profile; summary; retries
- **In the browser** (local, with a stand-in AI for the pipeline):
  - 8 pages read and a second run made 0 calls; cricket from 2 pages was usable and animals from 1 was not
  - the argument page was refused; no diary text in `spark.learn.v1`
  - failure → retry in 30 s → done; exclude, bin and restore update sources
  - the prompt has the block when on and not when off
  - Learning World: why, add (and a sensitive add refused), style, remove/undo, switch
  - tags, calendar, date and tag search, a picture shown after reopening (only the reference is saved)
  - page history, drawing via "/draw", both two-tab cases, saving on close, the download (10 pages, picture inside)
  - delete my learning world (pages kept); delete all (wrong word refused; pages, files and storage cleared); empty diary
- **With the real AI** (sent through the live site's AI connection):
  - extraction from a page mentioning cricket, a parents' fight, crying, a zoo trip and "fractions are hard" kept only cricket, a zoo trip and fractions (tricky)
  - fractions → a cricket bat cost split 4 ways; 20% discount → a ₹500 hoodie with ₹100 off (correct); photosynthesis → a tulsi plant; speed → a bicycle race
  - none mentioned a diary or "remember when you"

## Outstanding limitations
- **No accounts:** cross-account tests from the brief don't apply. There is no server-side diary to authorise, and moving to another device loses the diary unless the child downloads it or uses the existing backup.
- **AI training:** with personalisation on, page text goes to Google's Gemini API for extraction. Google's free tier may use API data to improve its products. To guarantee diary text is never used for training, use a **paid** Gemini key (or OpenRouter with data collection off) for `GEMINI_API_KEY`.
- **Parent control:** "Diary-based personalisation" is enforced by the app, not the server, because the server can't tell an extraction call from any other AI call.
- **Not tested with real hardware:** voice notes and talk-to-type use the browser's microphone APIs. I checked they're supported, but didn't record with a real microphone. Talk-to-type needs Chrome or Edge (Safari has partial support).
- **No per-day mastery tracking beyond notebook concepts:** fading from familiar to standard examples uses the lesson log (after 2 uses per topic), not per-question results.
- **Storage limits:** images, drawings and voice notes live in IndexedDB on this device only. They are in the HTML download as images; voice notes are listed by name.
- **Old notes deleted:** the free-text diary notes from the old feature are deleted on first load, as the new privacy rules require.

## Environment variables
No new ones. Existing: `GEMINI_API_KEY` (use a paid-tier key for the no-training guarantee), plus the existing Parent View Redis settings. No keys are in the frontend.
