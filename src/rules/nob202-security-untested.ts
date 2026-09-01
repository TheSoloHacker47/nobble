import type { Rule } from './types.js';
import { makeFinding, allTrivial } from './helpers.js';

/**
 * NOB-202 Security-path source change with no new test coverage.
 *
 * The only rule that reasons about a file other than the one it fires on, and the one most
 * capable of being annoying, so the guards are deliberately strict:
 *
 *  - the source change must be non-trivial (comments and blank lines do not count)
 *  - a paired test must actually EXIST. `pairing.ts` returns undefined rather than guessing,
 *    and this rule stays silent in that case rather than complaining about a missing test
 *    file it is not confident about
 *  - the paired test must be untouched, or have had assertions removed
 */
export const nob202: Rule = {
  id: 'NOB-202',
  title: 'Security-path source change with no new test coverage',
  defaultSeverity: 'high',
  weight: 25,
  requiresAst: true,
  appliesTo: ['source'],
  rationale:
    'Security-relevant behaviour changed while the tests that cover it did not, so nothing verifies the new behaviour.',
  run(ctx) {
    if (!ctx.file.isSecurityPath) return [];
    if (ctx.file.status === 'deleted') return [];
    // Comment-only or whitespace-only edits change no behaviour.
    if (ctx.addedLines.length === 0 || allTrivial(ctx.addedLines)) return [];

    // No confident pairing means no finding. Never guess which test covers this file.
    const paired = ctx.pairedTest;
    if (!paired) return [];

    if (paired.changed) {
      const testFile = paired.file;
      // The test was touched. That is fine unless it only LOST assertions, which is the
      // case the spec calls out: changing security code and weakening its test together.
      if (!testFile) return [];
      const gained = testFile.addedLines.filter((l) =>
        /\b(expect|assert|should)\b/.test(l.text),
      ).length;
      const lost = testFile.removedLines.filter((l) =>
        /\b(expect|assert|should)\b/.test(l.text),
      ).length;
      if (gained >= lost) return [];

      return [
        makeFinding(ctx, {
          line: ctx.addedLines[0]!.line,
          message: `Security-path file changed while its test \`${paired.path}\` lost ${lost - gained} assertion(s).`,
          after: ctx.addedLines[0]!.text,
        }),
      ];
    }

    return [
      makeFinding(ctx, {
        line: ctx.addedLines[0]!.line,
        message: `Security-path file changed but its paired test \`${paired.path}\` was not touched.`,
        after: ctx.addedLines[0]!.text,
      }),
    ];
  },
};
