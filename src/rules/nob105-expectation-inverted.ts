import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';
import { diffTestBlocks, pairedSourceDeleted } from './block-matching.js';

/**
 * NOB-105 Expected-failure inversion.
 *
 * `expect(x).toBe(y)` becoming `expect(x).not.toBe(y)` is the most direct way to make a
 * failing test pass: assert the wrong answer instead of producing the right one.
 *
 * Lower severity than NOB-101/102 because inversion is also a legitimate edit when the
 * expected behaviour genuinely changed -- which is why it is medium and 15, not high.
 */
export const nob105: Rule = {
  id: 'NOB-105',
  title: 'Expected-failure inversion',
  defaultSeverity: 'medium',
  weight: 15,
  requiresAst: true,
  appliesTo: ['test'],
  rationale:
    'The expectation was flipped rather than satisfied. The test passes by asserting the behaviour it used to reject.',
  run(ctx) {
    if (ctx.degraded) return [];
    if (ctx.file.status === 'deleted') return [];
    if (pairedSourceDeleted(ctx)) return [];

    const diff = diffTestBlocks(ctx);
    if (!diff) return [];

    const findings = [];
    for (const m of diff.matched) {
      if (m.beforeAssertions.length !== m.afterAssertions.length) continue;

      for (let i = 0; i < m.beforeAssertions.length; i++) {
        const before = m.beforeAssertions[i]!;
        const after = m.afterAssertions[i]!;
        if (before.isNegated || !after.isNegated) continue;
        // Only an inversion if the assertion is otherwise the same one.
        if (before.matcher !== after.matcher) continue;

        findings.push(
          makeFinding(ctx, {
            line: after.startLine,
            message: `Expectation inverted in \`${m.after.name}\`: \`${before.matcher}\` is now negated.`,
            before: before.text,
            after: after.text,
          }),
        );
      }
    }
    return findings;
  },
};
