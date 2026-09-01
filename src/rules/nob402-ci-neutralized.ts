import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';

/**
 * NOB-402 Test or check step neutralized in CI.
 *
 * Severity critical: a neutralized CI step means every other check in the repository
 * silently stops being enforced, which is strictly worse than any single weakened test.
 */

const CHECK_COMMAND =
  /\b(test|spec|lint|audit|typecheck|tsc|mypy|rubocop|eslint|pytest|jest|vitest|rspec|check)\b/i;

const NEUTRALIZERS: { re: RegExp; label: string }[] = [
  { re: /continue-on-error\s*:\s*true/i, label: 'continue-on-error: true' },
  { re: /\|\|\s*true\s*$/, label: '|| true' },
  { re: /;\s*exit\s+0\s*$/, label: '; exit 0' },
  { re: /--passWithNoTests\b/, label: '--passWithNoTests' },
  { re: /--maxfail=0\b/, label: '--maxfail=0' },
  { re: /(?:^|\s)--force(?:\s|$)/, label: '--force' },
  { re: /\|\|\s*:\s*$/, label: '|| :' },
  { re: /\bset\s+\+e\b/, label: 'set +e' },
  { re: /if:\s*(?:false|never\(\))/i, label: 'if: false' },
];

export const nob402: Rule = {
  id: 'NOB-402',
  title: 'Test or check step neutralized in CI',
  defaultSeverity: 'critical',
  weight: 40,
  requiresAst: false,
  appliesTo: ['ci_config'],
  rationale:
    'A CI step that cannot fail is not a check. This disables enforcement for the entire repository, not just one test.',
  run(ctx) {
    const findings = [];

    for (const line of ctx.addedLines) {
      const text = line.text;
      for (const { re, label } of NEUTRALIZERS) {
        if (!re.test(text)) continue;
        // `continue-on-error` and `if: false` are damning on their own. The shell-level
        // neutralizers only matter when attached to a command that actually checks something.
        const standalone = label === 'continue-on-error: true' || label === 'if: false';
        if (!standalone && !CHECK_COMMAND.test(text)) continue;

        findings.push(
          makeFinding(ctx, {
            line: line.line,
            message: `CI check neutralized (${label}): \`${text.trim()}\``,
            after: text,
          }),
        );
        break;
      }
    }

    // A removed `run:` line containing a test command, with no equivalent added back.
    const addedText = ctx.addedLines.map((l) => l.text).join('\n');
    for (const line of ctx.removedLines) {
      if (!/^\s*-?\s*run\s*:/.test(line.text)) continue;
      if (!CHECK_COMMAND.test(line.text)) continue;
      const command = line.text.replace(/^\s*-?\s*run\s*:\s*/, '').trim();
      if (!command) continue;
      // Re-indented or reordered, not removed.
      if (addedText.includes(command)) continue;
      findings.push(
        makeFinding(ctx, {
          line: line.line,
          message: `CI step running a check was removed: \`${command}\``,
          before: line.text,
        }),
      );
    }
    return findings;
  },
};
