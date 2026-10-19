// RC Pair characters page: file checks that run in the browser and in node (test/characters-core.test.mjs).
// Nothing here talks to a network. A dropped file is only read, checked and handed back byte for byte.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RCChars = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var MAX_BYTES = 150 * 1024 * 1024;
  var EXTS = ['png', 'glb', 'gltf', 'vrm', 'ply', 'spz', 'splat', 'ksplat', 'sog', 'zip'];

  // Faces that ship with the companion. `pick` is the exact name in its "..." menu.
  var BUILT_IN = [
    { id: 'worker', name: 'Site hand', pick: 'Tread Connection worker', note: 'Navy hard hat, orange head, vest and boots. Hammers while the agent works.' },
    { id: 'buddy', name: 'Rising Creek', pick: 'Rising Creek', note: 'The first character. Blinks, looks at your cursor, waves when it needs a yes.' },
    { id: 'duck', name: 'Duck and ducklings', pick: 'Duck and ducklings', note: 'Waddles, quacks when the agent talks, three ducklings follow in a line.' },
    { id: 'pixel', name: 'Pixel duck', pick: 'Pixel', file: 'files/pixel-duck.png', note: 'Pixel art. This is the sample file, so you can see what to draw yourself.' },
    { id: 'robot', name: 'Robot', pick: 'Robot', file: 'files/robot-expressive.glb', note: 'A free 3D robot (CC0, Quaternius and Don McCurdy).' }
  ];

  function ext(name) {
    var m = /\.([a-z0-9]+)$/i.exec(name || '');
    return m ? m[1].toLowerCase() : '';
  }

  // Strip the folder and anything the Windows folder would not take.
  function safeName(name) {
    var base = String(name || 'character').split(/[\\/]/).pop();
    base = base.replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '');
    var e = /\.[a-z0-9]{1,8}$/i.exec(base), tail = e ? e[0] : '';
    base = base.slice(0, base.length - tail.length).slice(0, 80 - tail.length) + tail;
    return base || 'character';
  }

  function ascii(bytes, n) {
    var s = '';
    for (var i = 0; i < Math.min(n, bytes.length); i++) s += String.fromCharCode(bytes[i]);
    return s;
  }

  // Returns { ok, kind, label, problem?, warn? }. `head` is the first bytes of the file, `size` its length.
  function check(name, size, head) {
    var e = ext(name);
    if (EXTS.indexOf(e) < 0) return { ok: false, problem: 'That type is not one the companion reads. It reads ' + EXTS.map(function (x) { return '.' + x; }).join(' ') + '.' };
    if (!size) return { ok: false, problem: 'That file is empty.' };
    if (size > MAX_BYTES) return { ok: false, problem: 'That file is over 150 MB. Compress the capture or drop a smaller one.' };
    if (e === 'png') {
      if (head.length < 24) return { ok: false, problem: 'That PNG is cut short.' };
      if (ascii(head, 8) !== '\x89PNG\r\n\x1a\n') return { ok: false, problem: 'It is named .png but is not a PNG picture.' };
      return { ok: true, kind: 'pixel', label: 'Pixel art' };
    }
    if (e === 'glb') {
      if (head.length < 12) return { ok: false, problem: 'That file is cut short.' };
      if (ascii(head, 4) !== 'glTF') return { ok: false, problem: 'It is named .glb but does not start like a glb file.' };
      return { ok: true, kind: 'mesh', label: '3D model' };
    }
    if (e === 'gltf' || e === 'vrm') {
      var s = ascii(head, 64).replace(/^\s+/, '');
      if (e === 'vrm' && ascii(head, 4) === 'glTF') return { ok: true, kind: 'mesh', label: '3D model' };
      if (s.charAt(0) !== '{') return { ok: false, problem: 'It is named .' + e + ' but does not look like one.' };
      return { ok: true, kind: 'mesh', label: '3D model' };
    }
    if (e === 'ply') {
      if (ascii(head, 3) !== 'ply') return { ok: false, problem: 'It is named .ply but does not start like a ply file.' };
      return { ok: true, kind: 'splat', label: '3D capture' };
    }
    if (e === 'splat') {
      return size % 32 === 0 ? { ok: true, kind: 'splat', label: '3D capture' } : { ok: false, problem: 'A .splat file is a whole number of 32 byte records and this is not. It may have been cut off in the download.' };
    }
    if (e === 'spz') {
      if (head[0] !== 0x1f || head[1] !== 0x8b) return { ok: false, problem: 'It is named .spz but is not compressed like one.' };
      return { ok: true, kind: 'splat', label: '3D capture' };
    }
    if (e === 'zip') {
      if (ascii(head, 2) !== 'PK') return { ok: false, problem: 'It is named .zip but is not a zip archive.' };
      return { ok: true, kind: 'splat', label: 'Zipped capture' };
    }
    return { ok: true, kind: 'splat', label: '3D capture', loose: true };
  }

  // PNG width and height sit in the IHDR chunk at byte 16. Pixel art over 64 on the long side is shrunk by the companion.
  function pngSize(head) {
    if (head.length < 24) return null;
    var dv = new DataView(head.buffer, head.byteOffset, head.byteLength);
    return { w: dv.getUint32(16), h: dv.getUint32(20) };
  }

  function pixelAdvice(dim) {
    if (!dim) return '';
    var long = Math.max(dim.w, dim.h);
    if (long <= 64) return dim.w + ' by ' + dim.h + ' pixels. Good size.';
    if (long % 12 === 0 && long / 12 <= 64) return dim.w + ' by ' + dim.h + ' pixels. It looks like pixel art drawn at 12x, and the companion shrinks it back.';
    return dim.w + ' by ' + dim.h + ' pixels. The companion reads up to 64 on the long side, so a larger picture gets scaled down and may look soft.';
  }

  function formatSize(n) {
    if (n < 1024) return n + ' bytes';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(1) + ' MB';
  }

  return { MAX_BYTES: MAX_BYTES, EXTS: EXTS, BUILT_IN: BUILT_IN, ext: ext, safeName: safeName, check: check, pngSize: pngSize, pixelAdvice: pixelAdvice, formatSize: formatSize };
});
