# Brief for cross-checking a question set (the second model)

You check one set of AI-drafted school questions. You must not see the drafter's answer key for the
multiple-choice questions: read ONLY `tests/bank/_blind/<subject>-c<class>.json`, never
`tests/bank/<subject>/…` or `tests/bank/_parts/…`.

- **mcq** items: answer each one yourself from your own knowledge: pick `A`–`D`. If the question is
  ambiguous, two options could be right, none is right, or a fact in it looks wrong, still give your best
  letter but add `"unsure": true` and a short `note` saying why.
- **short** items show a `proposedAnswer` and `keyPoints`: judge them. `"verdict": "correct"` if accurate
  and suitable for the class; `"incorrect"` (with a `note` on what is wrong) if any fact is wrong or
  misleading; `"unsure"` (with a `note`) if you can't tell.
- Be strict about facts, spellings (including Hindi in Devanagari) and age-suitability; don't be strict
  about style.

Write `tests/bank/_checks/<subject>-c<class>.json` as
`{"model": "claude-haiku", "answers": [{"id": "…", "answer": "B"}, {"id": "…", "answer": "C", "unsure": true, "note": "…"}, {"id": "…", "verdict": "correct"}, …]}`
with one entry per item (write it in one or more Write calls; if in several files, combine them into that
one file). Then run `node tests/bank-tools.mjs merge <subject> <class>` and report its counts in one line.
