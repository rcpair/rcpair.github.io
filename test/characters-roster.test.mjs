import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
const C = createRequire(import.meta.url)('../characters/characters-core.js');
const root = new URL('../characters/', import.meta.url);

test('every built-in character has a unique id, a name, a menu name and a picture', () => {
  const ids = C.BUILT_IN.map((f) => f.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(C.BUILT_IN.length >= 26);
  const art = fs.readFileSync(new URL('characters.js', root), 'utf8');
  for (const f of C.BUILT_IN) {
    assert.ok(f.name && f.pick, f.id);
    if (f.thumb) {
      assert.ok(fs.existsSync(new URL(f.thumb, root)), f.thumb);
      assert.ok(f.alt, `${f.id} has alt text`);
      assert.equal(f.note, undefined, `${f.id}: names and alt text only`);
    } else assert.ok(art.includes(`${f.id}: '`), `${f.id} has a drawing`);
  }
});
