import type { Finding } from '../types.js';
import type { RuleContext } from './types.js';

/** Comment token per language, so `suppressWith` is pasteable as-is. */
export function commentToken(filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.')).toLowerCase();
  if (['.py', '.rb', '.yml', '.yaml', '.sh', '.toml', '.cfg', '.properties'].includes(ext)) {
    return '#';
  }
  if (filePath.endsWith('.coveragerc') || filePath.endsWith('.simplecov')) return '#';
  return '//';
}

export interface FindingInput {
  line: number;
  endLine?: number;
  message: string;
  before?: string;
  after?: string;
}

/** Builds a Finding with the rule's resolved severity/weight and a pasteable suppression. */
export function makeFinding(ctx: RuleContext, input: FindingInput): Finding {
  const token = commentToken(ctx.file.path);
  const finding: Finding = {
    ruleId: ctx.rule.id,
    title: ctx.rule.title,
    severity: ctx.rule.severity,
    weight: ctx.rule.weight,
    file: ctx.file.path,
    line: input.line,
    message: input.message,
    evidence: {},
    suppressWith: `${token} nobble-ignore ${ctx.rule.id}: <reason>`,
  };
  if (input.endLine !== undefined) finding.endLine = input.endLine;
  if (input.before !== undefined) finding.evidence.before = input.before;
  if (input.after !== undefined) finding.evidence.after = input.after;
  return finding;
}

/** Strips a trailing line comment so patterns do not match inside prose. */
export function stripComment(line: string): string {
  return line.replace(/\s*(\/\/|#)\s.*$/, '');
}

export function isCommentOnly(line: string): boolean {
  const t = line.trim();
  return (
    t === '' ||
    t.startsWith('//') ||
    t.startsWith('#') ||
    t.startsWith('*') ||
    t.startsWith('/*') ||
    t.startsWith('"""') ||
    t.startsWith("'''")
  );
}

/** True when every added line is blank or a comment -- i.e. no behaviour changed. */
export function allTrivial(lines: { text: string }[]): boolean {
  return lines.every((l) => isCommentOnly(l.text));
}

/**
 * Pulls every `key: number` style pair out of a config blob, keyed by a path that
 * survives reformatting. Used by NOB-401 to compare thresholds across five different
 * config formats without parsing any of them. See DECISIONS.md A5.
 */
export function extractNumbers(source: string, keys: RegExp): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const rawLine of source.split('\n')) {
    const line = rawLine.trim();
    const keyMatch = keys.exec(line);
    if (!keyMatch) continue;
    const nums = [...line.matchAll(/(-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
    if (nums.length === 0) continue;
    const key = keyMatch[0].toLowerCase().replace(/[^a-z_]/g, '');
    out.set(key, [...(out.get(key) ?? []), ...nums]);
  }
  return out;
}
