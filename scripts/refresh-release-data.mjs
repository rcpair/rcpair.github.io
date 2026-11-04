import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
const serialize = (value) => JSON.stringify(value, null, 2) + "\n";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function safeUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || url.hash)
    throw Error("Unsafe release URL");
  if (
    url.hostname === "github.com" &&
    url.pathname.startsWith("/rcpair/rcpair-releases/releases/download/")
  )
    return;
  if (
    url.hostname === "testflight.apple.com" &&
    /^\/join\/[A-Za-z0-9]{6,16}$/.test(url.pathname) &&
    !url.search
  )
    return;
  if (url.hostname === "apps.apple.com" && url.pathname === "/app/id6822097686")
    return;
  throw Error("Unexpected release destination");
}
export function projection(source, now = Date.now()) {
  if (
    source.schemaVersion !== 1 ||
    source.maxAgeHours !== 24 ||
    !Array.isArray(source.records)
  )
    throw Error("Invalid source manifest");
  const records = source.records.filter(
    (r) => r.product === "rcpair" && ["stable", "external"].includes(r.channel),
  );
  if (!records.length) throw Error("RC release records missing");
  const publicRecords = records.map((record) => ({ ...record }));
  const resources = (source.resources || [])
    .filter((resource) =>
      ["rc-checksums", "rc-signature"].includes(resource.id),
    )
    .map((resource) => ({ ...resource }));
  for (const record of [...publicRecords, ...resources]) {
    try {
      if (record.state === "unverified") {
        record.url = null;
        continue;
      }
      const age = now - Date.parse(record.verifiedAt);
      if (!Number.isFinite(age) || age < -300000 || age > 86400000)
        throw Error("Stale record");
      if (record.url) safeUrl(record.url);
      if (record.state === "available") {
        const url = new URL(record.url);
        if (
          record.proof?.provider === "github" &&
          (url.hostname !== "github.com" ||
            !url.pathname.includes("/rcpair-v" + record.version + "/"))
        )
          throw Error("Release version does not match artifact");
        if (
          record.proof?.provider === "apple" &&
          url.hostname !==
            (record.channel === "external"
              ? "testflight.apple.com"
              : "apps.apple.com")
        )
          throw Error("Release channel does not match link");
        const expected =
          record.proof?.provider === "github"
            ? "PUBLISHED_RELEASE"
            : record.proof?.provider === "apple"
              ? record.channel === "external"
                ? "IN_BETA_TESTING"
                : "READY_FOR_SALE"
              : null;
        if (
          !expected ||
          !record.version ||
          !record.url ||
          ![
            expected,
            ...(expected === "READY_FOR_SALE"
              ? ["READY_FOR_DISTRIBUTION"]
              : []),
          ].includes(record.proof?.state)
        )
          throw Error("Availability is not verified");
      }
    } catch {
      record.state = "unverified";
      record.url = null;
      record.version = null;
      record.build = null;
    }
  }
  const versions = new Set(
    publicRecords
      .filter(
        (record) =>
          record.state === "available" && record.proof?.provider === "github",
      )
      .map((record) => record.version),
  );
  const verifiedResources = resources.filter(
    (resource) =>
      resource.url &&
      [...versions].some((version) =>
        resource.url.includes("/rcpair-v" + version + "/"),
      ),
  );
  return {
    schemaVersion: 1,
    maxAgeHours: 24,
    records: publicRecords.map((record) => {
      const result = { ...record };
      delete result.proof;
      return result;
    }),
    resources: verifiedResources,
    features: [],
    demos: [],
  };
}
export async function refresh({
  fetcher = fetch,
  directory = ".",
  now = Date.now(),
  report = false,
} = {}) {
  const response = await fetcher("https://treadconnection.si/releases.json", {
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error("Release source unavailable");
  const sourceBytes = await response.text();
  const source = JSON.parse(sourceBytes);
  const mirror = projection(source, now);
  if (
    report && mirror.records.some(
      (record) =>
        record.state === "unverified" &&
        source.records.some(
          (original) =>
            original.id === record.id && original.state !== "unverified",
        ),
    )
  ) {
    console.warn(
      "::warning::Some release records could not be verified; their links were withheld.",
    );
  }
  const priorDataFile = path.join(directory, "releases.json");
  if (fs.existsSync(priorDataFile)) {
    const previous = JSON.parse(fs.readFileSync(priorDataFile, "utf8"));
    const newest = (value) =>
      Math.max(
        ...value.records
          .filter((record) => record.state !== "unverified")
          .map((record) => Date.parse(record.verifiedAt))
          .filter((time) => Number.isFinite(time) && time <= now + 300000),
      );
    if (Number.isFinite(newest(mirror)) && newest(mirror) < newest(previous))
      throw Error("Release source is older than the current mirror");
  }
  if (
    report && mirror.resources.length <
    (source.resources || []).filter((resource) =>
      ["rc-checksums", "rc-signature"].includes(resource.id),
    ).length
  ) {
    console.warn(
      "::warning::Release verification files could not be confirmed; version-specific setup remains hidden.",
    );
  }
  if (report && process.env.GITHUB_STEP_SUMMARY) {
    const withheld = mirror.records.filter(record => record.state === "unverified").length;
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `Release data validated. ${withheld} download entries have unverified availability and remain withheld. A successful refresh does not mean every download is available.\n`);
  }
  const proofFile = path.join(directory, "release-provenance.json");
  const prior = JSON.parse(fs.readFileSync(proofFile, "utf8"));
  const client = fs.readFileSync(path.join(directory, "release-status.js"));
  if (prior.clientSha256 !== hash(client))
    throw Error("Client changed without a reviewed provenance update");
  const timestamps = [...mirror.records, ...mirror.resources]
    .filter((record) => record.state !== "unverified")
    .map((record) => Date.parse(record.verifiedAt))
    .filter((time) => Number.isFinite(time) && time <= now + 300000);
  const verifiedAt = timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
  const proof = {
    ...prior,
    clientSourceRevision: prior.clientSourceRevision || prior.sourceRevision,
    sourceUrl: "https://treadconnection.si/releases.json",
    sourceResponseSha256: hash(sourceBytes),
    canonicalManifestSha256: hash(serialize(source)),
    manifestSha256: hash(serialize(mirror)),
    verifiedAt,
  };
  delete proof.sourceRevision;
  delete proof.sourceManifest;
  fs.writeFileSync(path.join(directory, "releases.json"), serialize(mirror));
  fs.writeFileSync(proofFile, serialize(proof));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await refresh({ report: true });
