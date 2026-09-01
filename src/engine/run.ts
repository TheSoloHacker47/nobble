import fs from 'node:fs';
import path from 'node:path';
import type { AnalysisResult, Finding } from '../types.js';
import type { ResolvedConfig } from '../config/schema.js';
import { buildMatchers, classify } from '../diff/classify.js';
import { parseUnifiedDiff } from '../diff/parse.js';
import { readBlobs, listTrackedFiles } from '../diff/git.js';
import { findPairedTest } from './pairing.js';
import { score, verdictFor, sortFindings } from './score.js';
import { findSuppressions, applySuppressions, type Suppression } from './suppress.js';
import { allRules } from '../rules/index.js';
import { adapterForPath, initParsers, initAdapters } from '../parsers/index.js';
import type { ChangedFile, FileSnapshot, RuleContext, Rule } from '../rules/types.js';

export interface RunOptions {
  diffText: string;
  config: ResolvedConfig;
  cwd?: string;
  /** Base ref for before-blob retrieval. Omit to run diff-only (degraded). */
  base?: string;
  /** Restrict to these rule IDs (CLI --rules). */
  ruleAllowlist?: string[];
  /** Injectable for tests; defaults to reading the working tree. */
  readAfter?: (p: string) => string | undefined;
}

function defaultReadAfter(cwd: string) {
  return (p: string): string | undefined => {
    try {
      return fs.readFileSync(path.join(cwd, p), 'utf8');
    } catch {
      return undefined;
    }
  };
}

/** A rule runs on a file when the file's kind is in `appliesTo`. */
function applies(rule: Rule, file: ChangedFile): boolean {
  return rule.appliesTo.includes(file.kind);
}

