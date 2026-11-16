// Entry point for the makefun-frontend-01 bounty (Node 22, standard library
// only). The frontend is the plain static files in app/ beside this file —
// index.html plus its ES modules and stylesheet, no build step — reading
// make.fun's public API in the browser. This program hands the entry in: it
// copies app/ and screenshots/ into /output and writes /output/dossier.json
// with the vendored make.fun dossier library. The library must stay exactly
// as the kit shipped it: the scorer rebuilds the dossier with its own copy
// and requires a byte-for-byte match.
//
// Run it locally with:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (MAKEFUN_OUTPUT_DIR stands in for /output outside the grader.)

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's caps from the kit's reference/gate.json. Only text_max_bytes
// shapes the dossier's bytes; the others refuse an entry the scorer would
// refuse (more than 3 screenshots or one over 256 KiB; more than 993 files
// and directories in app/ or 16 MiB of app files).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 3, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 16777216,
  }),
);
