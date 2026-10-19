// RC Pair characters page. Picks a built-in face or checks, previews, keeps and hands back a dropped file.
// The file never leaves this browser: no fetch of it, no form post. The only storage is IndexedDB, and only
// after the visitor presses "Keep it in this browser".
(function () {
  var C = window.RCChars;
  var $ = function (id) { return document.getElementById(id); };
  var DB = 'rcpair-characters';
  var state = { pick: 'worker', mine: null, kept: false, useMine: false, previewUrl: null };

  // ---------- storage (every call can fail in a private window; the page works without it) ----------
  function db() {
    return new Promise(function (res, rej) {
      try {
        var r = indexedDB.open(DB, 1);
        r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
        r.onsuccess = function () { res(r.result); };
        r.onerror = function () { rej(r.error); };
      } catch (e) { rej(e); }
    });
  }
  function kv(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', mode), s = t.objectStore('kv'), out = fn(s);
        t.oncomplete = function () { d.close(); res(out && out.result); };
        t.onerror = t.onabort = function () { d.close(); rej(t.error); };
      });
    });
  }
  var load = function (k) { return kv('readonly', function (s) { return s.get(k); }).catch(function () { return undefined; }); };
  var save = function (k, v) { return kv('readwrite', function (s) { return s.put(v, k); }); };
  var drop = function (k) { return kv('readwrite', function (s) { return s.delete(k); }); };

  function sha256(buf) {
    if (!(window.crypto && crypto.subtle)) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', buf).then(function (h) {
      return Array.prototype.map.call(new Uint8Array(h), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    });
  }

  // ---------- portraits for the built-in faces (drawings, the companion draws the real thing) ----------
  var ART = {
    worker: '<svg viewBox="0 0 120 140" role="img" aria-label="A site hand in a navy hard hat"><rect x="38" y="104" width="16" height="26" rx="5" fill="#3A3F57"/><rect x="66" y="104" width="16" height="26" rx="5" fill="#3A3F57"/><rect x="30" y="64" width="60" height="46" rx="10" fill="#FF8A2B" stroke="#161824" stroke-width="3"/><rect x="26" y="68" width="10" height="34" rx="5" fill="#FF8A2B" stroke="#161824" stroke-width="3"/><rect x="84" y="68" width="10" height="34" rx="5" fill="#FF8A2B" stroke="#161824" stroke-width="3"/><rect x="36" y="94" width="48" height="8" fill="#161824"/><rect x="50" y="92" width="20" height="12" rx="2" fill="#C9CEDD" stroke="#161824" stroke-width="2"/><rect x="34" y="26" width="52" height="44" rx="10" fill="#FF8A2B" stroke="#161824" stroke-width="3"/><circle cx="50" cy="48" r="3.6" fill="#161824"/><circle cx="70" cy="48" r="3.6" fill="#161824"/><path d="M50 58q10 8 20 0" stroke="#161824" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M28 32q0-24 32-24t32 24z" fill="#242B6B" stroke="#161824" stroke-width="3"/><rect x="24" y="30" width="72" height="8" rx="4" fill="#242B6B" stroke="#161824" stroke-width="3"/><path d="M50 12v18M60 9v21M70 12v18" stroke="#3A4290" stroke-width="3"/></svg>',
    buddy: '<svg viewBox="0 0 120 140" role="img" aria-label="A round orange buddy"><ellipse cx="60" cy="126" rx="26" ry="5" fill="#161824" opacity=".4"/><circle cx="60" cy="72" r="46" fill="#FF5600"/><circle cx="60" cy="72" r="46" fill="url(#g1)"/><defs><radialGradient id="g1" cx=".35" cy=".3"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="44" cy="66" rx="7" ry="10" fill="#fff"/><ellipse cx="76" cy="66" rx="7" ry="10" fill="#fff"/><circle cx="46" cy="68" r="4.5" fill="#161824"/><circle cx="78" cy="68" r="4.5" fill="#161824"/><path d="M46 90q14 10 28 0" stroke="#161824" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="34" cy="84" r="6" fill="#FF8A5C" opacity=".7"/><circle cx="86" cy="84" r="6" fill="#FF8A5C" opacity=".7"/></svg>',
    duck: '<svg viewBox="0 0 120 140" role="img" aria-label="A duck with a duckling"><ellipse cx="60" cy="124" rx="44" ry="6" fill="#161824" opacity=".4"/><ellipse cx="56" cy="92" rx="34" ry="28" fill="#FFD23F"/><path d="M30 92q-10-6-6-18 12 4 14 14z" fill="#F2B90F"/><ellipse cx="62" cy="96" rx="16" ry="12" fill="#F2B90F"/><circle cx="76" cy="52" r="22" fill="#FFD23F"/><path d="M70 30q6-8 12 0-5 2-12 0z" fill="#F2B90F"/><circle cx="82" cy="48" r="3.4" fill="#161824"/><path d="M92 54q16-2 18 5-10 6-20 1z" fill="#FF8A1F"/><ellipse cx="106" cy="118" rx="10" ry="8" fill="#FFE27A"/><circle cx="112" cy="108" r="6" fill="#FFE27A"/><circle cx="114" cy="107" r="1.4" fill="#161824"/></svg>',
    pixel: '<img src="files/pixel-duck.png" alt="A pixel-art duck" width="96" height="96">',
    robot: '<svg viewBox="0 0 120 140" role="img" aria-label="A friendly robot"><rect x="40" y="100" width="14" height="26" rx="4" fill="#9AA3BD"/><rect x="66" y="100" width="14" height="26" rx="4" fill="#9AA3BD"/><rect x="30" y="58" width="60" height="50" rx="10" fill="#E8ECF6"/><rect x="18" y="62" width="12" height="36" rx="6" fill="#9AA3BD"/><rect x="90" y="62" width="12" height="36" rx="6" fill="#9AA3BD"/><circle cx="60" cy="84" r="8" fill="#FF5600"/><rect x="34" y="22" width="52" height="40" rx="12" fill="#E8ECF6"/><rect x="42" y="34" width="36" height="16" rx="8" fill="#242735"/><circle cx="52" cy="42" r="4" fill="#7DF3FF"/><circle cx="68" cy="42" r="4" fill="#7DF3FF"/><path d="M60 22V10" stroke="#9AA3BD" stroke-width="3"/><circle cx="60" cy="9" r="4" fill="#FF5600"/></svg>'
  };

  var facesEl = $('faces');
  function renderFaces() {
    facesEl.innerHTML = '';
    C.BUILT_IN.forEach(function (f) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button'; b.className = 'face'; b.dataset.id = f.id;
      b.setAttribute('aria-pressed', String(state.pick === f.id));
      b.innerHTML = '<div class="art">' + ART[f.id] + '</div><b></b><span class="note"></span><span class="tick"></span>';
      b.querySelector('b').textContent = f.name;
      b.querySelector('.note').textContent = f.note;
      b.querySelector('.tick').textContent = state.pick === f.id ? 'Your pick' : '';
      b.addEventListener('click', function () { state.pick = f.id; state.useMine = false; renderFaces(); renderUse(); var nb = facesEl.querySelector('[data-id="' + f.id + '"]'); if (nb) nb.focus(); });
      li.appendChild(b); facesEl.appendChild(li);
    });
  }

  // ---------- "Put it on your desktop" ----------
  function el(tag, text, cls) { var e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; }
  function renderUse() {
    var box = $('usebody'); box.innerHTML = '';
    var f = C.BUILT_IN.filter(function (x) { return x.id === state.pick; })[0];
    var mine = state.useMine && state.mine && state.mine.ok ? state.mine : null;
    if (mine) {
      box.appendChild(el('p', 'You are using your own file, ' + mine.name + '. Two ways to give it to the companion:'));
      var ol = el('ol');
      var a = el('li'); a.appendChild(document.createTextNode('Click the three dots on the companion, then ')); a.appendChild(el('code', 'Load a character file')); a.appendChild(document.createTextNode(' and pick the file you saved below.')); ol.appendChild(a);
      var b = el('li'); b.appendChild(document.createTextNode('Or put the file in ')); b.appendChild(el('code', '%APPDATA%\\rc-companion\\characters')); b.appendChild(document.createTextNode(' and choose it from the same menu.')); ol.appendChild(b);
      box.appendChild(ol);
      var dl = el('div', '', 'dl'), btn = el('button', 'Save ' + mine.name, 'btn btn-solid'); btn.type = 'button';
      btn.addEventListener('click', function () { download(mine.file, mine.name); });
      dl.appendChild(btn); box.appendChild(dl);
      box.appendChild(el('p', 'The saved copy is byte for byte what you dropped' + (mine.hash ? ' (SHA-256 ' + mine.hash.slice(0, 12) + '...).' : '.'), 'status-note'));
      return;
    }
    box.appendChild(el('p', 'You picked ' + f.name + '.'));
    var o = el('ol');
    var s1 = el('li'); s1.appendChild(document.createTextNode('Click the three dots on the companion.')); o.appendChild(s1);
    var s2 = el('li'); s2.appendChild(document.createTextNode('Under characters, choose ')); s2.appendChild(el('code', f.pick)); s2.appendChild(document.createTextNode('.')); o.appendChild(s2);
    box.appendChild(o);
    if (f.file) {
      var d = el('div', '', 'dl'), a2 = el('a', 'Download ' + f.file.split('/').pop(), 'btn btn-line');
      a2.href = f.file; a2.setAttribute('download', '');
      d.appendChild(a2); box.appendChild(d);
      box.appendChild(el('p', 'This one is also a plain file. Drop it in the characters folder to use it as a starting point for your own.', 'status-note'));
    }
  }

  function download(file, name) {
    var u = URL.createObjectURL(file), a = document.createElement('a');
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }

  // ---------- the dropped file ----------
  function showMine() {
    var m = state.mine, box = $('mine');
    box.classList.toggle('on', !!m);
    if (!m) return;
    $('mname').textContent = m.name;
    var meta = m.label ? m.label + ', ' : '';
    $('mmeta').textContent = meta + C.formatSize(m.size);
    if (m.hash) { var c = document.createElement('code'); c.textContent = ' SHA-256 ' + m.hash.slice(0, 16) + '...'; $('mmeta').appendChild(c); }
    var msg = $('mmsg');
    msg.className = 'msg ' + (m.ok ? 'ok' : 'bad');
    msg.textContent = m.ok ? ((m.advice || 'This file passed the basic check.') + (m.loose ? ' This type has no header to check, so the companion is the final test.' : '')) : m.problem;
    var prev = $('prev'); prev.innerHTML = '';
    if (state.previewUrl) { URL.revokeObjectURL(state.previewUrl); state.previewUrl = null; }
    if (m.ok && m.kind === 'pixel') {
      state.previewUrl = URL.createObjectURL(m.file);
      var im = new Image(); im.alt = 'Your pixel art'; im.src = state.previewUrl; prev.appendChild(im);
    } else if (m.ok) {
      prev.textContent = 'The companion draws this one. There is no preview on this page.';
    } else prev.textContent = 'No preview';
    $('keep').hidden = !m.ok || state.kept;
    $('forget').hidden = !state.kept;
    $('keepnote').textContent = state.kept
      ? 'Saved in this browser only. Remove it here any time, or clear this site\'s data.'
      : 'Keeping it saves the file in this browser only, so it is still here when you come back. Nothing is sent to us.';
  }

  function take(file) {
    if (!file) return;
    // Only the first bytes are read to check it; the whole file is read for the fingerprint only when it is small.
    var head = file.slice(0, 64).arrayBuffer(), whole = file.size <= 50 * 1024 * 1024 ? file.arrayBuffer() : Promise.resolve(null);
    Promise.all([head, whole]).then(function (r) {
      var h = new Uint8Array(r[0]), res = C.check(file.name, file.size, h);
      var m = { file: file, name: C.safeName(file.name), size: file.size, ok: res.ok, kind: res.kind, label: res.label, problem: res.problem, loose: res.loose };
      if (res.ok && res.kind === 'pixel') m.advice = C.pixelAdvice(C.pngSize(h));
      state.mine = m; state.kept = false; state.useMine = res.ok;
      showMine(); renderUse();
      if (!r[1]) return;
      return sha256(r[1]).then(function (hash) { m.hash = hash; if (state.mine === m) { showMine(); renderUse(); } });
    }).catch(function () {
      state.mine = { ok: false, name: C.safeName(file.name), size: file.size, problem: 'Your browser could not read that file.' };
      showMine(); renderUse();
    });
  }

  var dz = $('drop'), input = $('file');
  ['dragenter', 'dragover'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.add('over'); }); });
  ['dragleave', 'drop'].forEach(function (t) { dz.addEventListener(t, function (e) { e.preventDefault(); dz.classList.remove('over'); }); });
  dz.addEventListener('drop', function (e) { take(e.dataTransfer && e.dataTransfer.files[0]); });
  input.addEventListener('change', function () { take(input.files[0]); input.value = ''; });
  $('pickbtn').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  // A file dropped outside the box would make the browser open it and leave the page.
  ['dragover', 'drop'].forEach(function (t) { window.addEventListener(t, function (e) { if (!dz.contains(e.target)) e.preventDefault(); }); });

  $('keep').addEventListener('click', function () {
    var m = state.mine; if (!m || !m.ok) return;
    save('mine', { blob: m.file, name: m.name, size: m.size, ok: true, kind: m.kind, label: m.label, advice: m.advice, hash: m.hash, savedAt: Date.now() })
      .then(function () { if (state.mine === m) { state.kept = true; showMine(); } })
      .catch(function () { $('mmsg').className = 'msg bad'; $('mmsg').textContent = 'This browser would not store the file (a private window does that). Save it to your computer instead.'; });
  });
  $('forget').addEventListener('click', function () {
    drop('mine').then(function () { state.mine = null; state.kept = false; state.useMine = false; showMine(); renderUse(); })
      .catch(function () { $('mmsg').className = 'msg bad'; $('mmsg').textContent = 'This browser would not remove it. Clear this site\'s data in the browser settings.'; });
  });

  // ---------- start ----------
  renderFaces(); renderUse();
  load('mine').then(function (v) {
    if (!v || !v.blob || state.mine) return;
    state.mine = { file: v.blob, name: v.name, size: v.size, ok: true, kind: v.kind, label: v.label, advice: v.advice, hash: v.hash };
    state.kept = true; state.useMine = true; showMine(); renderUse();
  });
})();
