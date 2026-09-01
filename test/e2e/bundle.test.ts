import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..', '..');

/**
 * The other half of the M0 gate: the *bundled* output must boot tree-sitter with no
 * node_modules anywhere near it, because that is exactly the situation on a GitHub
 * Actions runner executing `dist/index.js` out of a checkout of this repo.
 */
describe('bundled dist', () => {
  beforeAll(() => {
    execFileSync('node', ['scripts/build.mjs'], { cwd: root, stdio: 'pipe' });
  }, 120_000);

  it('ships the runtime and all five grammar wasm files', () => {
    const wasm = path.join(root, 'dist', 'wasm');
    for (const f of [
      'tree-sitter-runtime.wasm',
      'tree-sitter-typescript.wasm',
      'tree-sitter-tsx.wasm',
      'tree-sitter-javascript.wasm',
      'tree-sitter-python.wasm',
      'tree-sitter-ruby.wasm',
    ]) {
      expect(fs.existsSync(path.join(wasm, f)), `missing dist/wasm/${f}`).toBe(true);
    }
  });

  it('runs in isolation from node_modules', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-iso-'));
    try {
      fs.cpSync(path.join(root, 'dist'), path.join(tmp, 'dist'), { recursive: true });
      const out = execFileSync('node', ['dist/cli.js'], { cwd: tmp, encoding: 'utf8' });
      expect(out).toContain('5 grammars loaded');
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }, 60_000);
});
