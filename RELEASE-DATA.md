# Verified release data

The public website consumes only its local release-status.js and releases.json. The canonical source is the reviewed TC public manifest. The refresh workflow changes only release JSON/provenance, never JavaScript or page copy.

Main deploys and verifies the TC publisher and its existing three-hour dispatcher before activating these pages. The workflow's data-only push is authorized by the reviewed automation policy; it has no permission to change source files through its commit step. Failed or stale records lose their links while other verified records remain available. The workflow prints a warning for downgraded records. Last verification timestamps and support links remain visible.

## Reviewing a client change

A client change must update its recorded hash deliberately in the same reviewed PR. From the repository root run:

```sh
node --input-type=module <<'JS'
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const file = 'release-provenance.json';
const proof = JSON.parse(fs.readFileSync(file, 'utf8'));
proof.clientSha256 = createHash('sha256').update(fs.readFileSync('release-status.js')).digest('hex');
fs.writeFileSync(file, JSON.stringify(proof, null, 2) + '\n');
JS
node --test test/*.test.mjs
```

The hash test intentionally fails if a changed client and its reviewed provenance disagree. This is separate from periodic data refresh. Version-specific old commands stay hidden once the version changes; the current-release guide remains available.

The existing Pages build is requested through GitHub's supported build endpoint. Its documented fine-grained token requirement is Pages write, which this workflow declares. This applies to requesting the existing site build, not creating a Pages site. The endpoint builds the default branch and queues a request when another build is running. The joint rollout still requires actual workflow and public-file proof before activating the HTML client. Source: https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build
