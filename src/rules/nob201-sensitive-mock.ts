import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';

/**
 * NOB-201 Mock introduced around a sensitive symbol.
 *
 * The highest-weight rule in the set. Mocking out `current_user` or an authorization check
 * makes a test pass while removing the only thing that was verifying the security boundary
 * -- and unlike a deleted assertion, it reads as ordinary test setup.
 *
 * Compares the mocks present before against those present after, so a mock that was
 * already there does not fire on every subsequent PR that touches the file.
 */

function symbolMatcher(patterns: string[]): (target: string) => string | undefined {
  const compiled = patterns.map((p) => {
    try {
      // Patterns are regex fragments (the defaults include `can\?`), matched loosely
      // against the mock target. A malformed user pattern must not take down the run.
      return { source: p, re: new RegExp(p, 'i') };
    } catch {
      return { source: p, re: new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') };
    }
  });
  return (target: string) => compiled.find((c) => c.re.test(target))?.source;
}

export const nob201: Rule = {
  id: 'NOB-201',
  title: 'Mock introduced around a sensitive symbol',
  defaultSeverity: 'critical',
  weight: 40,
  requiresAst: true,
  appliesTo: ['test', 'source'],
  rationale:
    'Mocking an authorization or identity boundary removes the very thing the test was there to verify, while looking like ordinary setup.',
  run(ctx) {
    const afterTree = ctx.after?.tree;
    const adapter = ctx.after?.adapter;
    if (!afterTree || !adapter) return [];

    const matches = symbolMatcher(ctx.config.sensitiveSymbols);

    const afterMocks = adapter.findMocks(afterTree);
    // Mocks already present before this change are not this PR's doing.
    const beforeMocks =
      ctx.before?.tree && ctx.before.adapter ? ctx.before.adapter.findMocks(ctx.before.tree) : [];
    const beforeKeys = new Set(beforeMocks.map((m) => `${m.construct}::${m.target}`));

    const findings = [];
    for (const mock of afterMocks) {
      if (beforeKeys.has(`${mock.construct}::${mock.target}`)) continue;
      const symbol = matches(mock.target);
      if (!symbol) continue;

      findings.push(
        makeFinding(ctx, {
          line: mock.startLine,
          message: `Mock added around a sensitive symbol (\`${symbol}\`): \`${mock.construct}\` targeting \`${mock.target}\`.`,
          after: mock.text,
        }),
      );
    }
    return findings;
  },
};
