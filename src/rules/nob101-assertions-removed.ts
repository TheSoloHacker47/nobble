import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';
import { diffTestBlocks, fileLostAssertions, pairedSourceDeleted } from './block-matching.js';

/**
 * NOB-101 Assertions removed from an existing test.
 *
 * Fires per test block, not per assertion: removing three assertions from one test is one
 * decision a reviewer needs to see, not three separate lines to wade through.
 *
 * Guards, in order of how much noise each one removes:
 *  1. the file's TOTAL assertion count must also have dropped -- see `fileLostAssertions`
 *  2. the file must not be deleted, and neither must its paired source
 *  3. the block must still exist after (a deleted block is NOB-103's job, not this one)
 */
export const nob101: Rule = {
  id: 'NOB-101',
  title: 'Assertions removed from an existing test',
  defaultSeverity: 'high',
  weight: 30,
  requiresAst: true,
  appliesTo: ['test'],
  rationale:
    'The test still exists and still passes, so nothing looks wrong, but it now checks less than it did.',
  run(ctx) {
    if (ctx.degraded) return [];
    if (ctx.file.status === 'deleted') return [];
    if (pairedSourceDeleted(ctx)) return [];

    const diff = diffTestBlocks(ctx);
    if (!diff) return [];

    // Assertions moved between blocks rather than lost: a split test, a Mocha-to-Jest
    // port, an extracted helper. Not tampering.
    if (!fileLostAssertions(diff)) return [];

    const findings = [];
    for (const m of diff.matched) {
      const lost = m.beforeAssertions.length - m.afterAssertions.length;
      if (lost <= 0) continue;

      const removedTexts = m.beforeAssertions
        .filter((b) => !m.afterAssertions.some((a) => a.text === b.text))
        .slice(0, 3)
        .map((a) => a.text);

      findings.push(
        makeFinding(ctx, {
          line: m.after.startLine,
          endLine: m.after.endLine,
          message: `${lost} assertion${lost === 1 ? '' : 's'} removed from \`${m.after.name}\` (${m.beforeAssertions.length} → ${m.afterAssertions.length}).`,
          before: removedTexts.join('\n') || undefined,
        }),
      );
    }
    return findings;
  },
};
