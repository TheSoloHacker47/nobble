import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';

/**
 * NOB-403 Test file excluded from tooling.
 *
 * Excluding a test path is a quieter version of deleting the test: the file stays in the
 * repository, so a reviewer scanning the file list sees nothing missing.
 */

const EXCLUSION_KEYS =
  /\b(testPathIgnorePatterns|coveragePathIgnorePatterns|modulePathIgnorePatterns|testIgnore|exclude|ignore|omit|norecursedirs|collectCoverageFrom|testMatch|testRegex|--ignore|--exclude|--testPathIgnorePatterns|skip_dirs)\b/;

/** Does this string look like it points at tests? */
const TEST_SHAPED =
  /(^|[/\\"'`\s(])(?:tests?|specs?|__tests__|e2e|integration)([/\\"'`\s),]|$)|[._-](?:test|spec)[._-]?|\*\.(?:test|spec)\./i;

const EXCLUSION_FILES = /(^|\/)(\.eslintignore|\.prettierignore|\.rspec|\.npmignore|\.gitignore)$/;

export const nob403: Rule = {
  id: 'NOB-403',
  title: 'Test file excluded from tooling',
  defaultSeverity: 'high',
  weight: 25,
  requiresAst: false,
  appliesTo: ['coverage_config', 'ci_config', 'other', 'source'],
  rationale:
    'An excluded test still exists in the repository, so nothing looks missing, but it no longer runs.',
  run(ctx) {
    const isExclusionFile = EXCLUSION_FILES.test(ctx.file.path);
    // Only look at config-ish files; a source file mentioning "exclude" is not interesting.
    if (!isExclusionFile && ctx.file.kind === 'source') return [];
    if (!isExclusionFile && ctx.file.kind === 'other') return [];

    const findings = [];
    for (const line of ctx.addedLines) {
      const text = line.text;
      const onExclusionKey = EXCLUSION_KEYS.test(text);
      if (!isExclusionFile && !onExclusionKey) continue;
      if (!TEST_SHAPED.test(text)) continue;
      // `testMatch`/`collectCoverageFrom` are inclusion lists; only flag a negation there.
      if (/\b(testMatch|testRegex|collectCoverageFrom)\b/.test(text) && !/!/.test(text)) continue;

      findings.push(
        makeFinding(ctx, {
          line: line.line,
          message: `Test path excluded from tooling: \`${text.trim()}\``,
          after: text,
        }),
      );
    }
    return findings;
  },
};