export async function run(opts: RunOptions): Promise<AnalysisResult> {
  const cwd = opts.cwd ?? process.cwd();
  const { config } = opts;
  const matchers = buildMatchers(config);

  const parsed = parseUnifiedDiff(opts.diffText).filter((f) => !matchers.isIgnored(f.path));

  const files: ChangedFile[] = parsed.map((f) => ({
    ...f,
    kind: classify(f.path, matchers),
    isSecurityPath: matchers.isSecurity(f.path),
  }));

  if (files.length === 0) {
    return {
      findings: [],
      totalFindings: 0,
      score: 0,
      verdict: 'pass',
      degraded: false,
      filesAnalyzed: 0,
      testFilesChanged: 0,
    };
  }

  // --- retrieve before/after content -----------------------------------------
  let degraded = false;
  let degradedReason: string | undefined;

  const needBefore = files.filter((f) => f.status !== 'added').map((f) => f.oldPath);
  let beforeBlobs = new Map<string, string | undefined>();
  if (opts.base && needBefore.length > 0) {
    beforeBlobs = readBlobs(opts.base, needBefore, { cwd });
    const missing = needBefore.filter((p) => beforeBlobs.get(p) === undefined);
    if (missing.length === needBefore.length) {
      degraded = true;
      degradedReason = `could not read any file contents at base ref "${opts.base}"; only diff-only rules ran`;
    }
  } else if (needBefore.length > 0) {
    degraded = true;
    degradedReason = 'no base ref available; only diff-only rules ran';
  }

  const readAfter = opts.readAfter ?? defaultReadAfter(cwd);

  // --- parse ASTs, but only where a rule will actually use one ----------------
  const rules = allRules().filter((r) => {
    if (opts.ruleAllowlist && !opts.ruleAllowlist.includes(r.id)) return false;
    return config.rules[r.id]?.enabled !== false;
  });
  const anyAstRule = rules.some((r) => r.requiresAst);
  if (anyAstRule) {
    await initParsers();
    await initAdapters();
  }

  const trackedFiles = listTrackedFiles(cwd);

  const snapshots = new Map<string, { before?: FileSnapshot; after?: FileSnapshot }>();
  for (const file of files) {
    const adapter = adapterForPath(file.path);
    const wantsAst =
      anyAstRule && adapter !== undefined && rules.some((r) => r.requiresAst && applies(r, file));

    const beforeSrc = file.status === 'added' ? undefined : beforeBlobs.get(file.oldPath);
    const afterSrc = file.status === 'deleted' ? undefined : readAfter(file.path);

    const before: FileSnapshot | undefined =
      beforeSrc === undefined ? undefined : { source: beforeSrc };
    const after: FileSnapshot | undefined =
      afterSrc === undefined ? undefined : { source: afterSrc };

    if (wantsAst && adapter) {
      try {
        if (before) {
          before.tree = adapter.parse(before.source);
          before.adapter = adapter;
        }
        if (after) {
          after.tree = adapter.parse(after.source);
          after.adapter = adapter;
        }
      } catch {
        // A grammar failure on one file must not take down the run.
      }
    }
    snapshots.set(file.path, { before, after });
  }

  // --- run rules --------------------------------------------------------------
  const byPath = new Map(files.map((f) => [f.path, f]));
  const findings: Finding[] = [];

  for (const file of files) {
    const snap = snapshots.get(file.path)!;

    let pairedTest: RuleContext['pairedTest'];
    if (file.kind === 'source') {
      const p = findPairedTest(file.path, matchers.isTest, { trackedFiles });
      if (p) pairedTest = { path: p, changed: byPath.has(p), file: byPath.get(p) };
    }

    for (const rule of rules) {
      if (!applies(rule, file)) continue;
      if (rule.requiresAst && !snap.after?.tree && !snap.before?.tree) continue;

      const override = config.rules[rule.id];
      const ctx: RuleContext = {
        file,
        before: snap.before,
        after: snap.after,
        pairedTest,
        addedLines: file.addedLines,
        removedLines: file.removedLines,
        config,
        matchers,
        degraded,
        allFiles: files,
        rule: {
          id: rule.id,
          title: rule.title,
          severity: override?.severity ?? rule.defaultSeverity,
          weight: override?.weight ?? rule.weight,
        },
      };
      try {
        findings.push(...rule.run(ctx));
      } catch (err) {
        // One broken rule must not lose the other fifteen rules' findings.
        if (process.env.NOBBLE_DEBUG) {
          console.error(`nobble: rule ${rule.id} threw on ${file.path}:`, err);
        }
      }
    }
  }

  // --- suppressions ------------------------------------------------------------
  const suppressionsByFile = new Map<string, Suppression[]>();
  for (const file of files) {
    const src = snapshots.get(file.path)?.after?.source;
    if (!src) continue;
    const found = findSuppressions(src);
    if (found.length > 0) suppressionsByFile.set(file.path, found);
  }
  const { kept, unexplained } = applySuppressions(findings, suppressionsByFile);

  // NOB-001 is emitted here rather than as a per-file rule because it is derived from
  // suppression parsing, which happens after every other rule has run.
  const nob001 = allRules().find((r) => r.id === 'NOB-001');
  if (nob001 && config.rules['NOB-001']?.enabled !== false) {
    for (const [filePath, list] of suppressionsByFile) {
      for (const s of list) {
        if (s.hasReason) continue;
        if (!unexplained.includes(s)) continue;
        kept.push({
          ruleId: 'NOB-001',
          title: nob001.title,
          severity: config.rules['NOB-001']?.severity ?? nob001.defaultSeverity,
          weight: config.rules['NOB-001']?.weight ?? nob001.weight,
          file: filePath,
          line: s.line,
          message: `Suppression of ${s.ruleId} has no reason. Add one after the colon.`,
          evidence: {},
          suppressWith: '',
        });
      }
    }
  }

  const sorted = sortFindings(kept);
  const total = score(sorted);

  return {
    findings: sorted.slice(0, config.maxFindings),
    totalFindings: sorted.length,
    score: total,
    verdict: verdictFor(total, config),
    degraded,
    degradedReason,
    filesAnalyzed: files.length,
    testFilesChanged: files.filter((f) => f.kind === 'test').length,
  };
}
