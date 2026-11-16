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
    save(); render();
    toast(`Moved “${t.title || 'Untitled'}” to the bin. You can bring it back from ${owner()}.`);
  }
  function restore(t) { const p = t.parentId && byId(t.parentId); if (!p || p.trashed) t.parentId = null; const when = t.trashed; for (const x of [t, ...descendants(t.id)]) if (x.trashed === when) delete x.trashed; save(); render(); toast('Page brought back'); }
  function destroy(t) {
    if (!confirm(`Delete “${t.title || 'Untitled'}” forever? Its writing and Spark chat can’t be brought back.`)) return;
    const gone = new Set([t.id, ...descendants(t.id).map(x => x.id)]);
    S.thoughts = S.thoughts.filter(x => !gone.has(x.id));
    save(); render();
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
  let HOME = { tab: 'recent', q: '', sort: 'updated' };
  function renderHome() {
    const name = (S.settings.name || '').trim().split(/\s+/)[0];
    const hr = new Date().getHours(), hi = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
    const all = live(), bin = S.thoughts.filter(t => t.trashed);
    $('#view').innerHTML = `<div class="dy-home-page"><div class="dy-cover-home" style="background:${COVERS[S.settings.diaryCover || 'candy'][1]}"><button class="dy-cover-btn" data-home-cover>Change cover</button></div>
      <div class="dy-home-in">
        <div class="dy-home-ic">📔</div>
        <div class="dy-home-head"><div><h1>${esc(owner())}</h1><p class="dy-subtitle">${hi}${name ? ', ' + esc(name) : ''}! Your private space. Only you can see it. Spark joins a page only if you switch it on.</p></div>
          <button class="dy-new" data-new-page>New page</button></div>
        <div class="dy-stats"><span><b>${all.length}</b> page${all.length === 1 ? '' : 's'}</span><span><b>${all.reduce((n, t) => n + words(t), 0)}</b> words written</span><span><b>${streak()}</b>🔥 day streak</span></div>
        <h2 class="dy-h">Start with a template</h2>
        <div class="dy-tpls">${TPL_LIST.map(([k, ic, l]) => `<button class="dy-tpl" data-tpl="${k}"><span>${ic}</span>${l}</button>`).join('')}</div>
        <div class="dy-tabs" role="tablist">
          ${[['recent', '🕒', 'Recents'], ['fav', '⭐', 'Favourites'], ['mood', '🌈', 'Moods'], ['spark', '✦', 'With Spark'], ['bin', '🗑️', `Bin${bin.length ? ' · ' + bin.length : ''}`]].map(([k, ic, l]) => `<button role="tab" class="dy-tab ${HOME.tab === k ? 'on' : ''}" data-htab="${k}" aria-selected="${HOME.tab === k}">${ic} ${l}</button>`).join('')}
          <span class="sp"></span><label class="dy-search">🔍<input id="dySearch" placeholder="Search pages" value="${esc(HOME.q)}" aria-label="Search diary pages"></label>
        </div>
        <div id="dyTable"></div>
      </div></div>`;
    table();
    $('#dySearch').oninput = e => { HOME.q = e.target.value; table(); };
    $('#view').querySelector('.dy-home-page').onclick = e => {
      const tb = e.target.closest('[data-htab]'); if (tb) { HOME.tab = tb.dataset.htab; return renderHome(); }
      const tp = e.target.closest('[data-tpl]'); if (tp) return newPage(null, tp.dataset.tpl);
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
    if (q) rows = rows.filter(t => (t.title || '').toLowerCase().includes(q) || pageText(t).toLowerCase().includes(q));
    const key = HOME.sort;
    rows.sort((a, b) => key === 'title' ? (a.title || '').localeCompare(b.title || '') : (b[key] || 0) - (a[key] || 0));
    const empty = { recent: 'No pages yet. Press New page or pick a template.', fav: 'No favourites yet. Open a page and tap ☆ at the top.', mood: 'No moods yet. Open a page and tap “Add mood”.', spark: 'Spark isn’t switched on for any page.', bin: 'The bin is empty.' }[HOME.tab];
    const th = (k, l, ic) => `<th><button data-sort="${k}" class="${key === k ? 'on' : ''}">${ic} ${l}</button></th>`;
    box.innerHTML = rows.length ? `<table class="dy-table"><thead><tr>${th('title', 'Page name', '📄')}<th class="pl">🌈 Mood</th><th class="pl">📁 Inside</th>${th('created', 'Created', '🗓️')}${th('updated', 'Last edited', '🕒')}${HOME.tab === 'bin' ? '<th class="pl"></th>' : ''}</tr></thead><tbody>
      ${rows.map(t => { const p = t.parentId && byId(t.parentId); const m = MOODS.find(x => x[0] === t.mood);
        return `<tr ${HOME.tab === 'bin' ? '' : `data-row="${t.id}" tabindex="0"`}><td class="dy-name"><span class="dy-nm"><span class="dy-ic">${esc(t.icon || '📄')}</span>${esc(t.title || 'Untitled')}${t.fav ? ' <span class="dy-star">★</span>' : ''}</span></td><td>${m ? `<span class="dy-chip">${m[0]} ${m[1]}</span>` : ''}</td><td>${p ? `<span class="dy-chip soft">${esc(p.icon)} ${esc(p.title || 'Untitled')}</span>` : '<span class="dy-muted">Diary</span>'}</td><td>${fmt(t.created)}</td><td>${fmt(t.updated)}</td>${HOME.tab === 'bin' ? `<td class="dy-acts"><button data-restore="${t.id}">Bring back</button><button data-destroy="${t.id}" class="danger">Delete forever</button></td>` : ''}</tr>`; }).join('')}
    </tbody></table>` : `<p class="dy-empty">${empty}</p>`;
    box.querySelectorAll('tr[data-row]').forEach(tr => tr.onkeydown = e => { if (e.key === 'Enter') open(tr.dataset.row); });
  }

  /* ---------- a page ---------- */
  let saveTimer = null;
  function renderPage(t) {
    const tr = trail(t), m = MOODS.find(x => x[0] === t.mood);
    const cover = t.cover && COVERS[t.cover];
    $('#view').innerHTML = `<div class="tpage ${t.chatOn ? 'with-chat' : ''}">
      <div class="notes-wrap dy-wrap" id="notesWrap">
        ${cover ? `<div class="dy-cover" style="background:${cover[1]}"><div class="dy-cover-acts"><button data-cover>Change cover</button><button data-cover-off>Remove</button></div></div>` : ''}
        <div class="dy-page ${t.wide ? 'wide' : ''} f-${t.font || 'sans'} ${cover ? '' : 'no-cover'}">
          <button class="dy-icon" data-icon aria-label="Change page icon" title="Change icon">${esc(t.icon || '📄')}</button>
          <div class="dy-adders">${cover ? '' : '<button data-cover>🖼️ Add cover</button>'}${m ? '' : '<button data-mood>😊 Add mood</button>'}<button data-starter>💡 Need an idea?</button></div>
          <h1 class="dy-title" contenteditable="${t.locked ? 'false' : 'true'}" spellcheck="true" data-ph="Untitled" aria-label="Page title">${esc(t.title || '')}</h1>
          <div class="dy-meta">${m ? `<button class="dy-chip" data-mood>${m[0]} Feeling ${m[1].toLowerCase()}</button>` : ''}<span>${tr.length > 1 ? `In ${tr.slice(0, -1).map(p => `<button class="dy-link" data-go-page="${p.id}">${esc(p.icon)} ${esc(p.title || 'Untitled')}</button>`).join(' / ')} · ` : ''}Edited ${fmt(t.updated).toLowerCase()}</span><span id="dyWords">${words(t)} words</span><span class="saved" id="savedLbl">Saved</span>${t.locked ? '<span class="dy-chip soft">🔒 Locked</span>' : ''}</div>
          ${privateHTML(t)}
          <div class="editor dy-editor" id="editor" contenteditable="${t.locked ? 'false' : 'true'}" spellcheck="true" aria-label="Page" data-ph="Write something, or type / for blocks">${t.html || ''}</div>
          <button class="dy-click-end" id="dyEnd" aria-label="Add a line at the end"></button>
        </div>
        <div class="dy-mobar" aria-label="Writing tools"><button data-mo="slash">＋ Block</button><button data-mo="todo">☐</button><button data-mo="ul">•</button><button data-mo="h2">H</button><button data-mo="bold"><b>B</b></button><button data-mo="italic"><i>I</i></button><button data-mo="sticker">😀</button></div>
      </div>
      ${t.chatOn ? '<aside class="tchat" id="tchat" aria-label="Talk with Spark about this page"></aside>' : ''}
    </div>`;
    refreshPageLinks();
    if (!$('#editor').firstElementChild) $('#editor').innerHTML = '<p><br></p>';
    const ed = $('#editor'), title = document.querySelector('.dy-title');
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    const changed = () => {
      $('#savedLbl').textContent = 'Saving…'; clearTimeout(saveTimer);
      saveTimer = setTimeout(() => { t.html = clean(ed.innerHTML); t.updated = Date.now(); save(); renderSide(); const l = $('#savedLbl'); if (l) l.textContent = 'Saved'; const w = $('#dyWords'); if (w) w.textContent = words(t) + ' words'; scheduleThoughtLearning(t); }, 400);
      ed.classList.toggle('is-empty', !ed.textContent.trim() && !ed.querySelector('hr,.b-page,.todo,.callout,img'));
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
      if (b.dataset.mo) return mobile(b.dataset.mo, ed, changed);
    });
    if (t.chatOn) renderThoughtChat();
    if (!t.html && t.title) focusStart(ed);
  }
  /* Titles of linked sub-pages are kept up to date, and links to deleted pages disappear. */
  function refreshPageLinks() {
    document.querySelectorAll('#editor .b-page').forEach(a => { const p = byId(a.dataset.page); if (!p || p.trashed) return a.remove(); a.innerHTML = `<span class="dy-ic">${esc(p.icon)}</span><span>${esc(p.title || 'Untitled')}</span>`; a.setAttribute('contenteditable', 'false'); });
  }
  const clean = html => html.replace(/\s(?:draggable|data-drop)="[^"]*"/g, '').replace(/<div class="dy-drop[^"]*"><\/div>/g, '');

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
    const box = popup(anchor, 'dy-picker', `<div class="dy-mh">Writing ideas</div>${STARTERS.map(s => `<button class="dy-mi" data-st="${esc(s)}"><span class="mi-ic">✏️</span><span><b>${esc(s)}</b></span></button>`).join('')}`);
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

  return { COVERS, MOODS, normalize, create, newPage, open, trash, restore, renderHome, renderPage, sideHTML, wireSide, topBar, plainTop, owner, live, kids, trail, closeMenus, TEMPLATES };
})();
