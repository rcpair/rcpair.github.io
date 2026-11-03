import test from "node:test";
import assert from "node:assert/strict";
import { projection } from "../scripts/refresh-release-data.mjs";
const now = Date.parse("2026-11-03T18:00:00Z");
function source() {
  return {
    schemaVersion: 1,
    maxAgeHours: 24,
    records: [
      {
        id: "rc-ios-external",
        product: "rcpair",
        channel: "external",
        state: "available",
        version: "1.1",
        build: "31",
        url: "https://testflight.apple.com/join/jECT6VHj",
        verifiedAt: new Date(now).toISOString(),
        proof: { provider: "apple", state: "IN_BETA_TESTING" },
      },
      { id: "internal", product: "rcpair", channel: "internal" },
      { id: "tc", product: "tc", channel: "stable" },
    ],
    resources: [],
  };
}
test("refresh publishes only verified public RC records", () => {
  const m = projection(source(), now);
  assert.equal(m.records.length, 1);
  assert.equal(m.records[0].proof, undefined);
});
test("unapproved and unsafe source cannot replace data", () => {
  for (const change of [
    { proof: { provider: "apple", state: "PROCESSING" } },
    { url: "https://example.com/download" },
  ]) {
    const m = source();
    Object.assign(m.records[0], change);
    assert.equal(projection(m, now).records[0].state, "unverified");
  }
});

test("stale records become unavailable while fresh other records remain", () => {
  const m = source();
  m.records[0].verifiedAt = "2000-01-01T00:00:00Z";
  const projected = projection(m, now);
  assert.equal(projected.records[0].state, "unverified");
  assert.equal(projected.records[0].url, null);
});

test("projection does not change source evidence while dropping unrelated resources", () => {
  const m = source();
  m.resources = [
    { id: "other-product", url: "https://example.com/file", verifiedAt: "old" },
  ];
  const before = JSON.stringify(m);
  assert.deepEqual(projection(m, now).resources, []);
  assert.equal(JSON.stringify(m), before);
});

test('one invalid Apple record cannot remove a verified computer download', () => {
  const manifest = source();
  manifest.records[0].proof.state = 'PROCESSING';
  manifest.records.push({id:'rc-mac-stable',product:'rcpair',channel:'stable',platform:'Mac',state:'available',version:'0.1.0',url:'https://github.com/rcpair/rcpair-releases/releases/download/rcpair-v0.1.0/app.dmg',verifiedAt:new Date(now).toISOString(),proof:{provider:'github',state:'PUBLISHED_RELEASE'}});
  const result = projection(manifest, now);
  assert.equal(result.records.find(record => record.id === 'rc-ios-external').state, 'unverified');
  assert.equal(result.records.find(record => record.id === 'rc-mac-stable').state, 'available');
});
