import type { Rule } from './types.js';
import { makeFinding, isCommentOnly } from './helpers.js';

/**
 * NOB-302 Broad exception swallow added.
 *
 * Implemented against the after-file text rather than an AST: the body of a catch block is
 * recoverable from indentation and braces reliably enough, and doing it this way means the
 * rule works for every language, including ones Nobble has no grammar for.
 */

const CATCH_OPENERS: { re: RegExp; label: string }[] = [
  { re: /\bcatch\s*(?:\([^)]*\))?\s*\{/, label: 'catch' },
  { re: /\bexcept\b[^:]*:\s*$/, label: 'except' },
  { re: /\brescue\b[^\n]*$/, label: 'rescue' },
];

/** A body made only of these is a swallow, not handling. */
const LOG_ONLY =
  /^\s*(?:\/\/|#|\*)|^\s*(?:console\.\w+|logger?\.\w+|log\.\w+|print|puts|pp|warnings\.warn|System\.out\.\w+)\s*\(|^\s*pass\s*$|^\s*nil\s*$|^\s*null\s*$|^\s*;?\s*$/;

/** Bodies containing any of these are doing real work. */
const REAL_HANDLING =
  /\b(throw|raise|return|reject|exit|abort|process\.exit|res\.status|next\s*\(|Sentry|captureException|reportError|report_error|rollback|retry|fail\b|assert)\b/;

function bodyLines(source: string, openIndex: number, isBrace: boolean): string[] {
  const lines = source.split('\n');
  const out: string[] = [];

  if (isBrace) {
    const openLine = lines[openIndex] ?? '';
    // Start counting at the brace that opens the CATCH body, which is the last `{` on the
    // line. Counting from column 0 breaks on `} catch (e) {`, where the brace closing the
    // try block cancels out the one opening the catch and the body reads as empty.
    const startCol = openLine.lastIndexOf('{');
    if (startCol === -1) return out;

    let depth = 0;
    for (let i = openIndex; i < lines.length && i < openIndex + 40; i++) {
      const line = lines[i]!;
      const from = i === openIndex ? startCol : 0;
      let closedAt = -1;
      for (let c = from; c < line.length; c++) {
        const ch = line[c];
        if (ch === '{') depth++;
        else if (ch === '}') {
          depth--;
          if (depth === 0) {
            closedAt = c;
            break;
          }
        }
      }
      if (i > openIndex) out.push(line);
      else if (closedAt > startCol + 1) {
        // Single-line body: `catch (e) { log(e); }`
        out.push(line.slice(startCol + 1, closedAt));
      }
      if (depth === 0) break;
    }
    // Drop a trailing line that is only the closing brace.
    if (out.length && /^\s*\}/.test(out[out.length - 1]!)) out.pop();
    return out;
  }

  // Indentation-delimited body: python `except:`, ruby `rescue`.
  const openLine = lines[openIndex] ?? '';
  const indent = openLine.length - openLine.trimStart().length;
  for (let i = openIndex + 1; i < lines.length && i < openIndex + 40; i++) {
    const line = lines[i]!;
    if (line.trim() === '') {
      out.push(line);
      continue;
    }
    const lineIndent = line.length - line.trimStart().length;
    if (lineIndent <= indent) break;
    out.push(line);
  }
  return out;
}

export const nob302: Rule = {
  id: 'NOB-302',
  title: 'Broad exception swallow added',
  defaultSeverity: 'medium',
  weight: 15,
  requiresAst: false,
  appliesTo: ['test', 'source'],
  rationale:
    'An empty or log-only catch turns a failure into silence. The code keeps running in a state nobody checked.',
  run(ctx) {
    const after = ctx.after?.source;
    if (!after) return [];
    const afterLines = after.split('\n');
    const findings = [];

    for (const added of ctx.addedLines) {
      const text = added.text;
      if (isCommentOnly(text)) continue;

      const opener = CATCH_OPENERS.find(({ re }) => re.test(text));
      if (!opener) continue;
      // A one-line `rescue Foo => e` that re-raises on the same line is fine.
      if (REAL_HANDLING.test(text.replace(/\brescue\b|\bexcept\b|\bcatch\b/, ''))) continue;

      const idx = added.line - 1;
      if (afterLines[idx]?.trim() !== text.trim()) continue; // line numbers drifted; skip
      const body = bodyLines(after, idx, opener.label === 'catch');

      const meaningful = body.filter((l) => l.trim() !== '');
      const swallowed =
        meaningful.length === 0 ||
        meaningful.every((l) => LOG_ONLY.test(l) && !REAL_HANDLING.test(l));
      if (!swallowed) continue;

      findings.push(
        makeFinding(ctx, {
          line: added.line,
          endLine: added.line + body.length,
          message:
            meaningful.length === 0
              ? `Empty \`${opener.label}\` block added: the error is discarded silently.`
              : `\`${opener.label}\` block added that only logs: the error is swallowed.`,
          after: [text, ...meaningful.slice(0, 2)].join('\n'),
        }),
      );
    }
    return findings;
  },
};
