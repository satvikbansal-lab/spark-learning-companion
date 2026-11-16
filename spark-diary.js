/* My Diary: the student's private pages, laid out like Notion.
   Every page has its own icon, cover, mood and font, can hold sub-pages, and is written in blocks: type "/" for the
   block menu, use Markdown shortcuts ("# ", "- ", "[] ", "> "), drag a block by its handle, select text to style it.
   Pages are still stored as `html` on the existing thought objects, so Spark's optional page chat and quiet learning
   keep working, and older pages open unchanged. Nothing here talks to the network.
   This file runs before the main script; it only touches the app's globals (S, save, render, …) when called. */
const Diary = (() => {
  'use strict';
  /* ---------- look ---------- */
  const COVERS = {
    sunset: ['Sunset', 'linear-gradient(120deg,#ff9a8b 0%,#ff6a88 55%,#ff99ac 100%)'],
    ocean: ['Ocean', 'linear-gradient(120deg,#2af598 0%,#009efd 100%)'],
    candy: ['Candy floss', 'linear-gradient(120deg,#fbc2eb 0%,#a6c1ee 100%)'],
    space: ['Outer space', 'radial-gradient(2px 2px at 20% 30%,#fff 50%,transparent 51%),radial-gradient(1.5px 1.5px at 70% 60%,#fff 50%,transparent 51%),radial-gradient(2px 2px at 85% 20%,#fff 50%,transparent 51%),radial-gradient(1px 1px at 40% 80%,#fff 50%,transparent 51%),linear-gradient(135deg,#0f0c29,#302b63 60%,#24243e)'],
    jungle: ['Jungle', 'linear-gradient(120deg,#56ab2f 0%,#a8e063 100%)'],
    mango: ['Mango', 'linear-gradient(120deg,#f6d365 0%,#fda085 100%)'],
    galaxy: ['Galaxy', 'linear-gradient(120deg,#7f00ff 0%,#e100ff 100%)'],
    sky: ['Sky', 'linear-gradient(180deg,#89f7fe 0%,#66a6ff 100%)'],
    rainbow: ['Rainbow', 'linear-gradient(90deg,#ff7b7b,#ffb86b,#ffe66b,#7bf29a,#6bc6ff,#b38bff)'],
    dots: ['Polka dots', 'radial-gradient(circle,rgba(255,255,255,.55) 3px,transparent 4px) 0 0/22px 22px,linear-gradient(120deg,#ff758c,#ff7eb3)'],
    stripes: ['Stripes', 'repeating-linear-gradient(45deg,#ffd86f 0 18px,#fc6262 18px 36px)'],
    mint: ['Mint', 'linear-gradient(120deg,#d4fc79 0%,#96e6a1 100%)'],
    night: ['Night', 'linear-gradient(120deg,#232526 0%,#414345 100%)'],
    peach: ['Peach', 'linear-gradient(120deg,#ffecd2 0%,#fcb69f 100%)']
  };
  const EMOJI = {
    'Smileys': '😀 😄 😁 😊 🙂 😎 🤩 🥳 😇 🤓 🤔 😴 🥹 😂 🤗 😌 😋 🤪 😜 🙃'.split(' '),
    'Animals': '🐶 🐱 🐼 🦊 🐯 🦁 🐸 🐵 🐧 🦄 🐢 🐬 🦋 🐝 🐞 🦉 🐘 🦒 🐙 🐳'.split(' '),
    'Nature': '🌸 🌻 🌈 ☀️ 🌙 ⭐ 🌟 ✨ ⚡ 🔥 🌊 🍀 🌵 🌴 🍁 ❄️ ☁️ 🌍 🌺 🌼'.split(' '),
    'Food': '🍎 🍓 🍉 🍌 🥭 🍕 🍔 🍟 🍩 🍪 🍫 🍦 🎂 🧁 🍿 🥤 🍜 🥟 🍇 🍒'.split(' '),
    'Fun': '🎨 🎮 🎸 🎧 🎤 🎬 📷 ⚽ 🏏 🏀 🎯 🎲 🧩 🪁 🎈 🎁 🎉 🏆 🚀 🛹'.split(' '),
    'School': '📚 📖 ✏️ 📝 📒 📓 🖍️ 📐 🔬 🧪 🧠 💡 🗺️ 🧮 🎓 🏫 ⏰ 📅 💭 💌'.split(' '),
    'Hearts': '❤️ 🧡 💛 💚 💙 💜 🩷 🤍 💖 💫 🌷 🫶 🤞 👍 👏 💪 🙌 ✌️ 🕊️ 🍀'.split(' ')
  };
  const MOODS = [['😄', 'Great'], ['🙂', 'Good'], ['😐', 'Okay'], ['😴', 'Tired'], ['😔', 'Low'], ['😢', 'Sad'], ['😡', 'Angry'], ['🤩', 'Excited']];
  const FONTS = { sans: 'Default', serif: 'Storybook', mono: 'Typewriter' };
  const STARTERS_BY = {
    young: ['What was the best part of your day?', 'What made you laugh today?', 'Draw or write about your favourite toy', 'What animal would you like to be?', 'What would you like to do tomorrow?', 'Who did you play with today?'],
    middle: ['What was the best part of your day?', 'What did you learn today?', 'Did anything surprise you?', 'What made you laugh?', 'What would you like to do tomorrow?', 'What new thing did you discover?', 'If I could have any superpower…'],
    older: ['What did you learn today that you didn’t know yesterday?', 'Did anything surprise you this week?', 'Something I want to get better at, and how', 'What made you laugh today?', 'A question I can’t stop thinking about', 'What would make tomorrow a great day?', 'Three things I’m thankful for']
  };
  const starters = () => STARTERS_BY[SparkAI.levelOf(S.settings.grade).band] || STARTERS_BY.middle;
  const STARTERS = ['What made you smile today?', 'Something new I learned…', 'If I could have any superpower…', 'Three things I’m thankful for', 'My dream for this year', 'A funny thing that happened'];
  const COLORS = [['default', 'Default'], ['gray', 'Grey'], ['brown', 'Brown'], ['orange', 'Orange'], ['yellow', 'Yellow'], ['green', 'Green'], ['blue', 'Blue'], ['purple', 'Purple'], ['pink', 'Pink'], ['red', 'Red']];

  const pick = a => a[Math.floor(Math.random() * a.length)];
  const allEmoji = () => Object.values(EMOJI).flat();
  const today = () => new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const owner = () => { const n = (S.settings.name || '').trim().split(/\s+/)[0]; return n ? `${n}${/s$/i.test(n) ? '’' : '’s'} Diary` : 'My Diary'; };

  /* ---------- pages ---------- */
  const live = () => S.thoughts.filter(t => !t.trashed);
  const byId = id => S.thoughts.find(t => t.id === id);
  const kids = id => live().filter(t => (t.parentId || null) === (id || null)).sort((a, b) => (a.order ?? a.created) - (b.order ?? b.created));
  const trail = t => { const out = []; let p = t, guard = 0; while (p && guard++ < 20) { out.unshift(p); p = p.parentId && byId(p.parentId); } return out; };
  const descendants = id => { const out = []; for (const k of S.thoughts.filter(t => t.parentId === id)) out.push(k, ...descendants(k.id)); return out; };

  /* Older pages get an icon, a cover and the new fields, so every page already looks like its own. */
  function normalize(s) {
    const used = new Set();
    for (const t of s.thoughts || []) {
      if (!t.icon) { let e; do e = pick(allEmoji()); while (used.has(e) && used.size < 60); t.icon = e; }
      used.add(t.icon);
      if (t.cover === undefined) t.cover = pick(Object.keys(COVERS));
      if (t.parentId === undefined) t.parentId = null;
      if (!t.font) t.font = 'sans';
      if (t.order === undefined) t.order = t.created || Date.now();
    }
  }
  function create(opts = {}) {
    const t = newThought(opts.title || '');
    const taken = new Set(S.thoughts.map(x => x.icon));
    const free = allEmoji().filter(e => !taken.has(e));
    Object.assign(t, { title: opts.title || '', icon: opts.icon || pick(free.length ? free : allEmoji()), cover: opts.cover !== undefined ? opts.cover : pick(Object.keys(COVERS)), parentId: opts.parentId || null, font: 'sans', mood: opts.mood || null, order: Date.now(), html: opts.html || '' });
    S.thoughts.unshift(t);
    return t;
  }
  function open(id) { S.activeThoughtId = id; S.mode = 'thought'; save(); closeDrawer(); render(); }
  function newPage(parentId, tpl) {
    const T = tpl && TEMPLATES[tpl];
    const t = create(Object.assign({ parentId }, T ? T() : {}));
    if (parentId) { const o = Object.assign({}, S.settings.diaryOpen, { [parentId]: true }); S.settings.diaryOpen = o; }
    setSection('th', true);
    open(t.id);
    const ti = document.querySelector('.dy-title'); if (ti && !t.title) ti.focus();
    return t;
  }
  function trash(t) {
    const all = [t, ...descendants(t.id)], now = Date.now();
    for (const x of all) x.trashed = now;
    if (t.parentId) { const p = byId(t.parentId); if (p) p.html = (p.html || '').replace(new RegExp(`<div[^>]*data-page="${t.id}"[^>]*>[\\s\\S]*?</div>`, 'g'), ''); }
    S.mode = t.parentId && byId(t.parentId) && !byId(t.parentId).trashed ? 'thought' : 'diary';
    if (S.mode === 'thought') S.activeThoughtId = t.parentId;
    save(); if (typeof learnReconcile === 'function') learnReconcile(); render();
    toast(`Moved “${t.title || 'Untitled'}” to the bin. You can bring it back from ${owner()}.`);
  }
  function restore(t) { const p = t.parentId && byId(t.parentId); if (!p || p.trashed) t.parentId = null; const when = t.trashed; for (const x of [t, ...descendants(t.id)]) if (x.trashed === when) delete x.trashed; save(); render(); toast('Page brought back'); }
  function destroy(t) {
    if (!confirm(`Delete “${t.title || 'Untitled'}” forever? Its writing and Spark chat can’t be brought back.`)) return;
    const gone = new Set([t.id, ...descendants(t.id).map(x => x.id)]);
    for (const x of S.thoughts.filter(x => gone.has(x.id))) dropFiles(x);
    S.thoughts = S.thoughts.filter(x => !gone.has(x.id));
    save(); if (typeof learnReconcile === 'function') learnReconcile(); render();
  }
  /* A page's pictures, drawings, voice notes and history live in IndexedDB; they go when the page goes. */
  function dropFiles(t) {
    for (const m of String(t.html || '').matchAll(/data-file="([^"]+)"/g)) idb.del(m[1]).catch(() => {});
    idb.del('dyv:' + t.id).catch(() => {});
  }
  /* Everything in the diary, gone for good (from My Learning World's danger zone). */
  function destroyAll() {
    for (const t of S.thoughts) dropFiles(t);
    S.thoughts = []; S.activeThoughtId = null; S.mode = 'diary';
    save(); if (typeof learnReconcile === 'function') learnReconcile(); render();
  }
  function duplicate(t) {
    const c = create({ title: (t.title || 'Untitled') + ' (copy)', icon: t.icon, cover: t.cover, parentId: t.parentId, mood: t.mood, html: t.html });
    c.font = t.font; c.wide = t.wide; open(c.id); toast('Page duplicated');
  }

  /* ---------- templates ---------- */
  const TEMPLATES = {
    today: () => ({ title: 'Dear Diary · ' + new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), icon: '📔', cover: 'peach', html: `<p class="c-gray">${esc(today())}</p><h2>Today I…</h2><p></p><h2>The best part</h2><p></p><div class="callout" data-color="yellow"><span class="co-ic" contenteditable="false">💡</span><div class="co-tx">One thing I learned:</div></div><h3>I’m thankful for</h3><div class="todo"><input type="checkbox"><span><br></span></div>` }),
    grateful: () => ({ title: 'Thankful list', icon: '🙏', cover: 'mint', html: `<p>Three good things, big or small.</p><ol><li></li><li></li><li></li></ol><blockquote>Gratitude turns what we have into enough.</blockquote>` }),
    goals: () => ({ title: 'My goals', icon: '🎯', cover: 'galaxy', html: `<h2>This week</h2><div class="todo"><input type="checkbox"><span><br></span></div><h2>This year</h2><div class="todo"><input type="checkbox"><span><br></span></div><div class="callout" data-color="purple"><span class="co-ic" contenteditable="false">🚀</span><div class="co-tx">Small steps every day add up!</div></div>` }),
    book: () => ({ title: 'A book I read', icon: '📚', cover: 'sky', html: `<p><b>Book:</b> </p><p><b>Writer:</b> </p><p><b>My rating:</b> ⭐⭐⭐⭐⭐</p><h2>What happened</h2><p></p><h2>My favourite character</h2><p></p><div class="b-toggle open"><div class="tg-head"><span class="tg-arrow" contenteditable="false">▶</span><span class="tg-text">Would I tell a friend to read it?</span></div><div class="tg-body"><p></p></div></div>` }),
    dream: () => ({ title: 'Dream journal', icon: '🌙', cover: 'space', html: `<p class="c-gray">${esc(today())}</p><h2>Last night I dreamt…</h2><p></p><h3>How it felt</h3><p></p>` }),
    blank: () => ({})
  };
  const TPL_LIST = [['today', '📔', 'Today’s diary'], ['grateful', '🙏', 'Thankful list'], ['goals', '🎯', 'My goals'], ['book', '📚', 'Book I read'], ['dream', '🌙', 'Dream journal']];

  /* ---------- sidebar ---------- */
  function sideHTML() {
    const openSet = S.settings.diaryOpen || {};
    const row = (t, depth) => {
      const ch = kids(t.id), on = !!openSet[t.id], act = S.mode === 'thought' && t.id === S.activeThoughtId;
      return `<div class="dy-row ${act ? 'active' : ''}" style="--d:${depth}" data-id="${t.id}">
        <button class="dy-tw ${on ? 'on' : ''}" data-tw="${t.id}" aria-label="${on ? 'Hide' : 'Show'} pages inside" ${ch.length ? '' : 'data-empty'}>${ch.length ? '▶' : '•'}</button>
        <button class="dy-open" data-open="${t.id}"><span class="dy-ic">${esc(t.icon || '📄')}</span><span class="t">${esc(t.title || 'Untitled')}</span>${t.chatOn ? '<span class="dy-spk" title="Spark is on">✦</span>' : ''}</button>
        <button class="dy-add" data-sub="${t.id}" aria-label="Add a page inside" title="Add a page inside">+</button>
      </div>${on ? ch.map(k => row(k, depth + 1)).join('') || `<div class="dy-none" style="--d:${depth + 1}">No pages inside</div>` : ''}`;
    };
    const favs = live().filter(t => t.fav);
    return `<button class="dy-home ${S.mode === 'diary' ? 'active' : ''}" data-diary-home><span class="dy-ic">🏠</span>${esc(owner())} home</button>
      <button class="dy-home ${S.mode === 'world' ? 'active' : ''}" data-world><span class="dy-ic">🌍</span>My Learning World</button>
      ${favs.length ? `<div class="dy-lbl">Favourites</div>${favs.map(t => `<button class="dy-home ${S.mode === 'thought' && t.id === S.activeThoughtId ? 'active' : ''}" data-open="${t.id}"><span class="dy-ic">${esc(t.icon)}</span><span class="t">${esc(t.title || 'Untitled')}</span></button>`).join('')}<div class="dy-lbl">Pages</div>` : ''}
      ${kids(null).map(t => row(t, 0)).join('')}
      <button class="dy-home dy-muted" data-new-page><span class="dy-ic">＋</span>Add a page</button>`;
  }
  function wireSide(el) {
    el.onclick = e => {
      const tw = e.target.closest('[data-tw]'); if (tw) { if (tw.hasAttribute('data-empty')) return; const id = tw.dataset.tw; S.settings.diaryOpen = Object.assign({}, S.settings.diaryOpen, { [id]: !(S.settings.diaryOpen || {})[id] }); save(); return renderSide(); }
      const sub = e.target.closest('[data-sub]'); if (sub) return newPage(sub.dataset.sub);
      const o = e.target.closest('[data-open]'); if (o) return open(o.dataset.open);
      if (e.target.closest('[data-diary-home]')) { S.mode = 'diary'; save(); closeDrawer(); return render(); }
      if (e.target.closest('[data-world]')) { S.mode = 'world'; save(); closeDrawer(); return render(); }
      if (e.target.closest('[data-new-page]')) return newPage(null);
    };
  }

  /* ---------- diary home: a Notion-style library of every page ---------- */
  const fmt = ts => { if (!ts) return ''; const d = new Date(ts), now = new Date(); const mins = Math.round((now - d) / 6e4); if (mins < 1) return 'Just now'; if (mins < 60) return mins + ' min ago'; return ago(ts) === 'Today' ? d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }) : ago(ts) === 'Yesterday' ? 'Yesterday' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' }); };
  const words = t => (pageText(t).match(/\S+/g) || []).length;
  function streak() {
    const days = new Set(live().flatMap(t => [t.created, t.updated]).filter(Boolean).map(ts => new Date(ts).toDateString()));
    let n = 0; const d = new Date(); if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
    while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  let HOME = { tab: 'recent', q: '', sort: 'updated', tag: '', day: '', month: null };
  const dayKey = ts => { const d = new Date(ts); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const allTags = () => [...new Set(live().flatMap(t => t.tags || []))].sort();
  /* A month of the diary: a dot on each day with a page written or edited; tap a day to see its pages. */
  function calendarHTML() {
    const now = new Date(), m = HOME.month || { y: now.getFullYear(), m: now.getMonth() };
    const first = new Date(m.y, m.m, 1), days = new Date(m.y, m.m + 1, 0).getDate(), lead = (first.getDay() + 6) % 7;
    const count = {}; for (const t of live()) for (const k of new Set([dayKey(t.created), dayKey(t.updated)])) count[k] = (count[k] || 0) + 1;
    const cells = []; for (let i = 0; i < lead; i++) cells.push('<span></span>');
    for (let d = 1; d <= days; d++) { const k = `${m.y}-${String(m.m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, n = count[k] || 0, isToday = k === dayKey(Date.now());
      cells.push(`<button class="cal-d ${n ? 'has' : ''} ${isToday ? 'today' : ''} ${HOME.day === k ? 'on' : ''}" data-day="${k}" aria-label="${new Date(m.y, m.m, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}${n ? `, ${n} page${n === 1 ? '' : 's'}` : ''}">${d}${n ? `<i>${n > 3 ? '•••' : '•'.repeat(n)}</i>` : ''}</button>`); }
    return `<div class="dy-cal"><div class="cal-h"><button data-cal="-1" aria-label="Previous month">‹</button><b>${first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button data-cal="1" aria-label="Next month">›</button></div>
      <div class="cal-g">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(x => `<span class="cal-w">${x}</span>`).join('')}${cells.join('')}</div></div>`;
  }
  function renderHome() {
    const name = (S.settings.name || '').trim().split(/\s+/)[0];
    const hr = new Date().getHours(), hi = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const all = live(), bin = S.thoughts.filter(t => t.trashed);
    $('#view').innerHTML = `<div class="dy-home-page"><div class="dy-cover-home" style="background:${COVERS[S.settings.diaryCover || 'candy'][1]}"><button class="dy-cover-btn" data-home-cover>Change cover</button></div>
      <div class="dy-home-in">
        <div class="dy-home-ic">📔</div>
        <div class="dy-home-head"><div><p class="dy-date">${esc(today())}</p><h1>${esc(owner())}</h1><p class="dy-subtitle">${hi}${name ? ', ' + esc(name) : ''}! Your private space. Only you can see it. Spark never replies here.</p></div>
          <div class="dy-head-acts"><button class="dy-ghost" data-world-open>🌍 My Learning World</button><button class="dy-new" data-new-page>New page</button></div></div>
        <div class="dy-stats"><span><b>${all.length}</b> page${all.length === 1 ? '' : 's'}</span><span><b>${all.reduce((n, t) => n + words(t), 0)}</b> words written</span><span><b>${streak()}</b>🔥 day streak</span><span><b>${Math.round(all.reduce((n, t) => n + (t.writeMs || 0), 0) / 6e4)}</b> min writing</span></div>
        <div class="dy-two"><div><h2 class="dy-h">Start with a template</h2>
        <div class="dy-tpls">${TPL_LIST.map(([k, ic, l]) => `<button class="dy-tpl" data-tpl="${k}"><span>${ic}</span>${l}</button>`).join('')}</div>
        <h2 class="dy-h">Need an idea? <span class="dy-muted">(only if you want one)</span></h2><div class="dy-prompts">${starters().slice(0, 4).map(x => `<button data-prompt="${esc(x)}">✏️ ${esc(x)}</button>`).join('')}</div></div>
        <div id="dyCal">${calendarHTML()}</div></div>
        ${allTags().length ? `<div class="dy-tagrow"><span class="dy-muted">Tags:</span>${allTags().map(g => `<button class="dy-tag ${HOME.tag === g ? 'on' : ''}" data-tagf="${esc(g)}">#${esc(g)}</button>`).join('')}</div>` : ''}
        <div class="dy-tabs" role="tablist">
          ${[['recent', '🕒', 'Recents'], ['fav', '⭐', 'Favourites'], ['mood', '🌈', 'Moods'], ['spark', '✦', 'With Spark'], ['bin', '🗑️', `Bin${bin.length ? ' · ' + bin.length : ''}`]].map(([k, ic, l]) => `<button role="tab" class="dy-tab ${HOME.tab === k ? 'on' : ''}" data-htab="${k}" aria-selected="${HOME.tab === k}">${ic} ${l}</button>`).join('')}
          <span class="sp"></span><button class="dy-ghost sm" data-export title="Download all my pages">⬇️ Download</button><label class="dy-search">🔍<input id="dySearch" placeholder="Search words, tags or dates" value="${esc(HOME.q)}" aria-label="Search diary pages"></label>
        </div>
        <div id="dyTable"></div>
      </div></div>`;
    table();
    $('#dySearch').oninput = e => { HOME.q = e.target.value; table(); };
    $('#view').querySelector('.dy-home-page').onclick = e => {
      const tb = e.target.closest('[data-htab]'); if (tb) { HOME.tab = tb.dataset.htab; return renderHome(); }
      const tp = e.target.closest('[data-tpl]'); if (tp) return newPage(null, tp.dataset.tpl);
      const pr = e.target.closest('[data-prompt]'); if (pr) { const t = create({ title: pr.dataset.prompt.replace(/…$/, ''), html: '<p><br></p>' }); return open(t.id); }
      if (e.target.closest('[data-world-open]')) { S.mode = 'world'; save(); return render(); }
      if (e.target.closest('[data-export]')) return exportDiary(live());
      const cm = e.target.closest('[data-cal]'); if (cm) { const now = new Date(), m = HOME.month || { y: now.getFullYear(), m: now.getMonth() }; const d = new Date(m.y, m.m + Number(cm.dataset.cal), 1); HOME.month = { y: d.getFullYear(), m: d.getMonth() }; $('#dyCal').innerHTML = calendarHTML(); return; }
      const dd = e.target.closest('[data-day]'); if (dd) { HOME.day = HOME.day === dd.dataset.day ? '' : dd.dataset.day; $('#dyCal').innerHTML = calendarHTML(); return table(); }
      const tf = e.target.closest('[data-tagf]'); if (tf) { HOME.tag = HOME.tag === tf.dataset.tagf ? '' : tf.dataset.tagf; return renderHome(); }
      if (e.target.closest('[data-clear-filter]')) { HOME.day = ''; HOME.tag = ''; return renderHome(); }
      if (e.target.closest('[data-new-page]')) return newPage(null);
      if (e.target.closest('[data-home-cover]')) return coverMenu(e.target.closest('[data-home-cover]'), k => { S.settings.diaryCover = k || 'candy'; save(); renderHome(); });
      const so = e.target.closest('[data-sort]'); if (so) { HOME.sort = so.dataset.sort; return table(); }
      const rs = e.target.closest('[data-restore]'); if (rs) return restore(byId(rs.dataset.restore));
      const de = e.target.closest('[data-destroy]'); if (de) return destroy(byId(de.dataset.destroy));
      const r = e.target.closest('[data-row]'); if (r) return open(r.dataset.row);
    };
  }
  function table() {
    const box = $('#dyTable'); if (!box) return;
    const q = HOME.q.trim().toLowerCase();
    let rows = HOME.tab === 'bin' ? S.thoughts.filter(t => t.trashed) : live();
    if (HOME.tab === 'fav') rows = rows.filter(t => t.fav);
    if (HOME.tab === 'mood') rows = rows.filter(t => t.mood);
    if (HOME.tab === 'spark') rows = rows.filter(t => t.chatOn);
    if (HOME.tag) rows = rows.filter(t => (t.tags || []).includes(HOME.tag));
    if (HOME.day) rows = rows.filter(t => dayKey(t.created) === HOME.day || dayKey(t.updated) === HOME.day);
    // Search titles, writing, tags (with or without #) and dates ("16 nov", "november", "2026-11-16").
    const dateText = ts => { const d = new Date(ts); return [dayKey(ts), d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }), d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), d.toLocaleDateString(undefined, { weekday: 'long' })].join(' ').toLowerCase(); };
    if (q) rows = rows.filter(t => (t.title || '').toLowerCase().includes(q) || pageText(t).toLowerCase().includes(q) || (t.tags || []).some(g => ('#' + g).includes(q.replace(/^#?/, '#'))) || dateText(t.created).includes(q) || dateText(t.updated).includes(q));
    const key = HOME.sort;
    rows.sort((a, b) => key === 'title' ? (a.title || '').localeCompare(b.title || '') : (b[key] || 0) - (a[key] || 0));
    const empty = { recent: 'No pages yet. Press New page or pick a template.', fav: 'No favourites yet. Open a page and tap ☆ at the top.', mood: 'No moods yet. Open a page and tap “Add mood”.', spark: 'Spark isn’t switched on for any page.', bin: 'The bin is empty.' }[HOME.tab];
    const th = (k, l, ic) => `<th><button data-sort="${k}" class="${key === k ? 'on' : ''}">${ic} ${l}</button></th>`;
    const filt = HOME.day || HOME.tag ? `<p class="dy-filter">Showing ${HOME.day ? new Date(HOME.day + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) : ''}${HOME.day && HOME.tag ? ' · ' : ''}${HOME.tag ? '#' + esc(HOME.tag) : ''} <button data-clear-filter>Show all</button></p>` : '';
    box.innerHTML = filt + (rows.length ? `<table class="dy-table"><thead><tr>${th('title', 'Page name', '📄')}<th class="pl">🌈 Mood</th><th class="pl">📁 Inside</th>${th('created', 'Created', '🗓️')}${th('updated', 'Last edited', '🕒')}${HOME.tab === 'bin' ? '<th class="pl"></th>' : ''}</tr></thead><tbody>
      ${rows.map(t => { const p = t.parentId && byId(t.parentId); const m = MOODS.find(x => x[0] === t.mood);
        return `<tr ${HOME.tab === 'bin' ? '' : `data-row="${t.id}" tabindex="0"`}><td class="dy-name"><span class="dy-nm"><span class="dy-ic">${esc(t.icon || '📄')}</span>${esc(t.title || 'Untitled')}${t.fav ? ' <span class="dy-star">★</span>' : ''}${(t.tags || []).slice(0, 3).map(g => `<span class="dy-tag sm">#${esc(g)}</span>`).join('')}</span></td><td>${m ? `<span class="dy-chip">${m[0]} ${m[1]}</span>` : ''}</td><td>${p ? `<span class="dy-chip soft">${esc(p.icon)} ${esc(p.title || 'Untitled')}</span>` : '<span class="dy-muted">Diary</span>'}</td><td>${fmt(t.created)}</td><td>${fmt(t.updated)}</td>${HOME.tab === 'bin' ? `<td class="dy-acts"><button data-restore="${t.id}">Bring back</button><button data-destroy="${t.id}" class="danger">Delete forever</button></td>` : ''}</tr>`; }).join('')}
    </tbody></table>` : `<p class="dy-empty">${HOME.day || HOME.tag || q ? 'No pages match.' : empty}</p>`);
    box.querySelectorAll('tr[data-row]').forEach(tr => tr.onkeydown = e => { if (e.key === 'Enter') open(tr.dataset.row); });
  }

  /* ---------- a page ---------- */
  let saveTimer = null, PENDING = null, TYPING = { id: null, at: 0 };
  const tagsHTML = t => (t.tags || []).map(g => `<span class="dy-tag">#${esc(g)}<button data-rmtag="${esc(g)}" aria-label="Remove tag ${esc(g)}">×</button></span>`).join('');
  function addTag(t) {
    const v = prompt('Add a tag (for example school, trip, cricket):'); if (!v) return;
    const g = v.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9\u0900-\u097f -]/g, '').trim().replace(/\s+/g, '-').slice(0, 24); if (!g) return;
    t.tags = [...new Set([...(t.tags || []), g])].slice(0, 12); t.updated = Date.now(); save(); const b = $('#dyTags'); if (b) b.innerHTML = tagsHTML(t);
  }
  /* Saves a pending edit straight away (the tab is being hidden or closed). */
  function flush() { if (PENDING) PENDING(); }
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('beforeunload', flush);
  function renderPage(t) {
    const tr = trail(t), m = MOODS.find(x => x[0] === t.mood);
    const cover = t.cover && COVERS[t.cover];
    $('#view').innerHTML = `<div class="tpage ${t.chatOn ? 'with-chat' : ''}">
      <div class="notes-wrap dy-wrap" id="notesWrap">
        ${cover ? `<div class="dy-cover" style="background:${cover[1]}"><div class="dy-cover-acts"><button data-cover>Change cover</button><button data-cover-off>Remove</button></div></div>` : ''}
        <div class="dy-page ${t.wide ? 'wide' : ''} f-${t.font || 'sans'} ${cover ? '' : 'no-cover'}">
          <button class="dy-icon" data-icon aria-label="Change page icon" title="Change icon">${esc(t.icon || '📄')}</button>
          <div class="dy-adders">${cover ? '' : '<button data-cover>🖼️ Add cover</button>'}${m ? '' : '<button data-mood>😊 Add mood</button>'}<button data-starter>💡 Need an idea?</button><button data-addtag>🏷️ Add tag</button><button data-dictate>🎤 Talk to type</button></div>
          <h1 class="dy-title" contenteditable="${t.locked ? 'false' : 'true'}" spellcheck="true" data-ph="Untitled" aria-label="Page title">${esc(t.title || '')}</h1>
          <div class="dy-meta">${m ? `<button class="dy-chip" data-mood>${m[0]} Feeling ${m[1].toLowerCase()}</button>` : ''}<span>${tr.length > 1 ? `In ${tr.slice(0, -1).map(p => `<button class="dy-link" data-go-page="${p.id}">${esc(p.icon)} ${esc(p.title || 'Untitled')}</button>`).join(' / ')} · ` : ''}Edited ${fmt(t.updated).toLowerCase()}</span><span id="dyWords">${words(t)} words</span><span id="dyTime">${t.writeMs > 59000 ? '✍️ ' + Math.round(t.writeMs / 6e4) + ' min writing' : ''}</span><span class="saved" id="savedLbl">Saved</span>${t.locked ? '<span class="dy-chip soft">🔒 Locked</span>' : ''}</div>
          <div class="dy-tagline" id="dyTags">${tagsHTML(t)}</div>
          ${privateHTML(t)}
          <div class="editor dy-editor" id="editor" contenteditable="${t.locked ? 'false' : 'true'}" spellcheck="true" aria-label="Page" data-ph="Write something, or type / for blocks">${t.html || ''}</div>
          <button class="dy-click-end" id="dyEnd" aria-label="Add a line at the end"></button>
        </div>
        <div class="dy-mobar" aria-label="Writing tools"><button data-mo="slash">＋ Block</button><button data-mo="todo">☐</button><button data-mo="ul">•</button><button data-mo="h2">H</button><button data-mo="bold"><b>B</b></button><button data-mo="italic"><i>I</i></button><button data-mo="sticker">😀</button><button data-mo="image">🖼️</button><button data-mo="dictate">🎤</button></div>
      </div>
      ${t.chatOn ? '<aside class="tchat" id="tchat" aria-label="Talk with Spark about this page"></aside>' : ''}
    </div>`;
    refreshPageLinks(); loadMedia($('#editor'));
    if (!$('#editor').firstElementChild) $('#editor').innerHTML = '<p><br></p>';
    const ed = $('#editor'), title = document.querySelector('.dy-title');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    /* Saving: 0.4 s after the last change, at once when the page is hidden or closed, and never over a newer copy
       saved in another tab without asking. Every few minutes a copy goes into the page's history. */
    const commit = () => {
      clearTimeout(saveTimer); PENDING = null;
      if (!ed.isConnected) return;
      t.html = clean(ed.innerHTML); t.updated = Date.now(); t.rev = (t.rev || 0) + 1; save(); renderSide();
      const l = $('#savedLbl'); if (l) l.textContent = 'Saved'; const w = $('#dyWords'); if (w) w.textContent = words(t) + ' words';
      const tm = $('#dyTime'); if (tm && t.writeMs > 59000) tm.textContent = '✍️ ' + Math.round(t.writeMs / 6e4) + ' min writing';
      scheduleThoughtLearning(t); snapshot(t); announce(t);
    };
    const changed = () => {
      const now = Date.now(); if (TYPING.id === t.id && now - TYPING.at < 60000) t.writeMs = (t.writeMs || 0) + (now - TYPING.at); TYPING = { id: t.id, at: now };
      $('#savedLbl').textContent = 'Saving…'; clearTimeout(saveTimer); PENDING = commit;
      saveTimer = setTimeout(commit, 400);
      ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('hr,.b-page,.todo,.callout,img,.b-img,.b-audio'));
    };
    ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('hr,.b-page,.todo,.callout,img'));
    title.oninput = () => { t.title = title.textContent.replace(/\n/g, ' ').trim(); t.updated = Date.now(); clearTimeout(saveTimer); saveTimer = setTimeout(() => { save(); renderSide(); }, 300); };
    title.onkeydown = e => { if (e.key === 'Enter' || (e.key === 'ArrowDown')) { e.preventDefault(); focusStart(ed); } };
    title.onpaste = e => { e.preventDefault(); document.execCommand('insertText', false, (e.clipboardData.getData('text/plain') || '').replace(/\s+/g, ' ')); };
    ed.oninput = changed; ed._changed = changed;
    wireEditor(ed, t, changed);
    wireCare(t);
    $('#dyEnd').onclick = () => { if (t.locked) return; const last = ed.lastElementChild; if (!last || blockText(last) || !/^P$/.test(last.tagName)) ed.appendChild(el('p')); focusEnd(ed.lastElementChild); changed(); };
    document.querySelector('.dy-wrap').addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-icon')) return iconMenu(b, ic => { t.icon = ic; t.updated = Date.now(); save(); renderSide(); b.textContent = ic; });
      if (b.hasAttribute('data-cover')) return coverMenu(b, k => { t.cover = k; save(); renderPage(t); });
      if (b.hasAttribute('data-cover-off')) { t.cover = null; save(); return renderPage(t); }
      if (b.hasAttribute('data-mood')) return moodMenu(b, mo => { t.mood = mo; save(); renderPage(t); renderSide(); });
      if (b.hasAttribute('data-starter')) return starterMenu(b, s => { if (t.locked) return; const h = el('h2'); h.textContent = s; const p = el('p'); if (ed.classList.contains('is-empty')) ed.innerHTML = ''; ed.append(h, p); focusStart(p); changed(); });
      if (b.dataset.goPage) return open(b.dataset.goPage);
      if (b.hasAttribute('data-addtag')) return addTag(t);
      const rt = b.dataset.rmtag; if (rt) { t.tags = (t.tags || []).filter(g => g !== rt); save(); $('#dyTags').innerHTML = tagsHTML(t); return; }
      if (b.hasAttribute('data-dictate')) return dictate(ed, changed, b);
      if (b.dataset.mo) return mobile(b.dataset.mo, ed, changed);
    });
    if (t.chatOn) renderThoughtChat();
    if (!t.html && t.title) focusStart(ed);
  }
  /* Titles of linked sub-pages are kept up to date, and links to deleted pages disappear. */
  function refreshPageLinks() {
    document.querySelectorAll('#editor .b-page').forEach(a => { const p = byId(a.dataset.page); if (!p || p.trashed) return a.remove(); a.innerHTML = `<span class="dy-ic">${esc(p.icon)}</span><span>${esc(p.title || 'Untitled')}</span>`; a.setAttribute('contenteditable', 'false'); });
  }
  const clean = html => html.replace(/\s(?:draggable|data-drop)="[^"]*"/g, '').replace(/<div class="dy-drop[^"]*"><\/div>/g, '').replace(/(<(?:img|audio)\b[^>]*?)\ssrc="blob:[^"]*"/g, '$1');

  /* ---------- editor helpers ---------- */
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const blockText = b => (b.textContent || '').replace(/ /g, ' ').trim();
  function blockOf(node, ed) {
    let n = node && node.nodeType === 3 ? node.parentNode : node;
    while (n && n !== ed) {
      if (n.parentNode === ed) return n;
      if (n.tagName === 'LI' || (n.parentNode && n.parentNode.classList && n.parentNode.classList.contains('tg-body'))) return n;
      if (n.classList && (n.classList.contains('tg-head') || n.classList.contains('co-tx'))) return n;
      n = n.parentNode;
    }
    return null;
  }
  const caretBlock = ed => { const s = getSelection(); return s.rangeCount ? blockOf(s.anchorNode, ed) : null; };
  function focusStart(b) { if (!b) return; const r = document.createRange(); const target = b.querySelector('.tg-text,.co-tx,span:not(.co-ic):not(.tg-arrow)') || b; r.setStart(target, 0); r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r); (b.closest('[contenteditable="true"]') || b).focus(); }
  function focusEnd(b) { if (!b) return; const r = document.createRange(); const target = b.querySelector('.tg-text,.co-tx,.todo span') || b; r.selectNodeContents(target); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); (b.closest('[contenteditable="true"]') || b).focus(); }
  const atStart = b => { const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false; const r = document.createRange(); r.selectNodeContents(b); r.setEnd(s.anchorNode, s.anchorOffset); return !r.toString().replace(/ /g, '').length; };
  const atEnd = b => { const s = getSelection(); if (!s.rangeCount || !s.isCollapsed) return false; const r = document.createRange(); r.selectNodeContents(b); r.setStart(s.anchorNode, s.anchorOffset); return !r.toString().trim().length; };

  /* The kinds of block, for the "/" menu and "Turn into". */
  const BLOCKS = [
    ['p', 'Aa', 'Text', 'Just start writing', 'text plain'],
    ['h1', 'H1', 'Big heading', 'A large title', 'heading1 title #'],
    ['h2', 'H2', 'Medium heading', 'A section heading', 'heading2 ##'],
    ['h3', 'H3', 'Small heading', 'A small heading', 'heading3 ###'],
    ['todo', '☑', 'To-do list', 'Tick things off', 'todo checkbox task check'],
    ['ul', '•', 'Bulleted list', 'A simple list', 'bullet list unordered'],
    ['ol', '1.', 'Numbered list', 'A list with numbers', 'numbered ordered list'],
    ['toggle', '▶', 'Toggle list', 'Hide things inside, tap to open', 'toggle collapse dropdown secret'],
    ['quote', '❝', 'Quote', 'Something someone said', 'quote blockquote'],
    ['callout', '💡', 'Callout', 'A coloured box to make it stand out', 'callout box note'],
    ['hr', '—', 'Divider', 'A line to split things up', 'divider line hr'],
    ['code', '</>', 'Code', 'For coding practice', 'code program'],
    ['image', '🖼️', 'Image', 'Add a photo or picture', 'image photo picture upload'],
    ['drawing', '🎨', 'Drawing', 'Draw something with your finger or mouse', 'drawing draw sketch paint doodle'],
    ['voice', '🎙️', 'Voice note', 'Record your voice', 'voice audio record recording'],
    ['dictate', '🎤', 'Talk to type', 'Say it and Spark types it', 'speech dictate talk type'],
    ['emoji', '😊', 'Emoji', 'Add an emoji in your writing', 'emoji smiley'],
    ['page', '📄', 'Page inside', 'A new page inside this one', 'page subpage'],
    ['sticker', '😀', 'Sticker', 'A big emoji', 'sticker emoji'],
    ['date', '📅', 'Today’s date', 'Add the date', 'date today time'],
    ['mood', '🌈', 'Mood', 'How are you feeling?', 'mood feeling']
  ];
  const TURN = ['p', 'h1', 'h2', 'h3', 'todo', 'ul', 'ol', 'toggle', 'quote', 'callout', 'code'];

  /* Make a fresh block of a kind, holding `html`. */
  function make(kind, html = '') {
    const inner = html || '';
    switch (kind) {
      case 'h1': case 'h2': case 'h3': case 'p': { const e = el(kind); e.innerHTML = inner || '<br>'; return e; }
      case 'quote': { const e = el('blockquote'); e.innerHTML = inner || '<br>'; return e; }
      case 'code': { const e = el('pre', 'b-code'); e.textContent = html ? tmp(html).textContent : ''; if (!e.textContent) e.innerHTML = '<br>'; return e; }
      case 'todo': { const e = el('div', 'todo'); e.innerHTML = `<input type="checkbox"><span>${inner || '<br>'}</span>`; return e; }
      case 'ul': case 'ol': { const e = el(kind); const li = el('li'); li.innerHTML = inner || '<br>'; e.appendChild(li); return e; }
      case 'toggle': { const e = el('div', 'b-toggle open'); e.innerHTML = `<div class="tg-head"><span class="tg-arrow" contenteditable="false">▶</span><span class="tg-text">${inner}</span></div><div class="tg-body"><p><br></p></div>`; return e; }
      case 'callout': { const e = el('div', 'callout'); e.dataset.color = 'yellow'; e.innerHTML = `<span class="co-ic" contenteditable="false">💡</span><div class="co-tx">${inner || '<br>'}</div>`; return e; }
      case 'hr': return el('hr');
      default: return el('p');
    }
  }
  const tmp = html => { const d = el('div'); d.innerHTML = html; return d; };
  /* The writing inside a block, without its checkbox, arrow or icon. */
  function innerOf(b) {
    if (b.classList.contains('todo')) { const s = b.querySelector('span'); return s ? s.innerHTML : ''; }
    if (b.classList.contains('b-toggle')) { const s = b.querySelector('.tg-text'); return s ? s.innerHTML : ''; }
    if (b.classList.contains('callout')) { const s = b.querySelector('.co-tx'); return s ? s.innerHTML : ''; }
    if (b.tagName === 'UL' || b.tagName === 'OL') return [...b.children].map(li => li.innerHTML).join('<br>');
    if (b.tagName === 'PRE') return esc(b.textContent);
    return b.innerHTML;
  }
  /* The top-level block that holds a list item, toggle head or callout text. */
  const topBlock = (b, ed) => { let n = b; while (n && n.parentNode !== ed && !(n.parentNode && n.parentNode.classList && n.parentNode.classList.contains('tg-body'))) n = n.parentNode; return n || b; };
  function turnInto(b, kind, ed) {
    let host = b;
    if (b.tagName === 'LI') { const list = b.parentNode; if (list.children.length > 1) { const nb = make(kind, b.innerHTML.replace(/^<br>$/, '')); splitListAt(list, b, nb); focusEnd(nb); return nb; } host = list; }
    if (b.classList && (b.classList.contains('tg-head') || b.classList.contains('co-tx'))) host = b.closest('.b-toggle,.callout');
    const nb = make(kind, innerOf(host).replace(/^<br>$/, ''));
    if (host.classList.contains('callout') && nb.classList.contains('callout')) nb.dataset.color = host.dataset.color;
    if (host.dataset.color && !nb.classList.contains('callout')) nb.dataset.color = host.dataset.color;
    host.replaceWith(nb);
    if (kind === 'hr') { const p = make('p'); nb.after(p); focusStart(p); } else focusEnd(nb);
    return nb;
  }
  function splitListAt(list, li, replacement) {
    const after = [...list.children].slice([...list.children].indexOf(li) + 1);
    li.remove();
    list.after(replacement);
    if (after.length) { const rest = el(list.tagName.toLowerCase()); after.forEach(x => rest.appendChild(x)); replacement.after(rest); }
    if (!list.children.length) list.remove();
  }
  /* Insert a block after the block the caret is in (or at the end). */
  function insertAfter(ref, kind, ed, t) {
    if (kind === 'page') {
      const p = create({ parentId: t.id }); p.updated = Date.now();
      const a = el('div', 'b-page'); a.dataset.page = p.id; a.setAttribute('contenteditable', 'false');
      placeAfter(ref, a, ed); save(); ed._changed && ed._changed();
      clearTimeout(saveTimer); t.html = clean(ed.innerHTML); save();
      S.settings.diaryOpen = Object.assign({}, S.settings.diaryOpen, { [t.id]: true });
      open(p.id); const ti = document.querySelector('.dy-title'); if (ti) ti.focus();
      return null;
    }
    const nb = make(kind);
    placeAfter(ref, nb, ed);
    if (kind === 'hr') { const p = make('p'); nb.after(p); focusStart(p); } else focusStart(nb);
    return nb;
  }
  function placeAfter(ref, nb, ed) {
    const host = ref ? topBlock(ref, ed) : null;
    if (host && host.parentNode) host.after(nb); else ed.appendChild(nb);
  }
  function insertInline(text) { document.execCommand('insertText', false, text); }

  /* ---------- the editor ---------- */
  const MD = { '### ': 'h3', '## ': 'h2', '# ': 'h1', '[ ] ': 'todo', '[] ': 'todo', '``` ': 'code', '1. ': 'ol', '- ': 'ul', '* ': 'ul', '+ ': 'ul', '> ': 'toggle', '" ': 'quote' };
  const MD_KEYS = Object.keys(MD);
  let SLASH = null;
  function wireEditor(ed, t, changed) {
    ed.onkeydown = e => {
      if (t.locked) return;
      if (SLASH && slashKey(e, ed, t, changed)) return;
      const b = caretBlock(ed);
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && /^[biu]$/i.test(e.key)) { e.preventDefault(); document.execCommand({ b: 'bold', i: 'italic', u: 'underline' }[e.key.toLowerCase()]); changed(); return; }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 's') { e.preventDefault(); document.execCommand('strikeThrough'); changed(); return; }
      if (!b) return;
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        const host = topBlock(b, ed);
        if (host.classList.contains('todo')) {
          e.preventDefault();
          if (!blockText(host)) { turnInto(host, 'p', ed); return changed(); }
          const rest = splitOff(host.querySelector('span')); const nb = make('todo', rest); host.after(nb); focusStart(nb.querySelector('span')); return changed();
        }
        if (b.classList.contains('tg-head')) { e.preventDefault(); const tg = b.closest('.b-toggle'); tg.classList.add('open'); let body = tg.querySelector('.tg-body'); let first = body.firstElementChild; if (!first) { first = make('p'); body.appendChild(first); } focusStart(first); return changed(); }
        if (/^H[1-3]$/.test(host.tagName) && atEnd(host)) { e.preventDefault(); const p = make('p'); host.after(p); focusStart(p); return changed(); }
        // Quote and callout: Enter at the end starts a new text block; in the middle it breaks the line.
        // Code: Enter is a new line; Enter on an empty last line leaves the block.
        if (host.tagName === 'BLOCKQUOTE' || host.classList.contains('callout')) { e.preventDefault(); if (atEnd(host)) { const p = make('p'); host.after(p); focusStart(p); } else document.execCommand('insertLineBreak'); return changed(); }
        if (host.tagName === 'PRE') { e.preventDefault(); if (atEnd(host) && /\n\s*$/.test(host.textContent) && blockText(host)) { host.textContent = host.textContent.replace(/\n\s*$/, ''); const p = make('p'); host.after(p); focusStart(p); } else document.execCommand('insertText', false, '\n'); return changed(); }
        if (b.parentNode && b.parentNode.classList && b.parentNode.classList.contains('tg-body') && !blockText(b) && b === b.parentNode.lastElementChild && b.tagName === 'P') { e.preventDefault(); const tg = b.closest('.b-toggle'); b.remove(); if (!tg.querySelector('.tg-body').children.length) tg.querySelector('.tg-body').appendChild(make('p')); const p = make('p'); tg.after(p); focusStart(p); return changed(); }
      }
      if (e.key === 'Backspace' && atStart(b) && getSelection().isCollapsed) {
        const host = topBlock(b, ed);
        if (b.classList.contains('tg-head') || host.classList.contains('todo') || /^H[1-3]$/.test(host.tagName) || host.tagName === 'BLOCKQUOTE' || host.classList.contains('callout') || host.tagName === 'PRE') { e.preventDefault(); const p = turnInto(host, 'p', ed); focusStart(p); return changed(); }
        const prev = host.previousElementSibling;
        if (prev && (prev.tagName === 'HR' || prev.classList.contains('b-page') || prev.classList.contains('b-sticker')) && b === host) { e.preventDefault(); prev.remove(); return changed(); }
      }
      if (e.key === 'Tab' && b.tagName === 'LI') { e.preventDefault(); document.execCommand(e.shiftKey ? 'outdent' : 'indent'); return changed(); }
    };
    /* Work from the text as typed (not key presses), so it also works with phone keyboards and pasted letters. */
    ed.addEventListener('input', e => {
      if (t.locked) return;
      const s = getSelection(); if (!s.rangeCount) return;
      const data = e.data || '';
      if (SLASH) { slashQuery() === null ? closeMenus() : drawSlash(); return; }
      if (e.inputType !== 'insertText' || !data) return;
      const node = s.anchorNode, off = s.anchorOffset;
      if (data.includes('/') && node.nodeType === 3) { const start = off - data.length + data.lastIndexOf('/'); const before = node.textContent[start - 1]; if (start === 0 || !before || /\s/.test(before)) { openSlash(ed, t, changed, false, start); return; } }
      const b = caretBlock(ed); if (!b || b.closest && b.closest('.tg-head')) return;
      const holder = (b.querySelector && b.querySelector('.todo span')) || b;
      const r = document.createRange(); r.selectNodeContents(holder); try { r.setEnd(node, off); } catch (x) { return; }
      const typed = r.toString().replace(/\u00a0/g, ' ');
      // The shortcut must be at the very start of the block and must have just been completed by this input.
      const prefix = MD_KEYS.find(k => typed.startsWith(k) && typed.length - data.length < k.length);
      const kind = prefix ? MD[prefix] : (typed === '---' && b.tagName === 'P' ? 'hr' : null);
      if (!kind) return;
      if (prefix) { const w = document.createTreeWalker(holder, NodeFilter.SHOW_TEXT); let left = prefix.length, n; while (left > 0 && (n = w.nextNode())) { const k = Math.min(left, n.data.length); n.deleteData(0, k); left -= k; } }
      else r.deleteContents();
      if (b.tagName === 'LI' && (kind === 'ul' || kind === 'ol')) return changed();
      if (b.tagName === 'LI' || /^(UL|OL)$/.test(b.parentNode.tagName)) { turnInto(b, kind, ed); return changed(); }
      turnInto(topBlock(b, ed), kind, ed); changed();
    });
    ed.onclick = e => {
      if (e.target.matches('.todo input')) { if (t.locked) { e.preventDefault(); return; } e.target.toggleAttribute('checked', e.target.checked); if (e.target.checked) cheer(e.target); changed(); return; }
      const ar = e.target.closest('.tg-arrow'); if (ar) { ar.closest('.b-toggle').classList.toggle('open'); changed(); return; }
      const pg = e.target.closest('.b-page'); if (pg) { clearTimeout(saveTimer); t.html = clean(ed.innerHTML); save(); return open(pg.dataset.page); }
      const ci = e.target.closest('.co-ic'); if (ci && !t.locked) { iconMenu(ci, ic => { ci.textContent = ic; changed(); }); return; }
    };
    ed.onpaste = e => {
      const html = e.clipboardData.getData('text/html'), text = e.clipboardData.getData('text/plain');
      if (!html && !text) return;
      e.preventDefault();
      if (html) { const d = tmp(html); d.querySelectorAll('script,style,meta,link,iframe,object,img,svg').forEach(x => x.remove()); d.querySelectorAll('*').forEach(x => { [...x.attributes].forEach(a => { if (!['href', 'type', 'checked'].includes(a.name)) x.removeAttribute(a.name); }); if (x.tagName === 'A') { x.setAttribute('target', '_blank'); x.setAttribute('rel', 'noopener noreferrer'); if (!/^https?:/i.test(x.getAttribute('href') || '')) x.removeAttribute('href'); } }); document.execCommand('insertHTML', false, d.innerHTML); }
      else document.execCommand('insertText', false, text);
      changed();
    };
    document.onselectionchange = () => selBar(ed, t, changed);
    wireHandles(ed, t, changed);
  }
  /* Cut everything after the caret out of `holder` and return it as HTML (for Enter in a to-do). */
  function splitOff(holder) {
    const s = getSelection(); if (!s.rangeCount) return '';
    const r = document.createRange(); r.selectNodeContents(holder); r.setStart(s.anchorNode, s.anchorOffset);
    const frag = r.extractContents(); const d = el('div'); d.appendChild(frag); return d.innerHTML.replace(/^(<br>)+$/, '');
  }
  /* A little burst when a to-do is ticked. */
  function cheer(input) {
    const r = input.getBoundingClientRect();
    for (let i = 0; i < 8; i++) { const s = el('span', 'dy-burst'); s.textContent = pick(['✨', '⭐', '🎉', '💫']); s.style.left = r.left + 'px'; s.style.top = r.top + 'px'; s.style.setProperty('--x', (Math.random() * 80 - 40) + 'px'); s.style.setProperty('--y', (-30 - Math.random() * 40) + 'px'); document.body.appendChild(s); setTimeout(() => s.remove(), 700); }
  }

  /* ---------- "/" menu ---------- */
  function caretRect() { const s = getSelection(); if (!s.rangeCount) return null; const r = s.getRangeAt(0).cloneRange(); let rect = r.getClientRects()[0]; if (!rect) { const sp = el('span'); sp.textContent = '​'; r.insertNode(sp); rect = sp.getBoundingClientRect(); sp.remove(); } return rect; }
  function openSlash(ed, t, changed, viaButton, at) {
    closeMenus();
    const s = getSelection(); if (!s.rangeCount) return;
    const node = s.anchorNode, off = s.anchorOffset;
    const start = viaButton ? off : (at !== undefined ? at : off - 1);
    if (!viaButton && (node.nodeType !== 3 || node.textContent[start] !== '/')) return;
    const rect = caretRect() || ed.getBoundingClientRect();
    const box = el('div', 'dy-menu dy-slash'); box.setAttribute('role', 'listbox'); document.body.appendChild(box);
    SLASH = { box, node, start, ed, t, changed, i: 0, list: BLOCKS, via: !!viaButton, q: '' };
    place(box, rect);
    drawSlash();
    box.onmousedown = e => e.preventDefault();
    box.onclick = e => { const it = e.target.closest('[data-k]'); if (it) chooseSlash(it.dataset.k); };
  }
  function slashQuery() {
    const S2 = SLASH; if (S2.via) return S2.q;
    const txt = S2.node.textContent || ''; const s = getSelection();
    if (!s.rangeCount || s.anchorNode !== S2.node || txt[S2.start] !== '/') return null;
    return txt.slice(S2.start + 1, s.anchorOffset);
  }
  function drawSlash() {
    const raw = slashQuery();
    if (raw === null || raw.length > 20 || /\s{2}/.test(raw)) return closeMenus();
    const q = raw.toLowerCase();
    SLASH.list = BLOCKS.filter(b => !q || b[2].toLowerCase().includes(q) || b[4].includes(q));
    if (!SLASH.list.length) { SLASH.box.innerHTML = '<div class="dy-mh">No matching blocks</div>'; return; }
    SLASH.i = Math.min(SLASH.i, SLASH.list.length - 1);
    SLASH.box.innerHTML = `<div class="dy-mh">Blocks</div>` + SLASH.list.map((b, i) => `<button class="dy-mi ${i === SLASH.i ? 'on' : ''}" data-k="${b[0]}" role="option"><span class="mi-ic">${b[1]}</span><span><b>${b[2]}</b><small>${b[3]}</small></span></button>`).join('');
    const on = SLASH.box.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function slashKey(e, ed) {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && SLASH.list.length) { e.preventDefault(); SLASH.i = (SLASH.i + (e.key === 'ArrowDown' ? 1 : -1) + SLASH.list.length) % SLASH.list.length; drawSlash(); return true; }
    if (e.key === 'Enter' || e.key === 'Tab') { if (SLASH.list[SLASH.i]) { e.preventDefault(); chooseSlash(SLASH.list[SLASH.i][0]); return true; } }
    if (e.key === 'Escape') { e.preventDefault(); closeMenus(); return true; }
    return false;
  }
  function chooseSlash(kind) {
    const { node, start, ed, t, changed, via } = SLASH; closeMenus();
    if (!via) { const s = getSelection(); const end = s.anchorNode === node ? s.anchorOffset : start + 1; const r = document.createRange(); r.setStart(node, start); r.setEnd(node, Math.max(end, start + 1)); r.deleteContents(); s.removeAllRanges(); const c = document.createRange(); c.setStart(node, start); c.collapse(true); s.addRange(c); }
    let b = caretBlock(ed);
    if (kind === 'date') { insertInline(today()); return changed(); }
    if (kind === 'emoji') { const r = getSelection().rangeCount ? getSelection().getRangeAt(0).cloneRange() : null; return iconMenu(caretRect() ? { getBoundingClientRect: caretRect } : ed, ic => { if (r) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); } ed.focus(); insertInline(ic); changed(); }); }
    if (kind === 'image') return pickImage(b, ed, changed);
    if (kind === 'drawing') return drawPad(b, ed, changed);
    if (kind === 'voice') return recordVoice(b, ed, changed);
    if (kind === 'dictate') return dictate(ed, changed);
    if (kind === 'sticker') { const ref = b; return iconMenu(caretRect() ? { getBoundingClientRect: caretRect } : ed, ic => { const st = el('div', 'b-sticker'); st.setAttribute('contenteditable', 'false'); st.textContent = ic; placeAfter(ref, st, ed); if (ref && !blockText(ref) && ref.tagName === 'P') ref.remove(); const p = make('p'); st.after(p); focusStart(p); changed(); }); }
    if (kind === 'mood') return moodMenu(caretRect() ? { getBoundingClientRect: caretRect } : ed, mo => { t.mood = mo; save(); const m = MOODS.find(x => x[0] === mo); if (m) insertInline(`${m[0]} Feeling ${m[1].toLowerCase()} `); changed(); });
    const empty = b && !blockText(b) && !(b.querySelector && b.querySelector('img'));
    if (kind === 'page') { if (empty && b.tagName === 'P') { const ref = b.previousElementSibling; b.remove(); return insertAfter(ref, 'page', ed, t); } return insertAfter(b, 'page', ed, t); }
    if (b && empty && !b.closest('.tg-head')) { turnInto(b, kind, ed); }
    else insertAfter(b, kind, ed, t);
    changed();
  }
  function closeMenus() { document.querySelectorAll('.dy-menu').forEach(m => m.remove()); SLASH = null; }
  function place(box, rect) {
    const w = box.offsetWidth || 280, h = box.offsetHeight || 300, pad = 10;
    let top = rect.bottom + 6; if (top + h > innerHeight - pad) top = Math.max(pad, rect.top - h - 6);
    box.style.left = Math.max(pad, Math.min(innerWidth - w - pad, rect.left)) + 'px'; box.style.top = top + 'px';
  }
  document.addEventListener('mousedown', e => { if (!e.target.closest('.dy-menu') && !e.target.closest('[data-icon],[data-cover],[data-mood],[data-starter],.dy-handle,.dy-plus,.co-ic,[data-mo]')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && document.querySelector('.dy-menu') && !SLASH) closeMenus(); });
  addEventListener('resize', closeMenus);

  /* ---------- pickers ---------- */
  function popup(anchor, cls, html) {
    closeMenus();
    const box = el('div', 'dy-menu ' + cls); box.innerHTML = html; document.body.appendChild(box);
    box.onmousedown = e => e.preventDefault(); // keep the writing's caret where it was
    place(box, anchor.getBoundingClientRect()); return box;
  }
  function iconMenu(anchor, done) {
    const draw = q => Object.entries(EMOJI).map(([cat, list]) => `<div class="dy-mh">${cat}</div><div class="dy-emo">${list.map(e => `<button data-e="${e}">${e}</button>`).join('')}</div>`).join('');
    const box = popup(anchor, 'dy-picker', `<div class="dy-pk-top"><button data-rand>🎲 Surprise me</button></div>${draw()}`);
    box.onclick = e => { const b = e.target.closest('[data-e]'); if (b) { done(b.dataset.e); closeMenus(); } if (e.target.closest('[data-rand]')) { done(pick(allEmoji())); closeMenus(); } };
  }
  function coverMenu(anchor, done) {
    const box = popup(anchor, 'dy-picker dy-covers', `<div class="dy-mh">Pick a cover</div><div class="dy-cv-grid">${Object.entries(COVERS).map(([k, [n, bg]]) => `<button data-cv="${k}" title="${n}"><span style="background:${bg}"></span>${n}</button>`).join('')}</div>`);
    box.onclick = e => { const b = e.target.closest('[data-cv]'); if (b) { done(b.dataset.cv); closeMenus(); } };
  }
  function moodMenu(anchor, done) {
    const box = popup(anchor, 'dy-picker dy-moods', `<div class="dy-mh">How are you feeling?</div><div class="dy-mood-grid">${MOODS.map(([e, l]) => `<button data-mo2="${e}"><span>${e}</span>${l}</button>`).join('')}</div><button class="dy-mi" data-mo2="">Clear mood</button>`);
    box.onclick = e => { const b = e.target.closest('[data-mo2]'); if (b) { done(b.dataset.mo2 || null); closeMenus(); } };
  }
  function starterMenu(anchor, done) {
    const box = popup(anchor, 'dy-picker', `<div class="dy-mh">Writing ideas</div>${starters().map(s => `<button class="dy-mi" data-st="${esc(s)}"><span class="mi-ic">✏️</span><span><b>${esc(s)}</b></span></button>`).join('')}`);
    box.onclick = e => { const b = e.target.closest('[data-st]'); if (b) { done(b.dataset.st); closeMenus(); } };
  }

  /* ---------- text toolbar on selection ---------- */
  let BAR = null;
  function selBar(ed, t, changed) {
    const s = getSelection();
    const inside = s.rangeCount && !s.isCollapsed && ed.contains(s.anchorNode) && ed.contains(s.focusNode) && !t.locked;
    if (!inside) { if (BAR && !BAR.contains(document.activeElement) && !BAR.matches(':hover')) { BAR.remove(); BAR = null; } return; }
    if (!BAR) {
      BAR = el('div', 'dy-bar'); BAR.setAttribute('role', 'toolbar');
      BAR.innerHTML = `<button data-f="bold" title="Bold"><b>B</b></button><button data-f="italic" title="Italic"><i>I</i></button><button data-f="underline" title="Underline"><u>U</u></button><button data-f="strikeThrough" title="Strike"><s>S</s></button><button data-f="code" title="Code">&lt;/&gt;</button><span class="sep"></span><button data-f="color" title="Colour">A<span class="caret">▾</span></button><button data-f="turn" title="Turn into">Turn into ▾</button>`;
      document.body.appendChild(BAR);
      BAR.onmousedown = e => e.preventDefault();
      BAR.onclick = e => {
        const b = e.target.closest('[data-f]'); const c = e.target.closest('[data-col]');
        if (c) { const [kind, name] = c.dataset.col.split(':'); applyColor(kind, name); changed(); return; }
        const tk = e.target.closest('[data-turn]'); if (tk) { const blk = caretBlock(ed); if (blk) turnInto(blk, tk.dataset.turn, ed); changed(); BAR.remove(); BAR = null; return; }
        if (!b) return; const f = b.dataset.f;
        if (f === 'code') { const r = s.getRangeAt(0); const txt = r.toString(); document.execCommand('insertHTML', false, `<code>${esc(txt)}</code>`); }
        else if (f === 'color') { toggleSub(colorsHTML()); return; }
        else if (f === 'turn') { toggleSub(BLOCKS.filter(x => TURN.includes(x[0])).map(x => `<button class="dy-mi" data-turn="${x[0]}"><span class="mi-ic">${x[1]}</span><span><b>${x[2]}</b></span></button>`).join('')); return; }
        else document.execCommand(f);
        changed();
      };
    }
    const r = s.getRangeAt(0).getBoundingClientRect();
    BAR.style.left = Math.max(8, Math.min(innerWidth - BAR.offsetWidth - 8, r.left + r.width / 2 - BAR.offsetWidth / 2)) + 'px';
    BAR.style.top = Math.max(8, r.top - BAR.offsetHeight - 8) + 'px';
  }
  function toggleSub(html) { let sub = BAR.querySelector('.dy-sub'); if (sub) { sub.remove(); return; } sub = el('div', 'dy-sub'); sub.innerHTML = html; BAR.appendChild(sub); }
  const colorsHTML = () => `<div class="dy-mh">Text colour</div>${COLORS.map(([k, l]) => `<button class="dy-mi" data-col="c:${k}"><span class="mi-ic c-${k}">A</span><span><b>${l}</b></span></button>`).join('')}<div class="dy-mh">Highlight</div>${COLORS.map(([k, l]) => `<button class="dy-mi" data-col="h:${k}"><span class="mi-ic hl-${k}">A</span><span><b>${l} background</b></span></button>`).join('')}`;
  function applyColor(kind, name) {
    const s = getSelection(); if (!s.rangeCount || s.isCollapsed) return;
    const r = s.getRangeAt(0); const span = el('span'); if (name !== 'default') span.className = (kind === 'c' ? 'c-' : 'hl-') + name;
    const frag = r.extractContents();
    // A fresh colour replaces any colour inside the selection.
    frag.querySelectorAll && frag.querySelectorAll(`span[class^="${kind === 'c' ? 'c-' : 'hl-'}"]`).forEach(x => x.replaceWith(...x.childNodes));
    span.appendChild(frag);
    if (name === 'default') r.insertNode(document.createRange().createContextualFragment(span.innerHTML)); else r.insertNode(span);
    if (BAR) { const sub = BAR.querySelector('.dy-sub'); if (sub) sub.remove(); }
  }

  /* ---------- block handles: + to add, ⋮⋮ to drag or open the block menu ---------- */
  let HOVER = null, DRAG = null;
  function wireHandles(ed, t, changed) {
    const wrap = document.querySelector('.dy-page'); if (!wrap) return;
    const g = el('div', 'dy-gutter'); g.innerHTML = '<button class="dy-plus" title="Add a block below" aria-label="Add a block below">+</button><button class="dy-handle" draggable="true" title="Drag to move · click for options" aria-label="Block options">⋮⋮</button>';
    wrap.appendChild(g);
    const show = b => { HOVER = b; if (!b) { g.style.opacity = 0; return; } const wr = wrap.getBoundingClientRect(), r = b.getBoundingClientRect(); const lh = parseFloat(getComputedStyle(b).lineHeight) || 24; g.style.top = (r.top - wr.top + Math.min(r.height, lh) / 2 - 12) + 'px'; g.style.opacity = 1; };
    ed.addEventListener('mousemove', e => { if (DRAG || t.locked) return; let n = e.target; while (n && n.parentNode !== ed) n = n.parentNode; if (n && n !== ed) show(n); });
    wrap.addEventListener('mouseleave', () => { if (!DRAG) show(null); });
    g.querySelector('.dy-plus').onclick = () => { if (!HOVER) return; const p = make('p'); HOVER.after(p); focusStart(p); insertInline('/'); openSlash(ed, t, changed); };
    const h = g.querySelector('.dy-handle');
    h.onclick = () => { if (!HOVER) return; blockMenu(h, HOVER, ed, changed); };
    h.ondragstart = e => { if (!HOVER) return; DRAG = HOVER; DRAG.classList.add('dy-dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); try { e.dataTransfer.setDragImage(DRAG, 0, 0); } catch (x) {} };
    const line = el('div', 'dy-dropline'); wrap.appendChild(line);
    let target = null, before = false;
    ed.addEventListener('dragover', e => { if (!DRAG) return; e.preventDefault(); let n = e.target; while (n && n.parentNode !== ed) n = n.parentNode; if (!n || n === ed) { n = ed.lastElementChild; } if (!n) return; const r = n.getBoundingClientRect(), wr = wrap.getBoundingClientRect(); before = e.clientY < r.top + r.height / 2; target = n; line.style.top = ((before ? r.top : r.bottom) - wr.top) + 'px'; line.style.opacity = 1; });
    const end = () => { if (DRAG) DRAG.classList.remove('dy-dragging'); DRAG = null; target = null; line.style.opacity = 0; };
    ed.addEventListener('drop', e => { if (!DRAG) return; e.preventDefault(); if (target && target !== DRAG) { if (before) target.before(DRAG); else target.after(DRAG); changed(); } end(); });
    h.ondragend = end;
  }
  function blockMenu(anchor, b, ed, changed) {
    const box = popup(anchor, 'dy-picker', `<div class="dy-mh">Turn into</div>${BLOCKS.filter(x => TURN.includes(x[0])).map(x => `<button class="dy-mi" data-bt="${x[0]}"><span class="mi-ic">${x[1]}</span><span><b>${x[2]}</b></span></button>`).join('')}
      <div class="dy-mh">Colour</div><div class="dy-colrow">${COLORS.map(([k, l]) => `<button data-bc="${k}" title="${l}" class="bc-${k}"></button>`).join('')}</div>
      <div class="dy-mh">Actions</div><button class="dy-mi" data-ba="up"><span class="mi-ic">↑</span><span><b>Move up</b></span></button><button class="dy-mi" data-ba="down"><span class="mi-ic">↓</span><span><b>Move down</b></span></button><button class="dy-mi" data-ba="dup"><span class="mi-ic">⧉</span><span><b>Duplicate</b></span></button><button class="dy-mi danger" data-ba="del"><span class="mi-ic">🗑️</span><span><b>Delete</b></span></button>`);
    box.onclick = e => {
      const bt = e.target.closest('[data-bt]'); if (bt) { const inner = b.matches('ul,ol') ? b.firstElementChild : b.classList.contains('b-toggle') ? b.querySelector('.tg-head') : b.classList.contains('callout') ? b.querySelector('.co-tx') : b; turnInto(inner, bt.dataset.bt, ed); }
      const bc = e.target.closest('[data-bc]'); if (bc) { if (bc.dataset.bc === 'default') delete b.dataset.color; else b.dataset.color = bc.dataset.bc; }
      const ba = e.target.closest('[data-ba]'); if (ba) { const a = ba.dataset.ba; if (a === 'up' && b.previousElementSibling) b.previousElementSibling.before(b); if (a === 'down' && b.nextElementSibling) b.nextElementSibling.after(b); if (a === 'dup') { if (b.classList.contains('b-page')) return toast('Pages inside can’t be duplicated here. Open it and use ⋯ › Duplicate.'); b.after(b.cloneNode(true)); } if (a === 'del') { b.remove(); if (!ed.children.length) ed.appendChild(make('p')); } }
      if (bt || bc || ba) { closeMenus(); changed(); }
    };
  }

  /* ---------- phones: a small toolbar, since there is no hover ---------- */
  function mobile(k, ed, changed) {
    const t = th(); if (t.locked) return toast('This page is locked. Unlock it from ⋯ to write.');
    if (!ed.contains(getSelection().anchorNode)) focusEnd(ed.lastElementChild || ed);
    const b = caretBlock(ed);
    if (k === 'slash') { openSlash(ed, t, changed, true); return; }
    if (k === 'bold' || k === 'italic') { document.execCommand(k); return changed(); }
    if (k === 'image') return pickImage(b, ed, changed);
    if (k === 'dictate') return dictate(ed, changed, document.querySelector('[data-mo="dictate"]'));
    if (k === 'sticker') { SLASH = { node: null, start: 0, ed, t, changed, via: true }; return chooseSlash('sticker'); }
    if (b && !blockText(b)) turnInto(b, k, ed); else insertAfter(b, k, ed, t);
    changed();
  }

  /* ---------- top bar: breadcrumb, ☆ and ⋯ ---------- */
  function topBar(t) {
    const tt = $('#topTitle'); tt.hidden = false; tt.classList.add('dy-crumbs');
    tt.innerHTML = `<button data-crumb-home>📔 ${esc(owner())}</button>` + trail(t).map(p => `<span class="sl">/</span><button data-crumb="${p.id}"><span class="dy-ic">${esc(p.icon)}</span>${esc(p.title || 'Untitled')}</button>`).join('');
    tt.onclick = e => { if (e.target.closest('[data-crumb-home]')) { S.mode = 'diary'; save(); return render(); } const c = e.target.closest('[data-crumb]'); if (c) open(c.dataset.crumb); };
    const fav = $('#pgFav'), more = $('#pgMore');
    fav.hidden = more.hidden = false;
    fav.textContent = t.fav ? '★' : '☆'; fav.classList.toggle('on', !!t.fav); fav.title = t.fav ? 'Remove from favourites' : 'Add to favourites'; fav.setAttribute('aria-label', fav.title);
    fav.onclick = () => { t.fav = !t.fav; save(); renderSide(); topBar(t); toast(t.fav ? 'Added to favourites' : 'Removed from favourites'); };
    more.onclick = () => pageMenu(more, t);
  }
  function plainTop() { const tt = $('#topTitle'); tt.classList.remove('dy-crumbs'); tt.onclick = null; $('#pgFav').hidden = $('#pgMore').hidden = true; }
  function pageMenu(anchor, t) {
    const box = popup(anchor, 'dy-picker dy-pmenu', `<div class="dy-mh">Style</div><div class="dy-fonts">${Object.entries(FONTS).map(([k, l]) => `<button data-font="${k}" class="${(t.font || 'sans') === k ? 'on' : ''} f-${k}"><b>Ag</b>${l}</button>`).join('')}</div>
      <button class="dy-mi" data-pm="wide"><span class="mi-ic">↔</span><span><b>Full width</b></span><span class="sw ${t.wide ? 'on' : ''}"></span></button>
      <button class="dy-mi" data-pm="lock"><span class="mi-ic">🔒</span><span><b>Lock page</b><small>Stops changes by accident</small></span><span class="sw ${t.locked ? 'on' : ''}"></span></button>
      <div class="dy-mh">Page</div>
      <button class="dy-mi" data-pm="sub"><span class="mi-ic">📄</span><span><b>Add a page inside</b></span></button>
      <button class="dy-mi" data-pm="dup"><span class="mi-ic">⧉</span><span><b>Duplicate</b></span></button>
      <button class="dy-mi" data-pm="history"><span class="mi-ic">🕘</span><span><b>Page history</b><small>Go back to an earlier version</small></span></button>
      <button class="dy-mi" data-pm="download"><span class="mi-ic">⬇️</span><span><b>Download this page</b></span></button>
      ${typeof LM !== 'undefined' && LM.enabled ? `<button class="dy-mi" data-pm="exclude"><span class="mi-ic">🌍</span><span><b>Use for my lessons</b><small>Spark may pick safe interests from this page</small></span><span class="sw ${LM.excluded[t.id] ? '' : 'on'}"></span></button>` : ''}
      <button class="dy-mi" data-pm="move"><span class="mi-ic">↪</span><span><b>Move to…</b></span></button>
      <button class="dy-mi danger" data-pm="del"><span class="mi-ic">🗑️</span><span><b>Move to bin</b></span></button>
      <div class="dy-foot">${words(t)} words · created ${fmt(t.created).toLowerCase()} · edited ${fmt(t.updated).toLowerCase()}</div>`);
    box.style.left = ''; box.style.right = '12px';
    box.onclick = e => {
      const f = e.target.closest('[data-font]'); if (f) { t.font = f.dataset.font; save(); closeMenus(); return renderPage(t); }
      const p = e.target.closest('[data-pm]'); if (!p) return; const a = p.dataset.pm; closeMenus();
      if (a === 'wide') { t.wide = !t.wide; save(); renderPage(t); }
      if (a === 'lock') { t.locked = !t.locked; save(); renderPage(t); toast(t.locked ? 'Page locked' : 'Page unlocked'); }
      if (a === 'sub') newPage(t.id);
      if (a === 'history') historyMenu(anchor, t);
      if (a === 'download') exportDiary([t], (t.title || 'page').replace(/[^\w -]/g, '').slice(0, 40) || 'page');
      if (a === 'exclude') { SparkLearn.setExcluded(LM, t.id, !LM.excluded[t.id]); saveLM(); toast(LM.excluded[t.id] ? 'Spark won’t use this page for your lessons' : 'Spark may use safe interests from this page'); if (!LM.excluded[t.id]) setTimeout(() => pumpLearn().catch(() => {}), 500); }
      if (a === 'dup') duplicate(t);
      if (a === 'del') trash(t);
      if (a === 'move') moveMenu(anchor, t);
    };
  }
  function moveMenu(anchor, t) {
    const bad = new Set([t.id, ...descendants(t.id).map(x => x.id)]);
    const opts = live().filter(p => !bad.has(p.id));
    const box = popup(anchor, 'dy-picker dy-pmenu', `<div class="dy-mh">Move “${esc(t.title || 'Untitled')}” to</div><button class="dy-mi" data-mv=""><span class="mi-ic">📔</span><span><b>${esc(owner())} (top level)</b></span></button>${opts.map(p => `<button class="dy-mi" data-mv="${p.id}"><span class="mi-ic">${esc(p.icon)}</span><span><b>${esc(p.title || 'Untitled')}</b></span></button>`).join('')}`);
    box.style.left = ''; box.style.right = '12px';
    box.onclick = e => { const b = e.target.closest('[data-mv]'); if (!b) return; t.parentId = b.dataset.mv || null; t.order = Date.now(); save(); closeMenus(); render(); toast('Page moved'); };
  }

  /* ---------- pictures, drawings and voice notes ----------
     Files stay on this device in IndexedDB (never in the page text, which has to stay small). A page keeps only a
     reference (data-file); the picture or sound is loaded when the page opens. */
  const fileId = () => 'dyf:' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const URLS = new Map();
  async function loadMedia(root) {
    for (const box of root.querySelectorAll('.b-img[data-file], .b-audio[data-file]')) {
      box.setAttribute('contenteditable', 'false');
      const id = box.dataset.file, tag = box.classList.contains('b-img') ? 'img' : 'audio';
      let elm = box.querySelector(tag); if (!elm) { elm = el(tag); if (tag === 'audio') elm.controls = true; box.prepend(elm); }
      try {
        let u = URLS.get(id);
        if (!u) { const f = await idb.get(id); if (!f || !f.blob) { box.classList.add('missing'); continue; } u = URL.createObjectURL(f.blob); URLS.set(id, u); }
        elm.src = u;
      } catch (e) { box.classList.add('missing'); }
    }
  }
  function placeMedia(ref, ed, html, changed) {
    const box = tmp(html).firstElementChild;
    placeAfter(ref, box, ed);
    if (ref && ref.tagName === 'P' && !blockText(ref)) ref.remove();
    const p = make('p'); box.after(p); focusStart(p);
    loadMedia(ed); changed();
  }
  /* Photos are shrunk to at most 1600 px before saving, so a page full of pictures still loads instantly. */
  function shrink(file, max = 1600) {
    return new Promise((res, rej) => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => { const k = Math.min(1, max / Math.max(img.width, img.height)); const c = el('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(u); c.toBlob(b => (b ? res(b) : rej(new Error('Could not read that picture'))), 'image/jpeg', 0.85); };
      img.onerror = () => { URL.revokeObjectURL(u); rej(new Error('That file isn’t a picture Spark can open')); };
      img.src = u;
    });
  }
  function pickImage(ref, ed, changed) {
    const inp = el('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      if (!/^image\//.test(f.type)) return toast('Please pick a picture.');
      if (f.size > 25 * 1024 * 1024) return toast('That picture is too big (over 25 MB).');
      try { const blob = await shrink(f); const id = fileId(); await idb.put({ id, blob, kind: 'diary-image', ts: Date.now() }); placeMedia(ref, ed, `<figure class="b-img" contenteditable="false" data-file="${id}"><img alt="My picture"></figure>`, changed); }
      catch (e) { toast(e.message || 'Couldn’t add that picture.'); }
    };
    inp.click();
  }
  function modal(html) {
    closeMenus();
    const m = el('div', 'dy-modal'); m.innerHTML = `<div class="dy-modal-in" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(m); return m;
  }
  /* A drawing pad: colours, brush sizes, eraser, undo and clear. Works with a finger, a pen or a mouse. */
  function drawPad(ref, ed, changed) {
    const COL = ['#1f1f2e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#8b5a2b'];
    const m = modal(`<div class="dp-top"><b>🎨 Draw something</b><span class="sp"></span><button data-dp="undo" title="Undo">↶</button><button data-dp="clear">Clear</button></div>
      <canvas class="dp-canvas" width="900" height="600" aria-label="Drawing area"></canvas>
      <div class="dp-tools">${COL.map((c, i) => `<button class="dp-c ${i ? '' : 'on'}" data-col="${c}" style="background:${c}" aria-label="Colour"></button>`).join('')}<span class="sep"></span>${[4, 10, 20].map((w, i) => `<button class="dp-w ${i ? '' : 'on'}" data-w="${w}" aria-label="Brush size ${w}"><i style="width:${w}px;height:${w}px"></i></button>`).join('')}<button class="dp-e" data-eraser title="Eraser">🧽</button></div>
      <div class="dp-acts"><button data-dp="cancel">Cancel</button><button class="pri" data-dp="save">Add to my page</button></div>`);
    const cv = m.querySelector('canvas'), cx = cv.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.lineCap = cx.lineJoin = 'round';
    let col = COL[0], w = 4, erase = false, down = false, last = null; const undo = [];
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; };
    cv.onpointerdown = e => { down = true; cv.setPointerCapture(e.pointerId); undo.push(cx.getImageData(0, 0, cv.width, cv.height)); if (undo.length > 20) undo.shift(); last = pos(e); cx.beginPath(); cx.arc(last[0], last[1], w / 2, 0, 7); cx.fillStyle = erase ? '#fff' : col; cx.fill(); };
    cv.onpointermove = e => { if (!down) return; const p = pos(e); cx.strokeStyle = erase ? '#fff' : col; cx.lineWidth = erase ? w * 3 : w; cx.beginPath(); cx.moveTo(last[0], last[1]); cx.lineTo(p[0], p[1]); cx.stroke(); last = p; };
    cv.onpointerup = cv.onpointercancel = () => { down = false; };
    m.onclick = async e => {
      const c = e.target.closest('[data-col]'); if (c) { col = c.dataset.col; erase = false; m.querySelectorAll('.dp-c,.dp-e').forEach(x => x.classList.toggle('on', x === c)); return; }
      const ww = e.target.closest('[data-w]'); if (ww) { w = Number(ww.dataset.w); m.querySelectorAll('.dp-w').forEach(x => x.classList.toggle('on', x === ww)); return; }
      if (e.target.closest('[data-eraser]')) { erase = true; m.querySelectorAll('.dp-c,.dp-e').forEach(x => x.classList.toggle('on', x.hasAttribute('data-eraser'))); return; }
      const a = e.target.closest('[data-dp]'); if (!a) return;
      if (a.dataset.dp === 'undo' && undo.length) cx.putImageData(undo.pop(), 0, 0);
      if (a.dataset.dp === 'clear') { undo.push(cx.getImageData(0, 0, cv.width, cv.height)); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); }
      if (a.dataset.dp === 'cancel') m.remove();
      if (a.dataset.dp === 'save') {
        cv.toBlob(async blob => { try { const id = fileId(); await idb.put({ id, blob, kind: 'diary-drawing', ts: Date.now() }); m.remove(); placeMedia(ref, ed, `<figure class="b-img drawing" contenteditable="false" data-file="${id}"><img alt="My drawing"></figure>`, changed); } catch (err) { toast('Couldn’t save the drawing.'); } }, 'image/png');
      }
    };
  }
  /* A voice note: record, listen back, then keep or try again. Up to 5 minutes. */
  async function recordVoice(ref, ed, changed) {
    if (!navigator.mediaDevices || !window.MediaRecorder) return toast('Voice notes aren’t supported in this browser.');
    let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { return toast('Spark needs microphone permission to record.'); }
    const m = modal(`<div class="vr"><div class="vr-dot"></div><b class="vr-t">0:00</b><p class="dy-muted">Recording… say whatever you like.</p><audio controls hidden></audio>
      <div class="dp-acts"><button data-vr="cancel">Cancel</button><button class="pri" data-vr="stop">⏹ Stop</button><button data-vr="again" hidden>Record again</button><button class="pri" data-vr="keep" hidden>Add to my page</button></div></div>`);
    let chunks = [], rec, blob = null, start, tick;
    const begin = () => { chunks = []; rec = new MediaRecorder(stream); rec.ondataavailable = e => e.data.size && chunks.push(e.data); rec.onstop = () => { blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' }); const a = m.querySelector('audio'); a.src = URL.createObjectURL(blob); a.hidden = false; }; rec.start(); start = Date.now(); m.querySelector('.vr').classList.add('on');
      tick = setInterval(() => { const s = Math.floor((Date.now() - start) / 1000); m.querySelector('.vr-t').textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (s >= 300) stop(); }, 250); };
    const stop = () => { clearInterval(tick); if (rec && rec.state !== 'inactive') rec.stop(); m.querySelector('.vr').classList.remove('on'); m.querySelector('[data-vr="stop"]').hidden = true; m.querySelector('[data-vr="again"]').hidden = m.querySelector('[data-vr="keep"]').hidden = false; m.querySelector('.vr p').textContent = 'Listen back, then keep it or try again.'; };
    const end = () => { clearInterval(tick); try { if (rec && rec.state !== 'inactive') rec.stop(); } catch (e) {} stream.getTracks().forEach(x => x.stop()); m.remove(); };
    m.onclick = async e => {
      const a = e.target.closest('[data-vr]'); if (!a) return;
      if (a.dataset.vr === 'stop') stop();
      if (a.dataset.vr === 'cancel') end();
      if (a.dataset.vr === 'again') { m.querySelector('audio').hidden = true; m.querySelector('[data-vr="stop"]').hidden = false; m.querySelector('[data-vr="again"]').hidden = m.querySelector('[data-vr="keep"]').hidden = true; m.querySelector('.vr p').textContent = 'Recording…'; begin(); }
      if (a.dataset.vr === 'keep' && blob) { const id = fileId(); try { await idb.put({ id, blob, kind: 'diary-voice', ts: Date.now() }); } catch (err) { return toast('Couldn’t save the voice note.'); } end(); placeMedia(ref, ed, `<div class="b-audio" contenteditable="false" data-file="${id}"><span class="au-ic">🎙️</span></div>`, changed); }
    };
    begin();
  }
  /* Talk to type: the browser's own speech recognition writes what the child says where the cursor is. */
  let DICT = null;
  function dictate(ed, changed, btn) {
    if (DICT) { DICT.stop(); return; }
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) return toast('Talk to type isn’t supported in this browser. Try Chrome or Edge.');
    if (!ed.contains(getSelection().anchorNode)) focusEnd(ed.lastElementChild || ed);
    const r = new R(); r.continuous = true; r.interimResults = false; r.lang = S.settings.lang === 'hi' ? 'hi-IN' : 'en-IN';
    r.onresult = e => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) { const txt = e.results[i][0].transcript.trim(); if (txt) { ed.focus(); insertInline(txt.charAt(0).toUpperCase() + txt.slice(1) + ' '); changed(); } } };
    const off = () => { DICT = null; document.querySelectorAll('[data-dictate],[data-mo="dictate"]').forEach(b => b.classList.remove('rec')); };
    r.onend = off; r.onerror = e => { off(); if (e.error === 'not-allowed') toast('Spark needs microphone permission for talk to type.'); };
    try { r.start(); DICT = r; document.querySelectorAll('[data-dictate],[data-mo="dictate"]').forEach(b => b.classList.add('rec')); toast('Listening… tap 🎤 again to stop'); } catch (e) { off(); }
  }

  /* ---------- page history ----------
     Up to 30 earlier versions per page, at most one every 3 minutes, kept on this device. */
  async function snapshot(t, force) {
    try {
      const id = 'dyv:' + t.id, rec = (await idb.get(id)) || { id, list: [] };
      const last = rec.list[rec.list.length - 1];
      if (!force && last && Date.now() - last.at < 180000) { last.html = t.html; last.title = t.title; last.at = Date.now(); }
      else rec.list.push({ at: Date.now(), title: t.title, html: t.html });
      if (rec.list.length > 30) rec.list = rec.list.slice(-30);
      await idb.put(rec);
    } catch (e) { /* history is a nice-to-have; saving the page already happened */ }
  }
  async function historyMenu(anchor, t) {
    const rec = await idb.get('dyv:' + t.id).catch(() => null), list = rec ? rec.list.slice().reverse() : [];
    const box = popup(anchor, 'dy-picker dy-pmenu', `<div class="dy-mh">Page history</div>${list.length ? list.map((v, i) => `<button class="dy-mi" data-ver="${i}"><span class="mi-ic">🕘</span><span><b>${esc(new Date(v.at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }))}</b><small>${esc((tmp(v.html).textContent || '').trim().slice(0, 60) || 'Empty page')}</small></span></button>`).join('') : '<p class="dy-empty">No earlier versions yet.</p>'}`);
    box.style.left = ''; box.style.right = '12px';
    box.onclick = async e => {
      const b = e.target.closest('[data-ver]'); if (!b) return; const v = list[Number(b.dataset.ver)];
      if (!confirm('Go back to this version? Your current version is kept in the history too.')) return;
      await snapshot(t, true);
      t.html = v.html; t.title = v.title || t.title; t.updated = Date.now(); save(); closeMenus(); renderSide(); renderPage(t); toast('Earlier version restored');
    };
  }

  /* ---------- the same page open in two tabs ----------
     Each save tells other tabs. A tab with no unsaved typing simply takes the newer copy; a tab in the middle of
     typing asks which to keep, so neither tab silently overwrites the other. */
  const BC = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('spark-diary') : null;
  function announce(t) { if (BC) BC.postMessage({ id: t.id, rev: t.rev, html: t.html, title: t.title, updated: t.updated }); }
  if (BC) BC.onmessage = e => {
    const d = e.data || {}, t = byId(d.id); if (!t || (d.updated || 0) <= (t.updated || 0)) return;
    const open = S.mode === 'thought' && th() === t && $('#editor');
    if (open && PENDING) {
      if (document.querySelector('.dy-conflict')) return;
      const bar = el('div', 'dy-conflict'); bar.innerHTML = `<span>This page was changed in another tab.</span><button data-cf="mine">Keep mine</button><button data-cf="theirs">Use the other one</button>`;
      document.querySelector('.dy-meta').after(bar);
      bar.onclick = ev => { const c = ev.target.closest('[data-cf]'); if (!c) return; bar.remove(); if (c.dataset.cf === 'mine') flush(); else { PENDING = null; clearTimeout(saveTimer); Object.assign(t, { html: d.html, title: d.title, updated: d.updated, rev: d.rev }); renderPage(t); } };
      return;
    }
    Object.assign(t, { html: d.html, title: d.title, updated: d.updated, rev: d.rev });
    if (open) renderPage(t); else renderSide();
  };

  /* ---------- download ----------
     A single web page with the writing, pictures and drawings (voice notes are listed by name). */
  async function exportDiary(pages, name) {
    const blobUrl = async id => { try { const f = await idb.get(id); if (!f || !f.blob) return ''; return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f.blob); }); } catch (e) { return ''; } };
    const parts = [];
    for (const t of pages.slice().sort((a, b) => (a.created || 0) - (b.created || 0))) {
      const d = tmp(t.html || '');
      for (const fig of d.querySelectorAll('.b-img[data-file]')) { const src = await blobUrl(fig.dataset.file); fig.innerHTML = src ? `<img src="${src}" alt="">` : '<em>(picture)</em>'; }
      d.querySelectorAll('.b-audio').forEach(a => { a.innerHTML = '<em>🎙️ Voice note (kept in Spark)</em>'; });
      d.querySelectorAll('.b-page').forEach(a => { const p = byId(a.dataset.page); a.textContent = '📄 ' + (p ? p.title || 'Untitled' : 'A page'); });
      d.querySelectorAll('[contenteditable]').forEach(x => x.removeAttribute('contenteditable'));
      const mo = MOODS.find(x => x[0] === t.mood);
      parts.push(`<article><h1>${esc(t.icon || '')} ${esc(t.title || 'Untitled')}</h1><p class="meta">${esc(new Date(t.created).toLocaleString())}${mo ? ' · ' + mo[0] + ' ' + mo[1] : ''}${(t.tags || []).length ? ' · ' + t.tags.map(g => '#' + esc(g)).join(' ') : ''}</p>${d.innerHTML}</article>`);
    }
    const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(owner())}</title><style>body{font:16px/1.65 -apple-system,Segoe UI,Roboto,sans-serif;max-width:760px;margin:40px auto;padding:0 20px;color:#222}article{border-bottom:1px solid #ddd;padding-bottom:28px;margin-bottom:28px}h1{font-size:28px}.meta{color:#888;font-size:13px}img{max-width:100%;border-radius:8px}.callout{background:#f6f3e8;padding:12px 14px;border-radius:8px;display:flex;gap:8px}.todo{display:flex;gap:8px}blockquote{border-left:3px solid #222;margin:0;padding-left:14px}</style></head><body><h1 style="font-size:36px">📔 ${esc(owner())}</h1><p class="meta">Downloaded ${esc(new Date().toLocaleString())} · ${pages.length} page${pages.length === 1 ? '' : 's'}</p>${parts.join('')}</body></html>`;
    const a = el('a'); a.href = URL.createObjectURL(new Blob([doc], { type: 'text/html' })); a.download = (name || 'my-diary') + '.html'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Your diary is downloading');
  }

  /* ---------- My Learning World ----------
     What Spark may use from the diary to make lessons familiar, in the student's words, with full control. */
  let WORLD = { busy: false, msg: '' };
  function renderWorld() {
    const allowed = typeof lmAllowed === 'function' ? lmAllowed() : true, on = !!LM.enabled && allowed;
    const P = SparkLearn.profile(LM), sum = SparkLearn.summary(LM);
    const pages = live();
    const chip = x => `<span class="lw-chip ${x.usable ? '' : 'maybe'}" title="${x.usable ? 'Spark can use this' : 'Spark isn’t sure yet'}"><span class="lw-v">${esc(x.name)}</span><span class="lw-dots" aria-label="${Math.round(x.confidence * 100)}% sure">${'●'.repeat(Math.max(1, Math.round(x.confidence * 3)))}${'○'.repeat(3 - Math.max(1, Math.round(x.confidence * 3)))}</span><button data-why="${x.id}" aria-label="Why is ${esc(x.name)} here?" title="Why is this here?">?</button><button data-fix="${x.id}" aria-label="Change ${esc(x.name)}" title="Change">✎</button><button data-rm="${x.id}" aria-label="Remove ${esc(x.name)}" title="Remove">×</button></span>`;
    const section = cat => { const c = SparkLearn.CATS[cat], items = P.categories[cat];
      return `<section class="lw-sec"><h3>${c.icon} ${c.label}</h3><div class="lw-chips">${items.length ? items.map(chip).join('') : '<span class="dy-muted">Nothing yet.</span>'}
        ${cat === 'style' ? SparkLearn.STYLES.filter(st => !items.some(i => i.name === st)).map(st => `<button class="lw-add-style" data-addstyle="${esc(st)}">+ ${esc(st)}</button>`).join('') : `<button class="lw-add" data-add="${cat}">+ Add</button>`}</div></section>`; };
    const jobs = LM.jobs, failed = Object.values(jobs).filter(j => j.status === 'failed').length;
    const status = !on ? '' : WORLD.msg || (Object.values(jobs).some(j => j.status === 'running') ? 'Spark is reading your pages…' : failed ? `${failed} page${failed === 1 ? '' : 's'} couldn’t be read yet. Spark will try again by itself.` : '');
    const used = LM.log.slice(-8).reverse().filter(l => l.used.length);
    $('#view').innerHTML = `<div class="lw-page"><div class="lw-in">
      <header class="lw-hero">${typeof buddyImg === 'function' ? buddyImg('lw-buddy', true) : ''}<div><h1>My Learning World</h1>
        <p class="lw-sum">${on ? (sum ? esc(sum) : 'As you write in your diary, Spark will notice things you enjoy, like sports, animals or baking, and use them to make lessons feel familiar.') : 'Spark can use things you enjoy, like cricket, animals or baking, to explain new ideas with examples you know. It’s off until you turn it on.'}</p></div></header>
      <div class="lw-card lw-switch"><div><b>Use my diary to personalise my lessons</b><p>${allowed ? 'You can turn this on or off any time. Spark works just the same without it.' : 'Your parent has turned this off in Parent View.'}</p></div>
        <button class="lw-tg ${on ? 'on' : ''}" role="switch" aria-checked="${on}" ${allowed ? '' : 'disabled'} data-toggle aria-label="Use my diary to personalise my lessons"><span></span></button></div>
      <details class="lw-card lw-how" ${on ? '' : 'open'}><summary>How Spark uses this</summary><ul>
        <li>🔒 <b>Your diary stays private.</b> Spark never replies to it, never shows it to anyone (not even Parent View) and never quotes it in lessons.</li>
        <li>🧩 <b>Spark keeps only short, safe words</b> like “cricket”, “baking” or “school trip”, never your sentences. Each one shows which pages it came from.</li>
        <li>🚫 <b>Never kept:</b> feelings, health, family or friendship problems, religion, politics, names or anything private. One mention isn’t enough either; Spark waits until it’s clear you enjoy something.</li>
        <li>✏️ <b>You’re in charge:</b> remove or change anything, add your own, choose which pages count, or delete it all below.</li>
        <li>🤖 When this is on, the writing on a page is sent once to Spark’s AI to pick out these words. It isn’t stored there by Spark.</li></ul></details>
      ${status ? `<p class="lw-status">${esc(status)}</p>` : ''}
      ${on ? `<div class="lw-grid">${['interest', 'activity', 'object', 'experience', 'subject_like', 'subject_hard', 'style'].map(section).join('')}</div>
      ${P.removed.length ? `<section class="lw-sec"><h3>🗑️ Removed</h3><p class="dy-muted">Spark won’t use or re-add these.</p><div class="lw-chips">${P.removed.map(x => `<span class="lw-chip maybe"><span class="lw-v">${esc(x.name)}</span><button data-undo="${x.id}" title="Bring back">↺</button></span>`).join('')}</div></section>` : ''}
      <section class="lw-sec"><h3>📔 Pages Spark can learn from</h3><p class="dy-muted">Turn a page off and everything it added goes away.</p>
        <div class="lw-pages">${pages.length ? pages.map(t => { const j = jobs[t.id], ex = !!LM.excluded[t.id]; const st = ex ? 'Not used' : !j ? 'Waiting' : j.status === 'done' ? 'Read' : j.status === 'failed' ? 'Will retry' : 'Reading…'; return `<label class="lw-pg"><input type="checkbox" data-incl="${t.id}" ${ex ? '' : 'checked'}><span class="dy-ic">${esc(t.icon || '📄')}</span><span class="t">${esc(t.title || 'Untitled')}</span><span class="lw-st">${st}</span></label>`; }).join('') : '<p class="dy-muted">No diary pages yet.</p>'}</div></section>
      ${used.length ? `<section class="lw-sec"><h3>✨ Recently in your lessons</h3><ul class="lw-log">${used.map(l => `<li><b>${esc(l.used.join(', '))}</b> helped explain <i>${esc(l.topic || 'a lesson')}</i></li>`).join('')}</ul></section>` : ''}` : ''}
      <section class="lw-sec lw-danger"><h3>⚙️ Your data</h3><div class="lw-acts">
        ${on ? `<button data-rebuild ${WORLD.busy ? 'disabled' : ''}>🔄 Re-read all my pages</button>` : ''}
        <button data-export>⬇️ Download my diary</button>
        <button class="danger" data-wipe>Delete my learning world</button>
        <button class="danger" data-wipe-all>Delete all diary pages</button></div></section>
    </div></div>`;
    const root = $('#view').querySelector('.lw-page');
    root.onclick = async e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.hasAttribute('data-toggle')) { LM.enabled = !LM.enabled; S.settings.readThoughts = LM.enabled; saveLM(); save(); if (LM.enabled) { WORLD.msg = 'Spark is reading your pages…'; renderWorld(); pumpLearn().catch(() => {}).finally(() => { WORLD.msg = ''; renderWorld(); }); } else renderWorld(); return; }
      if (b.dataset.why) { const m = LM.memories.find(x => x.id === b.dataset.why); const src = [...new Set(m.sources.map(x => x.entry))].map(byId).filter(Boolean);
        const box = popup(b, 'dy-picker', `<div class="dy-mh">Why “${esc(m.value)}” is here</div>${m.manual ? '<p class="lw-why">You added this yourself.</p>' : ''}${src.length ? `<p class="lw-why">Spark noticed it on ${src.length} page${src.length === 1 ? '' : 's'}${m.explicit ? ' where you said you enjoy it' : ''}:</p>${src.map(p => `<button class="dy-mi" data-open-pg="${p.id}"><span class="mi-ic">${esc(p.icon)}</span><span><b>${esc(p.title || 'Untitled')}</b><small>${esc(fmt(p.updated))}</small></span></button>`).join('')}` : ''}<p class="lw-why">${SparkLearn.usable(m) ? 'Spark can use it in your lessons.' : 'Spark isn’t sure yet, so it won’t use it until it comes up again.'}</p>`);
        box.onclick = ev => { const o = ev.target.closest('[data-open-pg]'); if (o) { closeMenus(); open(o.dataset.openPg); } }; return; }
      if (b.dataset.rm) { SparkLearn.remove(LM, b.dataset.rm); saveLM(); return renderWorld(); }
      if (b.dataset.undo) { SparkLearn.restoreMemory(LM, b.dataset.undo); saveLM(); return renderWorld(); }
      if (b.dataset.fix) { const m = LM.memories.find(x => x.id === b.dataset.fix); const v = prompt(`Change “${m.value}” to:`, m.value); if (v == null) return; if (!SparkLearn.correct(LM, m.id, v)) return toast('Spark can only keep a few plain words, and nothing private.'); saveLM(); return renderWorld(); }
      if (b.dataset.add) { const c = SparkLearn.CATS[b.dataset.add]; const v = prompt(`Add ${c.one === 'interest' ? 'an' : 'a'} ${c.one} (a few words, like “football” or “science fair”):`); if (!v) return; if (!SparkLearn.addManual(LM, b.dataset.add, v)) return toast(b.dataset.add.startsWith('subject') ? 'Try a school subject or topic, like “science” or “fractions”.' : 'Spark can only keep a few plain words, and nothing private.'); saveLM(); return renderWorld(); }
      if (b.dataset.addstyle) { SparkLearn.addManual(LM, 'style', b.dataset.addstyle); saveLM(); return renderWorld(); }
      if (b.hasAttribute('data-rebuild')) { if (!hasAI()) return toast('Spark needs its AI connection to read pages.'); WORLD.busy = true; WORLD.msg = 'Re-reading your pages…'; renderWorld(); try { await pumpLearn({ force: true }); toast('Your learning world is up to date'); } finally { WORLD.busy = false; WORLD.msg = ''; renderWorld(); } return; }
      if (b.hasAttribute('data-export')) return exportDiary(live());
      if (b.hasAttribute('data-wipe')) { if (!confirm('Delete everything in My Learning World? Your diary pages stay. Spark will forget your interests (it can learn them again if personalisation stays on).')) return; SparkLearn.wipe(LM); LM.enabled = false; S.settings.readThoughts = false; saveLM(); save(); toast('Your learning world was deleted and personalisation is off'); return renderWorld(); }
      if (b.hasAttribute('data-wipe-all')) { const n = S.thoughts.length; if (!n) return toast('There are no diary pages.'); const v = prompt(`This deletes all ${n} diary page${n === 1 ? '' : 's'}, their pictures and history, forever. Type DELETE to confirm.`); if (v !== 'DELETE') return; destroyAll(); SparkLearn.wipe(LM); saveLM(); toast('All diary pages were deleted'); S.mode = 'world'; save(); return render(); }
    };
    root.onchange = e => { const c = e.target.closest('[data-incl]'); if (!c) return; SparkLearn.setExcluded(LM, c.dataset.incl, !c.checked); saveLM(); if (c.checked) pumpLearn().catch(() => {}).finally(renderWorld); else renderWorld(); };
  }

  return { renderWorld, flush, destroyAll, exportDiary, calendarHTML, dayKey, COVERS, MOODS, normalize, create, newPage, open, trash, restore, renderHome, renderPage, sideHTML, wireSide, topBar, plainTop, owner, live, kids, trail, closeMenus, TEMPLATES };
})();
