import { SEVERITY_ORDER, type Finding, type Verdict } from '../types.js';
import type { ResolvedConfig } from '../config/schema.js';

/** Spec §7: score = sum of weights, capped at 100. */
export function score(findings: Finding[]): number {
  return Math.min(
    100,
    findings.reduce((sum, f) => sum + f.weight, 0),
  );
}

export function verdictFor(total: number, config: ResolvedConfig): Verdict {
  if (total >= config.thresholds.block) return 'block';
  if (total >= config.thresholds.warn) return 'warn';
  return 'pass';
}

/** Severity first, then weight, then file/line so output is stable across runs. */
export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    if (b.weight !== a.weight) return b.weight - a.weight;
    if (a.file !== b.file) return a.file < b.file ? -1 : 1;
    if (a.line !== b.line) return a.line - b.line;
    return a.ruleId < b.ruleId ? -1 : a.ruleId > b.ruleId ? 1 : 0;
  });
}

/**
 * Spec §7: the CLI exits 1 on `block` only in strict mode, and 0 otherwise. The default
 * posture is non-blocking, because a tool that breaks CI on day one gets uninstalled on
 * day one.
 */
export function exitCode(verdict: Verdict, failOn: ResolvedConfig['failOn']): number {
  if (failOn === 'none') return 0;
  if (failOn === 'block') return verdict === 'block' ? 1 : 0;
  if (failOn === 'warn') return verdict === 'warn' || verdict === 'block' ? 1 : 0;
  return 0;
}
