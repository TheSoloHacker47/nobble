import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { run } from '../src/engine/run.js';
import { loadConfig, defaultConfig } from '../src/config/load.js';
import { registerAllRules } from '../src/rules/register.js';
import type { AnalysisResult } from '../src/types.js';

registerAllRules();

/**
 * A fixture is a `before/` tree, an `after/` tree, and an `expected.json`.
 *
 * The harness materializes both trees as two real git commits and diffs them, rather than
 * hand-writing a diff string. That means the fixtures exercise the same `git diff` output,
 * blob retrieval, and line numbering that a real run does -- a fixture that passes here
 * cannot pass for reasons a real PR would not reproduce.
 */

export interface ExpectedFinding {
  ruleId: string;
  file: string;
  /** Optional: assert the line when it matters, ignore it when it does not. */
  line?: number;
  /** Optional substring the message must contain. */
  messageContains?: string;
}

export interface ExpectedResult {
  findings: ExpectedFinding[];
  /** Optional exact score assertion. */
  score?: number;
  verdict?: 'pass' | 'warn' | 'block';
  /** Free-text note explaining what the fixture represents. Not asserted. */
  note?: string;
}

function copyTree(src: string, dest: string): void {
  if (!fs.existsSync(src)) {
    fs.mkdirSync(dest, { recursive: true });
    return;
  }
  fs.cpSync(src, dest, { recursive: true });
}

/** Removes everything except .git, so a deleted file in `after/` really reads as deleted. */
function clearWorktree(repo: string): void {
  for (const entry of fs.readdirSync(repo)) {
    if (entry === '.git') continue;
    fs.rmSync(path.join(repo, entry), { recursive: true, force: true });
  }
}

export interface FixtureRun {
  result: AnalysisResult;
  expected: ExpectedResult;
  name: string;
}

export async function runFixture(fixtureDir: string): Promise<FixtureRun> {
  const name = path.basename(fixtureDir);
  const expected: ExpectedResult = JSON.parse(
    fs.readFileSync(path.join(fixtureDir, 'expected.json'), 'utf8'),
  );

  const repo = fs.mkdtempSync(path.join(os.tmpdir(), `nobble-fx-${name}-`));
  const git = (args: string[]) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' });

  try {
    git(['init', '-q', '-b', 'main']);
    git(['config', 'user.email', 'fixture@nobble.test']);
    git(['config', 'user.name', 'fixture']);
    git(['config', 'commit.gpgsign', 'false']);

    copyTree(path.join(fixtureDir, 'before'), repo);
    git(['add', '-A']);
    git(['commit', '-q', '--allow-empty', '-m', 'before']);

    clearWorktree(repo);
    copyTree(path.join(fixtureDir, 'after'), repo);
    git(['add', '-A']);
    git(['commit', '-q', '--allow-empty', '-m', 'after']);

    const diffText = execFileSync(
      'git',
      ['diff', '--no-color', '--no-ext-diff', '-M', 'HEAD~1', 'HEAD'],
      { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
    );

    // A fixture may ship its own .nobble.yml to exercise config behaviour.
    const configPath = path.join(repo, '.nobble.yml');
    const config = fs.existsSync(configPath) ? loadConfig(undefined, repo).config : defaultConfig();

    const result = await run({ diffText, config, cwd: repo, base: 'HEAD~1' });
    return { result, expected, name };
  } finally {
    fs.rmSync(repo, { recursive: true, force: true });
  }
}

/** Turns a mismatch into a message that says what to fix, not just that something differs. */
export function describeMismatch(run: FixtureRun): string | undefined {
  const { result, expected, name } = run;
  const got = result.findings.map((f) => `${f.ruleId} ${f.file}:${f.line} ${f.message}`);

  if (result.findings.length !== expected.findings.length) {
    return [
      `fixture "${name}": expected ${expected.findings.length} finding(s), got ${result.findings.length}`,
      expected.findings.length
        ? `  expected: ${expected.findings.map((f) => `${f.ruleId} in ${f.file}`).join(', ')}`
        : '  expected: none',
      got.length ? `  actual:\n    ${got.join('\n    ')}` : '  actual: none',
    ].join('\n');
  }

  const remaining = [...result.findings];
  for (const want of expected.findings) {
    const idx = remaining.findIndex(
      (f) =>
        f.ruleId === want.ruleId &&
        f.file === want.file &&
        (want.line === undefined || f.line === want.line) &&
        (want.messageContains === undefined || f.message.includes(want.messageContains)),
    );
    if (idx === -1) {
      return [
        `fixture "${name}": no finding matched ${want.ruleId} in ${want.file}` +
          (want.line !== undefined ? `:${want.line}` : '') +
          (want.messageContains ? ` containing "${want.messageContains}"` : ''),
        got.length ? `  actual:\n    ${got.join('\n    ')}` : '  actual: none',
      ].join('\n');
    }
    remaining.splice(idx, 1);
  }

  if (expected.score !== undefined && result.score !== expected.score) {
    return `fixture "${name}": expected score ${expected.score}, got ${result.score}`;
  }
  if (expected.verdict !== undefined && result.verdict !== expected.verdict) {
    return `fixture "${name}": expected verdict ${expected.verdict}, got ${result.verdict}`;
  }
  return undefined;
}

/** Every fixture directory under `test/fixtures/<group>`. */
export function discoverFixtures(group: string): { name: string; dir: string }[] {
  const base = path.join(import.meta.dirname, 'fixtures', group);
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ name: e.name, dir: path.join(base, e.name) }))
    .filter((f) => fs.existsSync(path.join(f.dir, 'expected.json')))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
}
