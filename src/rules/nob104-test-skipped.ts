import type { Rule } from './types.js';
import { makeFinding, isCommentOnly } from './helpers.js';

/**
 * NOB-104 Test disabled or skipped.
 *
 * Regex only, and deliberately so: this rule must run for languages Nobble has no grammar
 * for (spec §6). It is the single most valuable rule for an unsupported language.
 */

interface SkipPattern {
  re: RegExp;
  label: string;
}

const PATTERNS: SkipPattern[] = [
  // JS/TS
  {
    re: /\b(?:it|test|describe|context|suite)\.(?:skip|todo|failing)\s*\(/,
    label: 'skipped block',
  },
  { re: /\bx(?:it|test|describe|context)\s*\(/, label: 'x-prefixed skip' },
  { re: /\b(?:it|test|describe)\.each\s*\(\s*\[\s*\]\s*\)/, label: 'empty each table' },
  { re: /\bthis\.skip\s*\(\s*\)/, label: 'runtime skip' },
  // Python
  { re: /@(?:pytest\.mark\.)?(?:skip|skipif|xfail)\b/, label: 'pytest skip marker' },
  { re: /@unittest\.(?:skip|skipIf|skipUnless|expectedFailure)\b/, label: 'unittest skip' },
  { re: /\bpytest\.skip\s*\(/, label: 'pytest.skip call' },
  { re: /\bself\.skipTest\s*\(/, label: 'skipTest call' },
  // Ruby
  { re: /^\s*(?:skip|pending)\b(?!\w)/, label: 'RSpec skip/pending' },
  {
    re: /\b(?:it|describe|context|specify)\s+.*,\s*(?:skip|pending):\s*(?:true|["'])/,
    label: 'RSpec skip option',
  },
  { re: /\bx(?:it|describe|context|specify)\s+/, label: 'RSpec x-prefixed skip' },
  // Go
  { re: /\bt\.Skip(?:Now|f)?\s*\(/, label: 't.Skip()' },
  // JVM
  { re: /@(?:Ignore|Disabled)\b/, label: '@Ignore/@Disabled' },
];

export const nob104: Rule = {
  id: 'NOB-104',
  title: 'Test disabled or skipped',
  defaultSeverity: 'high',
  weight: 25,
  requiresAst: false,
  appliesTo: ['test'],
  rationale:
    'A skipped test is a test that cannot fail. Skipping is the cheapest way to make a red suite green without changing any behaviour.',
  run(ctx) {
    const findings = [];
    for (const line of ctx.addedLines) {
      if (isCommentOnly(line.text)) continue;
      for (const { re, label } of PATTERNS) {
        if (!re.test(line.text)) continue;
        findings.push(
          makeFinding(ctx, {
            line: line.line,
            message: `Test skipped (${label}): \`${line.text.trim()}\``,
            after: line.text,
          }),
        );
        break; // one finding per line, whichever pattern matched first
      }
    }
    return findings;
  },
};
