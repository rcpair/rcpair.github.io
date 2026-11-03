import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const serialize = value => JSON.stringify(value, null, 2) + '\n';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw Error('Unsafe release URL');
  if (url.hostname === 'github.com' && url.pathname.startsWith('/rcpair/rcpair-releases/releases/download/')) return;
  if (url.hostname === 'testflight.apple.com' && /^\/join\/[A-Za-z0-9]{6,16}$/.test(url.pathname) && !url.search) return;
  if (url.hostname === 'apps.apple.com' && url.pathname === '/app/id6822097686') return;
  throw Error('Unexpected release destination');
}
export function projection(source, now = Date.now()) {
  if (source.schemaVersion !== 1 || source.maxAgeHours !== 24 || !Array.isArray(source.records)) throw Error('Invalid source manifest');
  const records = source.records.filter(r => r.product === 'rcpair' && ['stable','external'].includes(r.channel));
  if (!records.length) throw Error('RC release records missing');
  const resources = source.resources || [];
  for (const record of [...records, ...resources]) {
    if (record.state !== 'unverified') {
      const age = now - Date.parse(record.verifiedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 86400000) throw Error('Stale release source');
    }
    if (record.url) safeUrl(record.url);
    if (record.state === 'available') {
      const expected = record.proof?.provider === 'github' ? 'PUBLISHED_RELEASE' :
        record.proof?.provider === 'apple' ? (record.channel === 'external' ? 'IN_BETA_TESTING' : 'READY_FOR_SALE') : null;
      if (!expected || !record.version || !record.url || ![expected, ...(expected === 'READY_FOR_SALE' ? ['READY_FOR_DISTRIBUTION'] : [])].includes(record.proof?.state)) throw Error('Availability is not verified');
    }
  }
  return {schemaVersion:1,maxAgeHours:24,records:records.map(({proof,...record})=>record),resources,features:[],demos:[]};
}
async function refresh() {
  const response = await fetch('https://treadconnection.si/releases.json', {signal:AbortSignal.timeout(30000)});
  if (!response.ok) throw Error('Release source unavailable');
  const source = await response.json();
  const mirror = projection(source);
  const client = fs.readFileSync('release-status.js');
  const proof = {sourceUrl:'https://treadconnection.si/releases.json',canonicalManifestSha256:hash(serialize(source)),manifestSha256:hash(serialize(mirror)),clientSha256:hash(client),verifiedAt:new Date().toISOString()};
  fs.writeFileSync('releases.json', serialize(mirror));
  fs.writeFileSync('release-provenance.json', serialize(proof));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await refresh();
