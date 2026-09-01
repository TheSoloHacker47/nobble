import type { Rule } from './types.js';
import { makeFinding, isCommentOnly } from './helpers.js';

/**
 * NOB-303 Timing band-aid added.
 *
 * The lowest-weight rule and the noisiest by nature, so the guards matter:
 *  - test files only, or a source line that is clearly inside a retry loop
 *  - `waitFor`, `waitUntil` and friends are proper waits, not band-aids, and are skipped
 *  - a sleep REMOVED in the same hunk means the diff is fixing a flake, not adding one
 */

const SLEEP_PATTERNS: { re: RegExp; label: string }[] = [
  {
    re: /\bawait\s+new\s+Promise\s*\(\s*\w*\s*=>\s*setTimeout\b/,
    label: 'await new Promise(setTimeout)',
  },
  { re: /\bsetTimeout\s*\(/, label: 'setTimeout' },
  { re: /\btime\.sleep\s*\(/, label: 'time.sleep' },
  { re: /\basyncio\.sleep\s*\(/, label: 'asyncio.sleep' },
  { re: /(?<![.\w])sleep\s*[( ]\s*\d/, label: 'sleep' },
  { re: /\bThread\.sleep\s*\(/, label: 'Thread.sleep' },
  { re: /\bdelay\s*\(\s*\d+\s*\)/, label: 'delay' },
];

/** A proper wait, which is the correct fix for a race and must not be flagged. */
const PROPER_WAIT =
  /\b(waitFor|waitUntil|waitForElement|findBy|toEventually|wait_for|eventually|poll_until|until\s*\()/i;

const RETRY_CONTEXT = /\b(retry|retries|attempt|backoff|poll)\b/i;

export const nob303: Rule = {
  id: 'NOB-303',
  title: 'Timing band-aid added',
  defaultSeverity: 'low',
  weight: 8,
  requiresAst: false,
  appliesTo: ['test', 'source'],
  rationale:
    'A fixed sleep is the usual workaround for a race condition the author did not understand. It makes the suite slower and still flaky.',
  run(ctx) {
    // A sleep removed anywhere in this file means the change is most likely replacing a
    // sleep with something better -- the spec's own negative fixture. Do not fire.
    const removedASleep = ctx.removedLines.some((l) =>
      SLEEP_PATTERNS.some(({ re }) => re.test(l.text)),
    );
    if (removedASleep) return [];

    const findings = [];
    for (const line of ctx.addedLines) {
      const text = line.text;
      if (isCommentOnly(text)) continue;
      if (PROPER_WAIT.test(text)) continue;

      // In source files, only flag sleeps that sit in an obvious retry loop.
      if (ctx.file.kind !== 'test' && !RETRY_CONTEXT.test(text)) continue;

      for (const { re, label } of SLEEP_PATTERNS) {
        if (!re.test(text)) continue;
        findings.push(
          makeFinding(ctx, {
            line: line.line,
            message: `Timing band-aid added (${label}): \`${text.trim()}\``,
            after: text,
          }),
        );
        break;
      }
    }
    return findings;
  },
};
