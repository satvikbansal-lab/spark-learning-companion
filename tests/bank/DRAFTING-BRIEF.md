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
