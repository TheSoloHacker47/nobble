#!/usr/bin/env node
/**
 * Real-world smoke test (spec §11.5).
 *
 * Runs Nobble against the last N merged pull requests of several large public repositories
 * and reports the finding rate. These are ordinary human PRs, so almost every finding is a
 * false positive by construction.
 *
 * The spec's gate: if the finding rate is above roughly 10%, the rules are too loose and
 * must be tightened before release.
 *
 *   npm run smoke                    # default repos, 50 PRs each
 *   npm run smoke -- --limit 20      # fewer PRs, faster
 *   npm run smoke -- --repo vitejs/vite --repo rails/rails
 *   npm run smoke -- --verbose       # print every finding
 *
 * Requires `gh` to be authenticated. Clones are cached in .smoke-cache/.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { run } from '../src/engine/run.js';
import { defaultConfig } from '../src/config/load.js';
import { registerAllRules } from '../src/rules/register.js';
import type { Finding } from '../src/types.js';

registerAllRules();

const DEFAULT_REPOS = [
  'vitejs/vite', // large TypeScript, heavy test churn
  'pallets/flask', // Python, mature and conservative
  'sinatra/sinatra', // Ruby, RSpec/Minitest
];

const { values } = parseArgs({
  options: {
    repo: { type: 'string', multiple: true },
    limit: { type: 'string', default: '50' },
    verbose: { type: 'boolean', default: false },
    json: { type: 'string' },
  },
});

const repos = values.repo?.length ? values.repo : DEFAULT_REPOS;
const limit = Number(values.limit);
// NOBBLE_SMOKE_ROOT is set by run-smoke.mjs; `import.meta.dirname` would be the temp
// directory the bundle was written to.
const projectRoot = process.env.NOBBLE_SMOKE_ROOT ?? path.resolve(import.meta.dirname, '..');
const cacheDir = path.join(projectRoot, '.smoke-cache');

interface PrResult {
  repo: string;
  number: number;
  title: string;
  findings: Finding[];
  score: number;
  /** Whether this PR touched any test file at all. See the note in main(). */
  touchedTests: boolean;
  verdict: 'pass' | 'warn' | 'block';
  error?: string;
}

