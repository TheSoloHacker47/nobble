import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseUnifiedDiff } from '../../src/diff/parse.js';
import { buildMatchers, classify } from '../../src/diff/classify.js';
import { defaultConfig } from '../../src/config/load.js';
import { readBlobs, listTrackedFiles, resolveBase, diffText } from '../../src/diff/git.js';
import { run } from '../../src/engine/run.js';
import type { FileKind } from '../../src/types.js';

/**
 * M1 exit criterion: run against a real git repository and classify every changed file
 * correctly. Built as a throwaway repo so the assertions are about real `git diff` output
 * and real blob retrieval, not a hand-written diff string.
 */

let repo: string;
const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

const write = (p: string, content: string) => {
  fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
  fs.writeFileSync(path.join(repo, p), content);
};

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-m1-'));
  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 't@t']);
  git(['config', 'user.name', 't']);

  write('src/index.ts', 'export const a = 1;\n');
  write('src/middleware/auth.ts', 'export function requireUser(u: unknown) { return !!u; }\n');
  write(
    'src/index.test.ts',
    "import { expect, it } from 'vitest';\nit('works', () => { expect(1).toBe(1); });\n",
  );
  write('app/policies/admin_policy.rb', 'class AdminPolicy; def allow?; true; end; end\n');
  write(
    'spec/models/user_spec.rb',
    'describe User do\n  it "is valid" do\n    expect(u).to eq(1)\n  end\nend\n',
  );
  write('tests/test_thing.py', 'def test_thing():\n    assert 1 == 1\n');
  write(
    '.github/workflows/ci.yml',
    'name: CI\non: [push]\njobs:\n  build:\n    steps:\n      - run: npm test\n',
  );
  write('jest.config.js', 'module.exports = { coverageThreshold: { global: { lines: 90 } } };\n');
  write('README.md', '# demo\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'init']);

  // A change touching every classification bucket.
  write('src/index.ts', 'export const a = 1;\nexport const b = 2;\n');
  write('src/middleware/auth.ts', 'export function requireUser(u: unknown) { return true; }\n');
  write(
    'src/index.test.ts',
    "import { expect, it } from 'vitest';\nit('works', () => { expect(1).toBe(1); });\nit('more', () => { expect(2).toBe(2); });\n",
  );
  write(
    'spec/models/user_spec.rb',
    'describe User do\n  it "is valid" do\n    expect(u).to be_truthy\n  end\nend\n',
  );
  write('tests/test_thing.py', 'def test_thing():\n    assert 1 == 1\n    assert 2 == 2\n');
  write('jest.config.js', 'module.exports = { coverageThreshold: { global: { lines: 70 } } };\n');
  write(
    '.github/workflows/ci.yml',
    'name: CI\non: [push]\njobs:\n  build:\n    steps:\n      - run: npm test || true\n',
  );
  write('README.md', '# demo\nmore docs\n');
  write('app/policies/guard_policy.rb', 'class GuardPolicy; end\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'change']);
}, 60_000);

afterAll(() => {
  if (repo) fs.rmSync(repo, { recursive: true, force: true });
});

describe('M1 pipeline on a real repository', () => {
  it('classifies every changed file correctly', () => {
    const diff = diffText('HEAD~1', 'HEAD', repo);
    const files = parseUnifiedDiff(diff);
    const m = buildMatchers(defaultConfig());
    const got = Object.fromEntries(files.map((f) => [f.path, classify(f.path, m)]));

    const expected: Record<string, FileKind> = {
      'src/index.ts': 'source',
      'src/middleware/auth.ts': 'source',
      'src/index.test.ts': 'test',
      'spec/models/user_spec.rb': 'test',
      'tests/test_thing.py': 'test',
      '.github/workflows/ci.yml': 'ci_config',
      'jest.config.js': 'coverage_config',
      'README.md': 'other',
      'app/policies/guard_policy.rb': 'source',
    };
    expect(got).toEqual(expected);
  });

  it('detects added vs modified status', () => {
    const files = parseUnifiedDiff(diffText('HEAD~1', 'HEAD', repo));
    const byPath = new Map(files.map((f) => [f.path, f]));
    expect(byPath.get('app/policies/guard_policy.rb')!.status).toBe('added');
    expect(byPath.get('src/index.ts')!.status).toBe('modified');
  });

  it('retrieves before-blobs in one batch, and reports absent ones as undefined', () => {
    const blobs = readBlobs(
      'HEAD~1',
      ['src/index.ts', 'app/policies/guard_policy.rb', 'does/not/exist.ts'],
      { cwd: repo },
    );
    expect(blobs.get('src/index.ts')).toBe('export const a = 1;\n');
    // Did not exist in the base commit -- a normal case, not an error.
    expect(blobs.get('app/policies/guard_policy.rb')).toBeUndefined();
    expect(blobs.get('does/not/exist.ts')).toBeUndefined();
  });

  it('lists tracked files for pairing', () => {
    const tracked = listTrackedFiles(repo);
    expect(tracked).toContain('src/index.ts');
    expect(tracked).toContain('spec/models/user_spec.rb');
  });

  it('resolves a base ref without one being given', () => {
    expect(resolveBase(undefined, repo)).toBe('main');
  });

  it('runs end to end and returns a well-formed result', async () => {
    const result = await run({
      diffText: diffText('HEAD~1', 'HEAD', repo),
      config: defaultConfig(),
      cwd: repo,
      base: 'HEAD~1',
    });
    expect(result.filesAnalyzed).toBe(9);
    expect(result.degraded).toBe(false);
    expect(['pass', 'warn', 'block']).toContain(result.verdict);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('yields zero findings and exits 0 on an empty diff', async () => {
    const result = await run({ diffText: '', config: defaultConfig(), cwd: repo, base: 'HEAD' });
    expect(result.findings).toEqual([]);
    expect(result.score).toBe(0);
    expect(result.verdict).toBe('pass');
  });

  it('degrades rather than failing when the base ref has no blobs', async () => {
    const result = await run({
      diffText: diffText('HEAD~1', 'HEAD', repo),
      config: defaultConfig(),
      cwd: repo,
      base: undefined,
    });
    expect(result.degraded).toBe(true);
    expect(result.degradedReason).toMatch(/no base ref/);
  });
});
