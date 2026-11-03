import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
test('local mirror retains exact data and client provenance', () => {
 const manifest = JSON.parse(fs.readFileSync(new URL('releases.json', root), 'utf8'));
 const proof = JSON.parse(fs.readFileSync(new URL('release-provenance.json', root), 'utf8'));
 assert.equal(hash(JSON.stringify(manifest)), proof.manifestSha256);
 assert.ok(manifest.records.every(record => record.product === 'rcpair'));
 assert.match(proof.canonicalManifestSha256, /^[a-f0-9]{64}$/);
 const client = fs.readFileSync(new URL('release-status.js', root));
 assert.equal(hash(client), proof.clientSha256);
 assert.match(client.toString(), /fetch\("\/releases.json"/);
 assert.doesNotMatch(client.toString(), /fetch\("https:\/\/treadconnection/);
});
