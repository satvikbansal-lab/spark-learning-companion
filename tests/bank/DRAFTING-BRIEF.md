# Brief for drafting a question set (used for every AI-drafted set in tests/bank/)

You are drafting an original practice question bank for Spark, a learning app for Indian school students
(CBSE board, NCERT books). One set = one subject for one class. Write files only.

1. **Topics.** Choose 10–14 topics matching the NCERT textbook chapters for that subject and class as you
   best know them. Classes 1–5 science and social science are EVS themes (family, food, water, plants,
   animals, travel, shelter, our country…). Classes 11–12: science = a mix of physics, chemistry and biology;
   social = history, geography, political science and economics. You can't check the official syllabus, so
   it is marked unverified: don't claim chapter numbers or book titles.
2. **Questions.** Write 520 original questions spread evenly over the topics and three levels:
   1 = recall, 2 = understanding and application, 3 = higher-order (reasoning, cause and effect, analysis,
   applying an idea to a new situation). About 75% `mcq` with exactly 4 options and one unambiguously
   correct answer; about 25% `short` with a model answer and 2–4 key points. Language suited to the class.
   Spread the correct letter roughly evenly over A–D.
3. **Accuracy rules.** Only well-established facts that standard school textbooks state. If you are not sure
   of a fact, date, number or spelling, skip that question and write a different one. No current affairs,
   no "latest/current" holders of offices, no statistics that change. No trick questions, no "all/none of the
   above", no two options that could both be right. Distractors plausible but clearly wrong. Never copy
   textbook passages or poems: write your own wording, passages and examples. Neutral, factual tone for
   history and civics; no opinions on politics or religion.
4. **English:** grammar, vocabulary, punctuation, sentence transformation, and comprehension of short
   passages you write yourself (put the passage in the question). Literature only through your own short
   passages, never quoting books. **Hindi:** everything in Devanagari: व्याकरण (वर्ण, मात्रा, संज्ञा, सर्वनाम,
   विशेषण, क्रिया, लिंग, वचन, काल, संधि, समास, उपसर्ग-प्रत्यय, मुहावरे, लोकोक्तियाँ, पर्यायवाची, विलोम,
   वाक्य शुद्धि) suited to the class, and अपठित गद्यांश/पद्यांश you write yourself.
5. **Output.** Write 5 files `tests/bank/_parts/<subject>-c<class>-p1.json` … `p5.json`, about 104
   questions each, as JSON:
   `{"model": "claude-sonnet", "topics": ["…"], "questions": [ … ]}` (topics in p1; later parts may omit it).
   MCQ: `{"topic": "…", "level": 1, "type": "mcq", "q": "…", "options": ["…","…","…","…"], "answer": "B", "explanation": "…"}`
   Short: `{"topic": "…", "level": 2, "type": "short", "q": "…", "answer": "…", "keyPoints": ["…","…"], "explanation": "…"}`
   `topic` must match a topics entry exactly. Options without "A)" prefixes. Explanations 1–2 sentences.
6. Then run `node tests/bank-tools.mjs assemble <subject> <class>`. If fewer than 500 questions are kept,
   write the missing ones into a `p6` file and assemble again. Finish with one line: kept / rejected counts.

## Subject notes (read the one for your set)

- **computer** (Computer Science and AI literacy), by class: 1–2 parts of a computer, mouse and keyboard,
  safe use; 3–5 files and folders, typing, internet safety, simple step-by-step instructions (algorithms),
  what AI is and isn't; 6–8 how computers store data, binary, spreadsheets, block coding and simple
  logic, online safety and privacy, how AI learns from data and can be wrong or biased; 9–10 Python basics
  (variables, conditions, loops, lists), networks, cyber safety, AI project cycle, data and ethics;
  11–12 Python (functions, strings, lists, dictionaries, files), Boolean logic, number systems, SQL basics,
  computer networks, societal impacts, AI and its limits. Code in questions must run exactly as written
  (Python 3); give the exact output. No brand or product claims, no "latest" versions.
- **physics / chemistry / biology** (Classes 11–12): NCERT level, also useful for JEE/NEET. Work every
  numerical answer fully; use standard constants and state any value the question needs.
- **accountancy**: NCERT Class 11–12 level (journal, ledger, trial balance, depreciation, final accounts,
  partnership, company accounts, cash flow, ratios). Amounts must add up exactly; work every figure.
- **business, economics, history, geography, polsci, psychology, sociology**: NCERT Class 11–12 level,
  textbook facts and concepts only, neutral tone, no current office-holders or changing statistics.
- **Exam practice sets** (class `0`, subject `jee-main`, `jee-adv`, `neet`, `cat` or `upsc`): ORIGINAL
  questions in the style and difficulty of that exam; never copy or closely paraphrase real past papers.
  Topics = the exam's main syllabus areas (JEE: Physics, Chemistry, Mathematics; NEET: Physics, Chemistry,
  Botany, Zoology; CAT: Quantitative Aptitude, Data Interpretation and Logical Reasoning, Verbal Ability and
  Reading Comprehension with your own passages; UPSC Prelims GS: polity, history, geography, economy,
  environment, science and technology, all static, no current affairs). Level 1 = easier, 2 = typical,
  3 = hardest typical exam questions. Use `mcq` for single-correct questions and `short` for numerical-answer
  questions (answer = the exact number with unit). For a JEE Advanced "one or more correct" question, write
  it as an `mcq` whose options are combinations (e.g. "(a) and (c) only"). Work every answer fully; if you
  are not completely sure of a key, write a different question. File names: `<exam>-c0-p1.json` …, then
  `node tests/bank-tools.mjs assemble <exam> 0`.
