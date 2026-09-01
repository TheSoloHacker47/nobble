import type { Finding } from '../types.js';

/**
 * Inline suppression (spec §8).
 *
 *     // nobble-ignore NOB-102: rewriting this suite for the new API shape, see #482
 *
 * A suppression comment with no reason after the colon does NOT suppress; instead the
 * original finding stands and NOB-001 fires alongside it. See DECISIONS.md A2 -- silencing
 * a 30-point finding in exchange for a 5-point one would make an empty suppression the
 * cheapest way to hide anything.
 */

const SUPPRESSION = /nobble-ignore\s+(NOB-\d{3})\s*:?(.*)$/i;

export interface Suppression {
  ruleId: string;
  line: number;
  reason: string;
  hasReason: boolean;
}

export function findSuppressions(source: string): Suppression[] {
  const out: Suppression[] = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = SUPPRESSION.exec(lines[i]!);
    if (!m) continue;
    // Strip trailing comment-block terminators like `*/` or `-->`.
    const reason = (m[2] ?? '').replace(/(\*\/|-->|#}|\*\))\s*$/, '').trim();
    out.push({
      ruleId: m[1]!.toUpperCase(),
      line: i + 1,
      reason,
      hasReason: reason.length > 0,
    });
  }
  return out;
}

export interface SuppressionResult {
  kept: Finding[];
  suppressed: Finding[];
  /** Suppression comments with no reason, for NOB-001 to turn into findings. */
  unexplained: Suppression[];
}

/**
 * A suppression applies to a finding on the same line or the line immediately below it
 * (the comment sits above the offending code, or trails it).
 */
export function applySuppressions(
  findings: Finding[],
  suppressionsByFile: Map<string, Suppression[]>,
): SuppressionResult {
  const kept: Finding[] = [];
  const suppressed: Finding[] = [];

  for (const finding of findings) {
    const inFile = suppressionsByFile.get(finding.file) ?? [];
    const match = inFile.find(
      (s) =>
        s.ruleId === finding.ruleId && (s.line === finding.line || s.line === finding.line - 1),
    );
    if (!match) {
      kept.push(finding);
    } else if (match.hasReason) {
      suppressed.push(finding);
    } else {
      // Malformed suppression: the finding survives. NOB-001 fires separately, below.
      kept.push(finding);
    }
  }

  // Every reasonless suppression is reported, whether or not it matched a finding --
  // a stray `nobble-ignore NOB-101:` with nothing after it is worth surfacing either way.
  const unexplained: Suppression[] = [];
  for (const list of suppressionsByFile.values()) {
    for (const s of list) if (!s.hasReason) unexplained.push(s);
  }

  return { kept, suppressed, unexplained };
}