function sh(cmd: string, args: string[], cwd?: string, quiet = true): string {
  const res = spawnSync(cmd, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    stdio: quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (res.status !== 0)
    throw new Error(`${cmd} ${args.slice(0, 3).join(' ')} failed: ${res.stderr?.slice(0, 300)}`);
  return res.stdout ?? '';
}

function ensureClone(repo: string): string {
  const dir = path.join(cacheDir, repo.replace('/', '__'));
  if (fs.existsSync(path.join(dir, '.git'))) return dir;
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  process.stderr.write(`cloning ${repo} (this is cached for later runs)...\n`);
  // Full history is needed to reach each PR's merge-base.
  sh('git', [
    'clone',
    '--filter=blob:none',
    '--no-checkout',
    `https://github.com/${repo}.git`,
    dir,
  ]);
  return dir;
}

interface PrMeta {
  number: number;
  title: string;
  mergeCommit: string;
}

function listMergedPrs(repo: string): PrMeta[] {
  const out = sh('gh', [
    'pr',
    'list',
    '--repo',
    repo,
    '--state',
    'merged',
    '--limit',
    String(limit),
    '--json',
    'number,title,mergeCommit',
  ]);
  return (
    JSON.parse(out) as { number: number; title: string; mergeCommit: { oid: string } | null }[]
  )
    .filter((p) => p.mergeCommit?.oid)
    .map((p) => ({ number: p.number, title: p.title, mergeCommit: p.mergeCommit!.oid }));
}

async function analyzePr(repo: string, dir: string, pr: PrMeta): Promise<PrResult> {
  const base = { repo, number: pr.number, title: pr.title };
  try {
    sh('git', ['fetch', '--quiet', 'origin', pr.mergeCommit], dir);
    const parents = sh('git', ['rev-list', '--parents', '-n', '1', pr.mergeCommit], dir)
      .trim()
      .split(/\s+/);

    // Two merge styles, and most large repos use the second:
    //   true merge   -> 2 parents; parent1 is the base branch, parent2 the PR head
    //   squash/rebase -> 1 parent;  the commit itself IS the PR's whole change
    let first: string;
    let second: string;
    if (parents.length >= 3) {
      first = parents[1]!;
      second = parents[2]!;
    } else if (parents.length === 2) {
      first = parents[1]!;
      second = pr.mergeCommit;
    } else {
      return {
        ...base,
        findings: [],
        score: 0,
        touchedTests: false,
        verdict: 'pass',
        error: 'no parent commit',
      };
    }

    const diffText = sh(
      'git',
      // Three dots, not two. For a true merge, `first..second` diffs the base branch TIP
      // against the PR head and so includes every unrelated commit that landed on the base
      // while the PR was open -- which shows up as a docs PR being blamed for type-ignore
      // lines elsewhere in the tree. `...` diffs from the merge-base, which is the PR's
      // actual change. For a squash merge the merge-base IS the parent, so this is
      // equivalent there and one expression covers both styles.
      ['diff', '--no-color', '--no-ext-diff', '-M', `${first}...${second}`],
      dir,
    );
    if (!diffText.trim())
      return { ...base, findings: [], score: 0, touchedTests: false, verdict: 'pass' };

    const result = await run({
      diffText,
      config: defaultConfig(),
      cwd: dir,
      base: first,
      // Read the "after" side out of git rather than the working tree, since the clone is
      // bare-ish and has no checkout.
      readAfter: (p: string) => {
        const res = spawnSync('git', ['show', `${second}:${p}`], {
          cwd: dir,
          encoding: 'utf8',
          maxBuffer: 32 * 1024 * 1024,
        });
        return res.status === 0 ? res.stdout : undefined;
      },
    });
    return {
      ...base,
      findings: result.findings,
      score: result.score,
      touchedTests: result.testFilesChanged > 0,
      verdict: result.verdict,
    };
  } catch (err) {
    return {
      ...base,
      findings: [],
      score: 0,
      touchedTests: false,
      verdict: 'pass',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main(): Promise<void> {
  const started = Date.now();
  const all: PrResult[] = [];

  for (const repo of repos) {
    let dir: string;
    let prs: PrMeta[];
    try {
      dir = ensureClone(repo);
      prs = listMergedPrs(repo);
    } catch (err) {
      process.stderr.write(`skipping ${repo}: ${err instanceof Error ? err.message : err}\n`);
      continue;
    }
    process.stderr.write(`${repo}: analyzing ${prs.length} merged PRs\n`);
    for (const pr of prs) {
      const result = await analyzePr(repo, dir, pr);
      all.push(result);
      if (result.error && process.env.SMOKE_DEBUG) {
        process.stderr.write(`\n  #${pr.number}: ${result.error}\n`);
      }
      process.stderr.write(result.findings.length > 0 ? '!' : result.error ? '?' : '.');
    }
    process.stderr.write('\n');
  }

  // --- report -----------------------------------------------------------------
  const analyzed = all.filter((r) => !r.error);
  const flagged = analyzed.filter((r) => r.findings.length > 0);
  const rate = analyzed.length ? (flagged.length / analyzed.length) * 100 : 0;

  const byRule = new Map<string, number>();
  for (const r of flagged) {
    for (const f of r.findings) byRule.set(f.ruleId, (byRule.get(f.ruleId) ?? 0) + 1);
  }

  console.log('\n=== Nobble smoke test ===');
  console.log(`repos:     ${repos.join(', ')}`);
  console.log(`analyzed:  ${analyzed.length} PRs (${all.length - analyzed.length} skipped)`);
  console.log(`flagged:   ${flagged.length} PRs`);
  console.log(
    `rate:      ${rate.toFixed(1)}%  ${rate <= 10 ? 'PASS (<= 10%)' : 'FAIL (> 10%, rules are too loose)'}`,
  );

  // The headline rate is flattered by PRs that never touch a test file -- most of Nobble's
  // rules cannot fire on those, so they are free passes. The rate among PRs that DID touch
  // tests is the harder and more honest number.
  const touched = analyzed.filter((r) => r.touchedTests);
  const touchedFlagged = touched.filter((r) => r.findings.length > 0);
  const touchedRate = touched.length ? (touchedFlagged.length / touched.length) * 100 : 0;
  console.log(
    `  of the ${touched.length} PRs that touched a test file: ${touchedFlagged.length} flagged (${touchedRate.toFixed(1)}%)`,
  );

  // The number that decides whether the tool is tolerable in CI. The default posture is
  // non-blocking, and only `block` is loud, so this is the rate that would actually
  // interrupt anyone if they opted into `fail-on: block`.
  const blocked = analyzed.filter((r) => r.verdict === 'block');
  const warned = analyzed.filter((r) => r.verdict === 'warn');
  console.log(
    `verdicts:  ${blocked.length} block, ${warned.length} warn, ${analyzed.length - blocked.length - warned.length} pass`,
  );
  console.log(
    `  block rate: ${((blocked.length / Math.max(1, analyzed.length)) * 100).toFixed(1)}% of all PRs`,
  );
  console.log(`elapsed:   ${((Date.now() - started) / 1000).toFixed(0)}s`);

  if (byRule.size > 0) {
    console.log('\nfindings by rule:');
    for (const [rule, count] of [...byRule].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${rule}  ${count}`);
    }
  }

  console.log('\nper-repo:');
  for (const repo of repos) {
    const forRepo = analyzed.filter((r) => r.repo === repo);
    const hit = forRepo.filter((r) => r.findings.length > 0);
    if (forRepo.length === 0) continue;
    console.log(
      `  ${repo}: ${hit.length}/${forRepo.length} (${((hit.length / forRepo.length) * 100).toFixed(1)}%)`,
    );
  }

  if (values.verbose && flagged.length) {
    console.log('\nflagged PRs:');
    for (const r of flagged) {
      console.log(`\n  ${r.repo}#${r.number} — ${r.title}`);
      for (const f of r.findings) console.log(`    ${f.ruleId} ${f.file}:${f.line} ${f.message}`);
    }
  }

  if (values.json) {
    fs.writeFileSync(
      values.json,
      JSON.stringify(
        {
          repos,
          analyzed: analyzed.length,
          flagged: flagged.length,
          rate,
          byRule: Object.fromEntries(byRule),
          results: flagged,
        },
        null,
        2,
      ),
    );
    console.log(`\nwrote ${values.json}`);
  }

  process.exit(rate > 10 ? 1 : 0);
}

void main();

export { execFileSync };
