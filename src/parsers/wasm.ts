import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Grammar `.wasm` files live in one of two places depending on how Nobble is running:
 *
 *   - bundled (`dist/index.js`, `dist/cli.js`): `dist/wasm/`, copied there at build time
 *   - from source (vitest, tsx): the installed `@vscode/tree-sitter-wasm` package
 *
 * We resolve the directory once and read the bytes with `fs`, then hand the bytes to
 * `Language.load()`. Loading by *bytes* rather than by path is deliberate: it means no
 * bundler ever has to rewrite a wasm path, which is the usual way this breaks.
 */

const GRAMMARS = ['typescript', 'tsx', 'javascript', 'python', 'ruby'] as const;
export type GrammarName = (typeof GRAMMARS)[number];

let cachedDir: string | undefined;

function candidateDirs(): string[] {
  const out: string[] = [];
  const here = path.dirname(fileURLToPath(import.meta.url));

  // Bundled layout: dist/index.js -> dist/wasm
  out.push(path.join(here, 'wasm'));
  // Source layout: src/parsers/wasm.ts -> <root>/node_modules/...
  out.push(path.resolve(here, '..', '..', 'node_modules', '@vscode', 'tree-sitter-wasm', 'wasm'));

  // Normal resolution, for when Nobble is a dependency of something else.
  try {
    const require = createRequire(import.meta.url);
    out.push(path.dirname(require.resolve('@vscode/tree-sitter-wasm/wasm/tree-sitter-ruby.wasm')));
  } catch {
    // not resolvable from here; the candidates above still stand
  }
  return out;
}

export function grammarDir(): string {
  if (cachedDir) return cachedDir;
  for (const dir of candidateDirs()) {
    if (fs.existsSync(path.join(dir, 'tree-sitter-ruby.wasm'))) {
      cachedDir = dir;
      return dir;
    }
  }
  throw new Error(
    `nobble: could not locate tree-sitter grammar .wasm files. Looked in:\n  ${candidateDirs().join('\n  ')}`,
  );
}

export function readGrammar(name: GrammarName): Uint8Array {
  return fs.readFileSync(path.join(grammarDir(), `tree-sitter-${name}.wasm`));
}

/**
 * The tree-sitter *runtime* wasm must come from `web-tree-sitter` itself -- it is paired with
 * that package's emscripten glue. Using the runtime shipped by `@vscode/tree-sitter-wasm`
 * instead produces `LinkError: _emscripten_memcpy_js: function import requires a callable`.
 * Only the grammars are interchangeable between the two packages.
 */
export function runtimeWasmPath(): string | undefined {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const bundled = path.join(here, 'wasm', 'tree-sitter-runtime.wasm');
  if (fs.existsSync(bundled)) return bundled;
  try {
    const require = createRequire(import.meta.url);
    return require.resolve('web-tree-sitter/tree-sitter.wasm');
  } catch {
    return undefined; // let web-tree-sitter fall back to its own default resolution
  }
}

export const GRAMMAR_NAMES = GRAMMARS;
