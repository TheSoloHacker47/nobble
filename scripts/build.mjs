#!/usr/bin/env node
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const wasmOut = path.join(dist, 'wasm');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(wasmOut, { recursive: true });

// --- copy grammar wasm -------------------------------------------------------
const grammarSrc = path.dirname(
  require.resolve('@vscode/tree-sitter-wasm/wasm/tree-sitter-ruby.wasm'),
);
for (const g of ['typescript', 'tsx', 'javascript', 'python', 'ruby']) {
  fs.copyFileSync(
    path.join(grammarSrc, `tree-sitter-${g}.wasm`),
    path.join(wasmOut, `tree-sitter-${g}.wasm`),
  );
}
// The runtime wasm must be web-tree-sitter's own -- see src/parsers/wasm.ts.
fs.copyFileSync(
  require.resolve('web-tree-sitter/tree-sitter.wasm'),
  path.join(wasmOut, 'tree-sitter-runtime.wasm'),
);

// --- bundle ------------------------------------------------------------------
const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  // web-tree-sitter's emscripten glue references these; esbuild's ESM output does not
  // define them, so shim them from import.meta.url.
  banner: {
    js: [
      "import { createRequire as __nobbleCreateRequire } from 'node:module';",
      "import { fileURLToPath as __nobbleFileURLToPath } from 'node:url';",
      "import { dirname as __nobbleDirname } from 'node:path';",
      'const require = __nobbleCreateRequire(import.meta.url);',
      'const __filename = __nobbleFileURLToPath(import.meta.url);',
      'const __dirname = __nobbleDirname(__filename);',
    ].join('\n'),
  },
};

await esbuild.build({
  ...shared,
  entryPoints: [path.join(root, 'src/cli.ts')],
  outfile: path.join(dist, 'cli.js'),
});
await esbuild.build({
  ...shared,
  entryPoints: [path.join(root, 'src/action.ts')],
  outfile: path.join(dist, 'index.js'),
});

// dist/ is committed and executed by the GitHub Action runner, which reads the repo's
// package.json. Pin module type locally so dist stays ESM regardless of that file.
fs.writeFileSync(path.join(dist, 'package.json'), JSON.stringify({ type: 'module' }, null, 2));

const size = (f) => (fs.statSync(f).size / 1024).toFixed(0) + 'kb';
console.log(`built dist/cli.js   ${size(path.join(dist, 'cli.js'))}`);
console.log(`built dist/index.js ${size(path.join(dist, 'index.js'))}`);
console.log(`copied 6 wasm files to dist/wasm/`);
