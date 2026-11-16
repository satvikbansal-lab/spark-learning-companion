/* Spark's Personal Learning Memory: "My Learning World".
   When the student turns it on, short, safe facts about their familiar world (interests, activities, objects,
   experiences, subjects they enjoy or find tricky, how they like to learn) are pulled from their diary pages and kept
   here, apart from the diary. Lessons then use the approved ones to build examples the student recognises.

   Rules this file enforces:
   - Only short values (a few words) are kept, never sentences from the diary. Each value records which pages it came
     from (provenance), how often and how recently it was mentioned, and whether the student removed or added it.
   - Sensitive things are refused here even if the model returns them: health, feelings and mental health, family
     problems, religion, politics, bodies, relationships, money worries, people's names.
   - One passing mention is not enough to use an interest in lessons; an explicit "I love…" or repeated mentions are.
   - Turning personalisation off means nothing from here reaches a lesson.
   Pure functions only: the app stores the result and calls the model. Runs in the browser and in Node tests. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SparkLearn = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CATS = {
    interest: { label: 'Things I enjoy', one: 'interest', icon: '⭐' },
    activity: { label: 'Activities I know', one: 'activity', icon: '🏏' },
    object: { label: 'Things around me', one: 'familiar thing', icon: '🎒' },
    experience: { label: 'Experiences I’ve had', one: 'experience', icon: '🎒' },
    subject_like: { label: 'Subjects I like', one: 'favourite subject', icon: '📚' },
    subject_hard: { label: 'Topics I find tricky', one: 'tricky topic', icon: '🧗' },
    style: { label: 'How I like to learn', one: 'learning style', icon: '💡' }
  };
  CATS.object.icon = '🧸'; CATS.experience.icon = '🗺️';
  const EXAMPLE_CATS = ['interest', 'activity', 'object', 'experience'];
  const STYLES = ['stories', 'practical examples', 'pictures and diagrams', 'step-by-step', 'games and challenges', 'real-life examples'];
  const SUBJECT_WORDS = ['maths', 'science', 'english', 'hindi', 'social studies', 'history', 'geography', 'physics', 'chemistry', 'biology', 'computers', 'art', 'music', 'reading', 'writing', 'grammar', 'fractions', 'algebra', 'geometry', 'spelling', 'tables', 'division', 'multiplication', 'percentages', 'decimals', 'map work'];

  /* ---------- what is never kept ---------- */
  const SENSITIVE = new RegExp('\\b(' + [
    // health, bodies, feelings
    'ill(ness)?', 'sick', 'fever', 'hospital', 'doctor', 'medicine', 'pills?', 'injur(y|ed|ies)', 'disease', 'cancer', 'covid', 'allerg(y|ies)', 'asthma', 'diabet\\w*', 'adhd', 'autis\\w*', 'dyslexi\\w*', 'therap\\w*', 'counsel\\w*',
    'sad(ness)?', 'cry(ing)?', 'cried', 'depress\\w*', 'anxi\\w*', 'worr\\w*', 'stress\\w*', 'lonely', 'loneliness', 'scared', 'afraid', 'fear', 'angry', 'anger', 'upset', 'hate', 'feel(ing|ings)?', 'mood', 'panic', 'nightmares?', 'self[- ]?harm', 'suicid\\w*', 'die', 'died', 'death', 'dead', 'funeral',
    'weight', 'fat', 'diet(ing)?', 'body', 'periods?', 'puberty', 'crush', '(boy|girl)friend', 'dating', 'kiss\\w*', 'love life',
    // family and conflict
    'fight\\w*', 'argu\\w*', 'divorc\\w*', 'separat\\w*', 'punish\\w*', 'beat(en|ing)?', 'hit(ting)?', 'slap\\w*', 'bull(y|ied|ying)', 'abus\\w*', 'shout\\w*', 'scold\\w*', 'grounded', 'jail', 'police',
    // beliefs, identity, money worries
    'relig\\w*', 'god', 'gods', 'pray\\w*', 'puja', 'namaz', 'church', 'temple', 'mosque', 'gurudwara', 'caste', 'politic\\w*', 'election', 'vote', 'debt', 'loan', 'poor', 'salary', 'rent'
  ].join('|') + ')\\b', 'i');
  /* A value is a few plain words: no sentences, digits, emails or links. */
  function cleanValue(v) {
    let s = String(v == null ? '' : v).toLowerCase().normalize('NFKC').replace(/[’']/g, '').replace(/[^a-z\u0900-\u097f &-]/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.replace(/^(playing|doing|going|go|play|my|a|an|the|to|i like|i love|love|likes?|enjoys?|loves?)\s+/g, '').replace(/^(playing|doing|going|my|a|an|the)\s+/, '');
    if (s.length < 3 || s.length > 32 || s.split(' ').length > 4) return '';
    if (SENSITIVE.test(s)) return '';
    return s;
  }
  /* One key per idea, so "Cricket", "playing cricket" and "cricket matches" count as the same thing. */
  const SYN = { soccer: 'football', footy: 'football', 'cricket match': 'cricket', 'cricket matches': 'cricket', 'cricket practice': 'cricket', 'football match': 'football', 'football matches': 'football', 'bike': 'cycling', 'bicycle riding': 'cycling', 'riding my bike': 'cycling', 'riding bicycle': 'cycling', 'cycle': 'cycling', 'bike riding': 'cycling', cooking: 'cooking', baking: 'baking', 'baking cakes': 'baking', 'baking a cake': 'baking', 'cake baking': 'baking', drawings: 'drawing', sketching: 'drawing', painting: 'painting', paintings: 'painting', animal: 'animals', pets: 'pets', pet: 'pets', dogs: 'dogs', dog: 'dogs', cats: 'cats', cat: 'cats', 'video games': 'video games', 'video game': 'video games', 'computer games': 'video games', gaming: 'video games', books: 'reading', 'reading books': 'reading', 'story books': 'reading', travelling: 'travel', traveling: 'travel', trips: 'travel', 'shopping trips': 'shopping', 'going shopping': 'shopping', swimmings: 'swimming', 'maths': 'maths', math: 'maths', mathematics: 'maths', 'zoo visit': 'zoo trip', 'visit to the zoo': 'zoo trip', 'trip to the zoo': 'zoo trip', zoo: 'zoo trip', plants: 'gardening', garden: 'gardening', 'growing plants': 'gardening', 'step by step': 'step-by-step', 'step-by-step explanations': 'step-by-step', 'pictures': 'pictures and diagrams', 'diagrams': 'pictures and diagrams', 'visual explanations': 'pictures and diagrams', 'practical': 'practical examples', 'story': 'stories', 'stories and examples': 'stories' };
  function keyOf(v) {
    const c = cleanValue(v); if (!c) return '';
    if (SYN[c]) return SYN[c];
    const stripped = c.replace(/\s+(matches|match|games|game|practice|lessons|class|classes|sessions?)$/, '');
    if (SYN[stripped]) return SYN[stripped];
    return stripped.length >= 3 ? stripped : c;
  }

  /* ---------- the store ---------- */
  const emptyStore = () => ({ v: 1, enabled: false, memories: [], excluded: {}, jobs: {}, log: [] });
  function fix(store) {
    const s = Object.assign(emptyStore(), store && typeof store === 'object' ? store : {});
    s.memories = (Array.isArray(s.memories) ? s.memories : []).filter(m => m && CATS[m.cat] && m.key);
    for (const m of s.memories) { m.sources = Array.isArray(m.sources) ? m.sources.filter(x => x && x.entry) : []; }
    if (!s.excluded || typeof s.excluded !== 'object') s.excluded = {};
    if (!s.jobs || typeof s.jobs !== 'object') s.jobs = {};
    if (!Array.isArray(s.log)) s.log = [];
    return s;
  }
  let seq = 0;
  const mid = () => 'm' + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  const find = (s, cat, key) => s.memories.find(m => m.cat === cat && m.key === key);

  /* Replace everything one diary page says with `items` (the model's fresh reading of it). Running it twice on the
     same page changes nothing; a page that no longer mentions something stops counting for it. */
  function absorb(store, entryId, items, now = Date.now()) {
    const s = store;
    if (s.excluded[entryId]) return { added: [], kept: 0 };
    for (const m of s.memories) m.sources = m.sources.filter(x => x.entry !== entryId);
    const added = []; let kept = 0; const seen = new Set();
    for (const it of Array.isArray(items) ? items : []) {
      const cat = it && it.category; if (!CATS[cat]) continue;
      const key = keyOf(it.value); if (!key) continue;
      if ((cat === 'subject_like' || cat === 'subject_hard') && !SUBJECT_WORDS.some(w => key.includes(w) || w.includes(key))) continue;
      if (cat === 'style' && !STYLES.includes(key)) continue;
      if (cat === 'subject_hard' && !it.explicit) continue; // only when the student actually said so
      const id = cat + ':' + key; if (seen.has(id)) continue; seen.add(id);
      let m = find(s, cat, key);
      if (m && m.removed) continue; // the student removed it: never brought back by the diary
      if (!m) { m = { id: mid(), cat, key, value: key, sources: [], manual: false, removed: false, explicit: false, created: now }; s.memories.push(m); added.push(key); }
      m.sources.push({ entry: entryId, at: now, explicit: !!it.explicit });
      m.explicit = m.sources.some(x => x.explicit);
      m.updated = now; m.lastSeen = now; kept++;
    }
    prune(s);
    return { added, kept };
  }
  /* Memories that no page supports any more disappear, unless the student added them or removed them (a removal is
     kept as a small marker so the diary can't bring it back). */
  function prune(s) {
    s.memories = s.memories.filter(m => m.manual || m.removed || m.sources.length);
    for (const m of s.memories) if (m.sources.length) { m.lastSeen = Math.max(...m.sources.map(x => x.at)); m.explicit = m.sources.some(x => x.explicit); }
  }
  /* A page was deleted, binned or excluded: everything it contributed goes. */
  function forgetEntry(store, entryId) { for (const m of store.memories) m.sources = m.sources.filter(x => x.entry !== entryId); delete store.jobs[entryId]; prune(store); }
  function setExcluded(store, entryId, on) { if (on) { store.excluded[entryId] = true; forgetEntry(store, entryId); } else delete store.excluded[entryId]; }
  function remove(store, id) { const m = store.memories.find(x => x.id === id); if (!m) return; m.removed = true; m.manual = false; m.sources = []; m.updated = Date.now(); }
  function restoreMemory(store, id) { const m = store.memories.find(x => x.id === id); if (m) { m.removed = false; if (!m.sources.length) m.manual = true; } prune(store); }
  function addManual(store, cat, value, now = Date.now()) {
    if (!CATS[cat]) return null; const key = keyOf(value); if (!key) return null;
    if (cat === 'style' && !STYLES.includes(key)) return null;
    let m = find(store, cat, key);
    if (!m) { m = { id: mid(), cat, key, value: key, sources: [], created: now }; store.memories.push(m); }
    Object.assign(m, { manual: true, removed: false, updated: now, lastSeen: now });
    return m;
  }
  /* The student corrects a value ("football" → "basketball"). The old one is marked removed so the diary doesn't
     re-add it, and the new one is kept as theirs. */
  function correct(store, id, value, now = Date.now()) {
    const m = store.memories.find(x => x.id === id); if (!m) return null;
    const key = keyOf(value); if (!key || key === m.key) return key ? m : null;
    const n = addManual(store, m.cat, key, now); if (!n) return null;
    remove(store, id); return n;
  }
  function wipe(store) { const keepOn = store.enabled; Object.assign(store, emptyStore(), { enabled: keepOn }); }

  /* ---------- confidence ---------- */
  const DAY = 864e5;
  function confidence(m, now = Date.now()) {
    if (m.removed) return 0;
    if (m.manual) return 0.95;
    const pages = new Set(m.sources.map(x => x.entry)).size;
    let c = pages >= 4 ? 0.85 : pages === 3 ? 0.75 : pages === 2 ? 0.6 : pages === 1 ? 0.35 : 0;
    if (m.explicit) c += 0.15;
    const days = (now - (m.lastSeen || m.created || now)) / DAY;
    if (days > 180) c *= 0.5; else if (days > 90) c *= 0.7;
    return Math.round(Math.min(0.98, c) * 100) / 100;
  }
  const frequency = m => { const n = new Set(m.sources.map(x => x.entry)).size; return n >= 4 ? 'high' : n >= 2 ? 'medium' : n === 1 ? 'low' : (m.manual ? 'added by you' : 'none'); };
  const USE_AT = 0.5;
  const usable = (m, now) => !m.removed && confidence(m, now) >= USE_AT;
  const stale = (m, now = Date.now()) => !m.manual && !m.removed && (now - (m.lastSeen || 0)) / DAY > 180;

  /* The student-facing and lesson-facing view. */
  function profile(store, now = Date.now()) {
    const live = store.memories.filter(m => !m.removed);
    const item = m => ({ id: m.id, category: m.cat, name: m.value, confidence: confidence(m, now), frequency: frequency(m), last_mentioned: m.lastSeen ? new Date(m.lastSeen).toISOString().slice(0, 10) : null, sources: m.sources.map(x => x.entry), manual: !!m.manual, usable: usable(m, now), review: stale(m, now) });
    const by = cat => live.filter(m => m.cat === cat).map(item).sort((a, b) => b.confidence - a.confidence);
    const out = { enabled: !!store.enabled, categories: {} };
    for (const c of Object.keys(CATS)) out.categories[c] = by(c);
    out.removed = store.memories.filter(m => m.removed).map(m => ({ id: m.id, category: m.cat, name: m.value }));
    return out;
  }

  /* ---------- choosing what fits a lesson ---------- */
  /* Which school areas each familiar thing makes good examples for. Unknown things get a weaker, general fit. */
  const FIT = {
    cricket: 'maths physics stats', football: 'maths physics geometry', basketball: 'maths physics geometry', badminton: 'physics maths', tennis: 'physics maths', hockey: 'physics maths', kabaddi: 'maths physics', running: 'physics maths biology', swimming: 'physics biology maths', cycling: 'physics maths geography', skating: 'physics', athletics: 'physics maths',
    shopping: 'maths money', 'pocket money': 'maths money', baking: 'maths chemistry', cooking: 'maths chemistry biology', gardening: 'biology science geography', animals: 'biology science geography', pets: 'biology science', dogs: 'biology science', cats: 'biology science', birds: 'biology science', 'zoo trip': 'biology geography science', insects: 'biology', fishing: 'biology physics',
    drawing: 'geometry maths art', painting: 'geometry art science', crafts: 'geometry maths', origami: 'geometry maths', lego: 'geometry maths physics', building: 'geometry physics', robots: 'physics computers maths', coding: 'computers maths logic', 'video games': 'maths logic computers physics', 'board games': 'maths logic', chess: 'maths logic', puzzles: 'maths logic', music: 'physics maths english', singing: 'english physics', dancing: 'physics maths', guitar: 'physics maths', piano: 'physics maths',
    reading: 'english hindi history', stories: 'english hindi history', writing: 'english hindi', 'space': 'physics science geography', stars: 'physics science', rockets: 'physics', dinosaurs: 'biology history', weather: 'geography science', rain: 'geography science', travel: 'geography maths history social', 'school trip': 'geography history social', trains: 'maths physics geography', cars: 'physics maths', planes: 'physics geography', mountains: 'geography', beach: 'geography science', camping: 'geography science', festivals: 'social history', movies: 'english', photography: 'physics art'
  };
  const AREA_OF = { math: 'maths', reasoning: 'maths logic', science: 'science biology physics chemistry', english: 'english', hindi: 'hindi', social: 'geography history social', gk: 'geography history science', writing: 'english' };
  const TOPIC_AREAS = [
    [/\b(speed|velocity|distance|force|motion|friction|gravity|energy|work done|power|pressure|momentum|light|reflection|sound|electric\w*|magnet\w*|current|circuit|lever|pulley)(?:s|es)?\b/i, 'physics'],
    [/\b(photosynthesis|plants?|leaf|leaves|roots?|seeds?|cells?|food chain|ecosystem|habitat|animals?|digest\w*|heart|blood|breath\w*|nutrition|organism|living|germinat\w*)(?:s|es)?\b/i, 'biology'],
    [/\b(acid|base|salt|reaction|chemical|mixture|solution|dissolv\w*|states of matter|melting|boiling|evaporat\w*|atom|molecule|element|compound)(?:s|es)?\b/i, 'chemistry'],
    [/\b(map|direction|north|south|east|west|latitude|longitude|continent|country|river|mountain|climate|weather|time zone|scale)(?:s|es)?\b/i, 'geography'],
    [/\b(angle|triangle|circle|shape|area|perimeter|symmetry|polygon|line|parallel|geometry|volume)(?:s|es)?\b/i, 'geometry maths'],
    [/\b(average|mean|median|mode|data|graph|chart|probability|statistics)(?:s|es)?\b/i, 'stats maths'],
    [/\b(fraction|percent\w*|ratio|decimal|profit|loss|discount|interest|money|price|cost|measure\w*|unit)(?:s|es)?\b/i, 'maths money'],
    [/\b(history|king|empire|war|freedom|independence|ancient|medieval)(?:s|es)?\b/i, 'history'],
    [/\b(poem|story|grammar|noun|verb|adjective|tense|essay|letter|paragraph)(?:s|es)?\b/i, 'english']
  ];
  /* The specific topic wins when it can be recognised ("photosynthesis" is biology, whatever the subject says);
     otherwise the subject decides. Number-based topics also count as maths. */
  function areasFor(subject, text) {
    const topic = new Set();
    for (const [rx, ar] of TOPIC_AREAS) if (rx.test(text || '')) ar.split(' ').forEach(x => topic.add(x));
    const a = topic.size ? topic : new Set(String(AREA_OF[subject] || '').split(' ').filter(Boolean));
    a.primary = [...a][0];
    if (subject === 'math' || subject === 'reasoning') a.add('maths');
    if (a.has('geometry') || a.has('stats') || a.has('money')) a.add('maths');
    return a;
  }
  /* How well a familiar thing suits these areas: best when it is a strong example for the main area of the topic. */
  function fitScore(key, areas) {
    const f = FIT[key]; if (!areas.size) return 0;
    if (!f) return 0.35; // an unfamiliar interest: weak general fit
    const parts = f.split(' '); let best = 0, hits = 0;
    parts.forEach((p, i) => { if (!areas.has(p)) return; hits++; const base = p === areas.primary ? 1 : 0.7; best = Math.max(best, base - 0.1 * i); });
    return Math.round((best + (hits > 1 ? 0.05 * (hits - 1) : 0)) * 100) / 100; // fitting several parts of the topic wins a tie
  }
  /* The approved memories that fit this lesson, best first, at most `max`. Recently used ones are rested so lessons
     don't keep using cricket. Nothing comes back when personalisation is off. */
  function retrieve(store, opts = {}) {
    if (!store || !store.enabled || opts.allowed === false) return { familiar: [], styles: [], tricky: [] };
    const now = opts.now || Date.now(), areas = areasFor(opts.subject, opts.text);
    const recent = (store.log || []).slice(-6).flatMap(l => l.used || []);
    const scored = store.memories.filter(m => EXAMPLE_CATS.includes(m.cat) && usable(m, now)).map(m => {
      const fit = fitScore(m.key, areas); const rest = recent.filter(k => k === m.key).length;
      return { m, score: fit * confidence(m, now) * (rest ? Math.pow(0.5, rest) : 1), fit };
    }).filter(x => x.fit >= 0.35 && x.score > 0.12).sort((a, b) => b.score - a.score);
    const familiar = []; for (const x of scored) { if (!familiar.includes(x.m.value)) familiar.push(x.m.value); if (familiar.length >= (opts.max || 3)) break; }
    const styles = store.memories.filter(m => m.cat === 'style' && usable(m, now)).map(m => m.value).slice(0, 3);
    const tricky = store.memories.filter(m => m.cat === 'subject_hard' && usable(m, now) && [...areas].some(a => m.key.includes(a) || a.includes(m.key) || (opts.text || '').toLowerCase().includes(m.key))).map(m => m.value).slice(0, 2);
    return { familiar, styles, tricky };
  }
  /* The compact instruction added to Sparky's prompt. Empty when there's nothing approved and relevant. */
  function teachingContext(r) {
    if (!r || (!r.familiar.length && !r.styles.length && !r.tricky.length)) return '';
    const lines = ['THEIR FAMILIAR WORLD (short notes the student approved for personalising lessons; never quote or explain where they came from):'];
    if (r.familiar.length) lines.push(`- Familiar to them and relevant here: ${r.familiar.join(', ')}.`);
    if (r.styles.length) lines.push(`- They learn best with: ${r.styles.join(', ')}.`);
    if (r.tricky.length) lines.push(`- They have said this area feels tricky: ${r.tricky.join(', ')}. Go gently and check each step.`);
    if (r.familiar.length) lines.push('HOW TO USE IT: if one of these fits the concept naturally, build your example, story or word problem around exactly ONE of them (it can star the student: "Imagine you are batting…"). If none fits, use a standard example; never force it. Never say how you know, never mention a diary, journal, notes or anything they wrote, and never claim they did something specific ("Imagine…" or "If you…", not "Remember when you…"). Every fact and number stays exactly correct. Then connect the familiar example to the real textbook term, and include one standard textbook-style example as well so the idea works beyond the familiar setting.');
    return lines.join('\n');
  }
  /* Which of the offered memories the reply actually used, for the lesson log and to rest them next time. */
  function usedIn(text, offered) { const t = ' ' + String(text || '').toLowerCase() + ' '; return (offered || []).filter(v => new RegExp('\\b' + v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/s$/, '') + '', 'i').test(t)); }
  function logLesson(store, topic, offered, used, now = Date.now()) { store.log.push({ at: now, topic: String(topic || '').slice(0, 60), offered: offered || [], used: used || [] }); if (store.log.length > 120) store.log = store.log.slice(-120); }

  /* ---------- extraction ---------- */
  const EXTRACT_SCHEMA = { type: 'OBJECT', properties: { items: { type: 'ARRAY', items: { type: 'OBJECT', properties: { category: { type: 'STRING', enum: Object.keys(CATS) }, value: { type: 'STRING' }, explicit: { type: 'BOOLEAN' } }, required: ['category', 'value', 'explicit'] } } }, required: ['items'] };
  function extractPrompt(text, age) {
    return `You help a tutor pick familiar examples for a student ${age || ''}. Below is one page the student wrote. Find ONLY safe, general things from their everyday world that could make school examples relatable. Do not reply to the student, judge, summarise or advise.

Return "items", each with:
- category: interest (sports, music, animals, games, drawing, reading, science, technology, travel, cooking…), activity (things they do: playing cricket, cycling, swimming, painting, gardening, baking, shopping, travelling…), object (familiar things: cricket bat, football, bicycle, guitar, kitchen scale…), experience (a kind of event: school trip, sports match, birthday party, science fair, family outing, zoo trip…), subject_like (a school subject they say they enjoy), subject_hard (a school topic they SAY they find hard), style (how they say they like to learn: stories, practical examples, pictures and diagrams, step-by-step, games and challenges, real-life examples).
- value: 1-3 plain lowercase words naming the thing ("cricket", "baking", "school trip"). Never a sentence, never what happened, never a quote.
- explicit: true only if they clearly say they love, enjoy, often do, or find it hard ("I love cricket", "I play football every day", "fractions are so hard").

NEVER include: names of people, places they live or study, family situations, arguments or friendships, feelings or moods, health or bodies, religion or beliefs, politics, money worries, secrets, or anything private or sad. If the page is about something like that, return no items for it. Skip one-off details that wouldn't help a lesson. At most 8 items. If nothing fits, return an empty list.

PAGE:
"""${String(text || '').slice(0, 6000)}"""`;
  }
  /* A short fingerprint of a page's text, so the same text is never sent twice. */
  function hash(text) { let h = 5381; const s = String(text || ''); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; }
  /* Retry timing for a failed extraction: 30 s, 1 min, 2 min, 4 min, then give up until the page changes. */
  const retryAt = (tries, now = Date.now()) => tries >= 5 ? null : now + 30000 * Math.pow(2, Math.max(0, tries - 1));

  /* The friendly sentence at the top of My Learning World. */
  function summary(store, now = Date.now()) {
    const top = store.memories.filter(m => EXAMPLE_CATS.includes(m.cat) && usable(m, now)).sort((a, b) => confidence(b, now) - confidence(a, now)).slice(0, 3).map(m => m.value);
    if (!top.length) return '';
    const list = top.length === 1 ? top[0] : top.slice(0, -1).join(', ') + ' and ' + top[top.length - 1];
    return `Spark knows you enjoy ${list}. It can use ${top.length === 1 ? 'it' : 'these'} to make your lessons more interesting.`;
  }

  return { CATS, EXAMPLE_CATS, STYLES, SENSITIVE, cleanValue, keyOf, emptyStore, fix, absorb, prune, forgetEntry, setExcluded, remove, restoreMemory, addManual, correct, wipe, confidence, frequency, usable, stale, USE_AT, profile, areasFor, fitScore, retrieve, teachingContext, usedIn, logLesson, EXTRACT_SCHEMA, extractPrompt, hash, retryAt, summary };
});
