// The iPhone app reads /app-config.json for update notices (rc-pair Sources/AppConfig.swift). GitHub Pages
// answered 503 for it and for every unknown address while these files were missing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('app-config.json matches what the app accepts', () => {
  const config = JSON.parse(read('app-config.json'));
  assert.deepEqual(Object.keys(config), ['latest']);
  const { version, build, store_url: storeUrl } = config.latest;
  assert.match(version, /^[0-9]+(\.[0-9]+)*$/);
  assert.ok(Number.isInteger(build) && build >= 0);
  const url = new URL(storeUrl);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'apps.apple.com');
});

test('unknown addresses get a real page and /download leads to the computer app', () => {
  const missing = read('404.html');
  assert.match(missing, /<title>Page not found \| RC Pair<\/title>/);
  assert.match(missing, /name="robots" content="noindex"/);
  // A 404 page is served at any depth, so its links cannot be relative.
  assert.doesNotMatch(missing, /(?:href|src)="(?!\/|https:\/\/|#)/);
  assert.match(read('download.html'), /http-equiv="refresh" content="0; url=\/computer\.html"/);
  assert.ok(fs.existsSync(path.join(root, 'computer.html')));
});
