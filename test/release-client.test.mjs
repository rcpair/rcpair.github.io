import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../release-status.js', import.meta.url), 'utf8');
async function run(manifest, resourceId, block = null) {
  const link = { dataset: { releaseResource: resourceId }, removeAttribute() {} };
  const document = { querySelectorAll: selector => selector === '[data-release-resource]' ? [link] : selector === '[data-release-instructions]' && block ? [block] : [] };
  await vm.runInNewContext(source, { document, fetch: async () => ({ ok: true, json: async () => manifest }), Date, URL, location: { hash: '' } });
  return link;
}
const record = (url) => ({ id: 'rc-mac-stable', product: 'rcpair', platform: 'Mac', channel: 'stable', state: 'available', version: '0.1.0', url, verifiedAt: new Date().toISOString() });
test('missing verification resource cannot stop another valid download link', async () => {
  const url = 'https://github.com/rcpair/rcpair-releases/releases/download/rcpair-v0.1.0/app.dmg';
  const block = { dataset: { releaseInstructions: '0.1.0', releaseInstructionRecords: 'rc-mac-stable' }, hidden: true };
  const m = { schemaVersion: 1, maxAgeHours: 24, records: [record(url)], resources: [{ id: 'rc-checksums', verifiedAt: new Date().toISOString(), url: null }] };
  assert.equal((await run(m, 'rc-mac-stable', block)).href, url);
  assert.equal(block.hidden, true);
});
test('RC client refuses unrelated Apple and Play Store applications', async () => {
  for (const url of ['https://apps.apple.com/app/id12345', 'https://play.google.com/store/apps/details?id=unrelated']) {
    assert.equal((await run({ schemaVersion: 1, maxAgeHours: 24, records: [record(url)], resources: [] }, 'rc-mac-stable')).href, undefined);
  }
});
