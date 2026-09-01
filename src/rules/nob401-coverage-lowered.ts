import type { Rule } from './types.js';
import { makeFinding, extractNumbers } from './helpers.js';

/**
 * NOB-401 Coverage threshold lowered.
 *
 * Compares the numbers next to known threshold keys before and after, rather than parsing
 * five different config formats (JS, INI, YAML, TOML, .properties). See DECISIONS.md A5.
 */

const THRESHOLD_KEYS =
  /\b(coverageThreshold|statements|branches|functions|lines|fail_under|minimum_coverage|min_coverage|minimum|coverage|check_coverage|per_file|global|watermarks|sonar\.coverage\.\w+|target|threshold)\b/i;

/** Keys whose numbers are not thresholds and would otherwise cause noise. */
const IGNORE_LINE = /\b(version|port|timeout|maxWorkers|node|python|ruby|cache|id|seed)\b/i;

export const nob401: Rule = {
  id: 'NOB-401',
  title: 'Coverage threshold lowered',
  defaultSeverity: 'high',
  weight: 30,
  requiresAst: false,
  appliesTo: ['coverage_config'],
  rationale:
    'Lowering the bar is not the same as clearing it. A dropped threshold lets uncovered code through without anyone deciding to allow it.',
  run(ctx) {
    if (!ctx.before?.source || !ctx.after?.source) return [];

    const before = extractNumbers(
      ctx.before.source
        .split('\n')
        .filter((l) => !IGNORE_LINE.test(l))
        .join('\n'),
      THRESHOLD_KEYS,
    );
    const after = extractNumbers(
      ctx.after.source
        .split('\n')
        .filter((l) => !IGNORE_LINE.test(l))
        .join('\n'),
      THRESHOLD_KEYS,
    );

    const findings = [];
    for (const [key, beforeNums] of before) {
      const afterNums = after.get(key);
      if (!afterNums) continue;
      const beforeMax = Math.max(...beforeNums);
      const afterMax = Math.max(...afterNums);
      if (afterMax >= beforeMax) continue;

      // Locate the changed line so the finding points somewhere useful.
      const changed = ctx.addedLines.find((l) => new RegExp(key, 'i').test(l.text));
      const removed = ctx.removedLines.find((l) => new RegExp(key, 'i').test(l.text));

      findings.push(
        makeFinding(ctx, {
          line: changed?.line ?? ctx.addedLines[0]?.line ?? 1,
          message: `Coverage threshold \`${key}\` lowered from ${beforeMax} to ${afterMax}.`,
          before: removed?.text,
          after: changed?.text,
        }),
      );
    }
    return findings;
  },
};
