#!/usr/bin/env node
/**
 * Node's --experimental-strip-types does not rewrite `.js` import specifiers to `.ts`, and
 * the whole codebase uses NodeNext-style `.js` specifiers. Bundling first is simpler than
 * maintaining a second import convention just for this script.
 */
import * as esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-smoke-')), 'smoke.mjs');

await esbuild.build({
  entryPoints: [path.join(root, 'scripts/smoke.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: {
    js: [
      "import { createRequire as __cr } from 'node:module';",
      "import { fileURLToPath as __f } from 'node:url';",
      "import { dirname as __d } from 'node:path';",
      'const require = __cr(import.meta.url);',
      'const __filename = __f(import.meta.url);',
      'const __dirname = __d(__filename);',
    ].join('\n'),
  },
});

// The bundle runs from a temp directory, so `import.meta.dirname` inside it points there
// rather than at the repo. Pass the real root explicitly so the clone cache lands in the
// project (and gets gitignored) instead of beside the OS temp dir.
const res = spawnSync('node', [out, ...process.argv.slice(2)], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env, NOBBLE_SMOKE_ROOT: root },
});
process.exit(res.status ?? 1);
