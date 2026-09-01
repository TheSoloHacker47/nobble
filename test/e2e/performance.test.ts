import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { diffText } from '../../src/diff/git.js';
import { run } from '../../src/engine/run.js';
import { defaultConfig } from '../../src/config/load.js';
import { registerAllRules } from '../../src/rules/register.js';

registerAllRules();

/**
 * Definition of done: "Cold run finishes in under 5 seconds on a 500-file diff."
 *
 * Builds a repo with 500 changed files across all three languages plus config and CI, then
 * times one full run including grammar loading. The budget is asserted at 5s; the run is
 * also logged so a regression shows up as a trend and not only as a pass/fail.
 */

let repo: string;
const FILE_COUNT = 500;

beforeAll(() => {
  repo = fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-perf-'));
  const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
  const write = (p: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(repo, p)), { recursive: true });
    fs.writeFileSync(path.join(repo, p), content);
  };

  git(['init', '-q', '-b', 'main']);
  git(['config', 'user.email', 't@t']);
  git(['config', 'user.name', 't']);

  // A realistic mix: mostly source and test files, with some config in the tail.
  for (let i = 0; i < FILE_COUNT; i++) {
    const lang = i % 3;
    if (lang === 0) {
      write(
        `src/mod${i}/thing.ts`,
        `export function thing${i}(a: number) {\n  return a + ${i};\n}\n`,
      );
      write(
        `src/mod${i}/thing.test.ts`,
        `describe('thing${i}', () => {\n  it('adds', () => {\n    expect(thing${i}(1)).toBe(${i + 1});\n    expect(thing${i}(2)).toBe(${i + 2});\n  });\n});\n`,
      );
    } else if (lang === 1) {
      write(`app/mod${i}/thing.rb`, `class Thing${i}\n  def call(a)\n    a + ${i}\n  end\nend\n`);
      write(
        `spec/mod${i}/thing_spec.rb`,
        `describe "Thing${i}" do\n  it "adds" do\n    expect(Thing${i}.new.call(1)).to eq(${i + 1})\n  end\nend\n`,
      );
    } else {
      write(`pkg/mod${i}/thing.py`, `def thing${i}(a):\n    return a + ${i}\n`);
      write(
        `tests/mod${i}/test_thing.py`,
        `def test_thing${i}():\n    assert thing${i}(1) == ${i + 1}\n    assert thing${i}(2) == ${i + 2}\n`,
      );
    }
  }
  write('jest.config.js', 'module.exports = { coverageThreshold: { global: { lines: 90 } } };\n');
  write('.github/workflows/ci.yml', 'jobs:\n  test:\n    steps:\n      - run: npm test\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'base']);

  // Change every file: assertions removed, matchers weakened, config lowered, CI defanged.
  for (let i = 0; i < FILE_COUNT; i++) {
    const lang = i % 3;
    if (lang === 0) {
      write(
        `src/mod${i}/thing.ts`,
        `export function thing${i}(a: number) {\n  return a + ${i} + 1;\n}\n`,
      );
      write(
        `src/mod${i}/thing.test.ts`,
        `describe('thing${i}', () => {\n  it('adds', () => {\n    expect(thing${i}(1)).toBeTruthy();\n  });\n});\n`,
      );
    } else if (lang === 1) {
      write(
        `app/mod${i}/thing.rb`,
        `class Thing${i}\n  def call(a)\n    a + ${i} + 1\n  end\nend\n`,
      );
      write(
        `spec/mod${i}/thing_spec.rb`,
        `describe "Thing${i}" do\n  it "adds" do\n    expect(Thing${i}.new.call(1)).to be_truthy\n  end\nend\n`,
      );
    } else {
      write(`pkg/mod${i}/thing.py`, `def thing${i}(a):\n    return a + ${i} + 1\n`);
      write(`tests/mod${i}/test_thing.py`, `def test_thing${i}():\n    assert thing${i}(1)\n`);
    }
  }
  write('jest.config.js', 'module.exports = { coverageThreshold: { global: { lines: 40 } } };\n');
  write('.github/workflows/ci.yml', 'jobs:\n  test:\n    steps:\n      - run: npm test || true\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'change']);
}, 180_000);

afterAll(() => {
  if (repo) fs.rmSync(repo, { recursive: true, force: true });
});

describe('performance', () => {
  it('analyzes a 500+ file diff in under 5 seconds, cold', async () => {
    const diff = diffText('HEAD~1', 'HEAD', repo);
    const changed = diff.split('\n').filter((l) => l.startsWith('diff --git')).length;
    expect(changed).toBeGreaterThanOrEqual(500);

    const started = performance.now();
    const result = await run({
      diffText: diff,
      config: defaultConfig(),
      cwd: repo,
      base: 'HEAD~1',
    });
    const elapsed = performance.now() - started;

    console.log(
      `  perf: ${changed} changed files, ${result.totalFindings} findings, ${elapsed.toFixed(0)}ms`,
    );
    expect(result.totalFindings).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(5000);
  }, 120_000);
});
