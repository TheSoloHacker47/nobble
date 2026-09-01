import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';
import { diffTestBlocks, pairedSourceDeleted } from './block-matching.js';

/**
 * NOB-102 Assertion weakened.
 *
 * Aligns assertions within a matched block by position and fires when one was replaced by
 * a strictly weaker matcher.
 *
 * Guard: the block's assertion COUNT must be unchanged. If assertions were also removed,
 * NOB-101 already reports that block, and firing both would double-charge one edit against
 * the score and push other findings out under the 20-item cap.
 */
export const nob102: Rule = {
  id: 'NOB-102',
  title: 'Assertion weakened',
  defaultSeverity: 'high',
  weight: 30,
  requiresAst: true,
  appliesTo: ['test'],
  rationale:
    'The assertion count is unchanged, so the test looks untouched, but it now accepts values it used to reject.',
  run(ctx) {
    if (ctx.degraded) return [];
    if (ctx.file.status === 'deleted') return [];
    if (pairedSourceDeleted(ctx)) return [];

    const diff = diffTestBlocks(ctx);
    if (!diff) return [];

    const findings = [];
    for (const m of diff.matched) {
      // Unequal counts mean this block is NOB-101's territory.
      if (m.beforeAssertions.length !== m.afterAssertions.length) continue;

      for (let i = 0; i < m.beforeAssertions.length; i++) {
        const before = m.beforeAssertions[i]!;
        const after = m.afterAssertions[i]!;
        if (before.text === after.text) continue;

        const beforeStrength = diff.beforeAdapter.assertionStrength(before);
        const afterStrength = diff.afterAdapter.assertionStrength(after);
        if (afterStrength >= beforeStrength) continue;

        const how =
          before.matcher === after.matcher
            ? `\`${after.matcher}\` now accepts a wildcard argument`
            : `\`${before.matcher}\` → \`${after.matcher}\``;

        findings.push(
          makeFinding(ctx, {
            line: after.startLine,
            message: `Assertion weakened in \`${m.after.name}\`: ${how}.`,
            before: before.text,
            after: after.text,
          }),
        );
      }
    }
    return findings;
  },
};
