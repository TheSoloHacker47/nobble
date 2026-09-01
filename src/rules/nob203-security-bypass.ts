import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';
import type { Node } from '../parsers/types.js';

/**
 * NOB-203 Early return or bypass added in a security path.
 *
 * "At the top of a function body" is the whole rule -- a `return true` at the end of an
 * authorization function is the normal way to write one, while the same line as the FIRST
 * statement short-circuits every check below it. This is why the adapter grew
 * `findFunctions` (DECISIONS.md A3): without function bodies the two are indistinguishable.
 */

/** An exit that hands back success unconditionally. */
const UNCONDITIONAL_EXIT =
  /^\s*(?:return\s+(?:true|next\s*\(\s*\)|null|nil|None|\{\s*\}|_?next\(\))\s*;?|return\s*;?|pass|head\s+:ok|next\s*\(\s*\)\s*;?)\s*$/;

/** A check disabled by construction rather than removed. */
const DISABLED_GUARD: { re: RegExp; label: string }[] = [
  { re: /\bif\s*\(\s*(?:false|0)\s*\)/, label: 'if (false)' },
  { re: /\bif\s+False\s*:/, label: 'if False:' },
  { re: /\bif\s+false\b/, label: 'if false' },
  {
    re: /\b(?:FEATURE_\w+|flags?\.\w+|isEnabled\w*)\s*=\s*true\b/i,
    label: 'feature flag forced on',
  },
];

/** Statements at the very start of a body, ignoring comments. */
function leadingStatements(body: Node | null, limit = 2): Node[] {
  if (!body) return [];
  const out: Node[] = [];
  for (let i = 0; i < body.namedChildCount && out.length < limit; i++) {
    const child = body.namedChild(i);
    if (!child) continue;
    if (child.type.includes('comment')) continue;
    out.push(child);
  }
  return out;
}

export const nob203: Rule = {
  id: 'NOB-203',
  title: 'Early return or bypass added in a security path',
  defaultSeverity: 'high',
  weight: 25,
  requiresAst: true,
  appliesTo: ['source'],
  rationale:
    'An unconditional exit at the top of a function short-circuits every check below it, so the security logic still exists but never runs.',
  run(ctx) {
    if (!ctx.file.isSecurityPath) return [];
    const tree = ctx.after?.tree;
    const adapter = ctx.after?.adapter;
    if (!tree || !adapter) return [];
    if (ctx.addedLines.length === 0) return [];

    const addedByLine = new Map(ctx.addedLines.map((l) => [l.line, l.text]));
    const findings = [];
    const reported = new Set<number>();

    for (const fn of adapter.findFunctions(tree)) {
      for (const statement of leadingStatements(fn.bodyNode)) {
        const line = statement.startPosition.row + 1;
        const added = addedByLine.get(line);
        // Only fire on lines this diff actually introduced.
        if (added === undefined) continue;
        if (reported.has(line)) continue;

        const text = statement.text.trim();
        if (UNCONDITIONAL_EXIT.test(text)) {
          reported.add(line);
          findings.push(
            makeFinding(ctx, {
              line,
              message: `Unconditional early exit added at the top of \`${fn.name}\`: \`${text.replace(/\s+/g, ' ')}\`.`,
              after: added,
            }),
          );
        }
      }
    }

    // A guard disabled by construction can appear anywhere in the function, not just at
    // the top, so it is matched line-wise rather than against leading statements.
    for (const line of ctx.addedLines) {
      if (reported.has(line.line)) continue;
      const guard = DISABLED_GUARD.find(({ re }) => re.test(line.text));
      if (!guard) continue;
      reported.add(line.line);
      findings.push(
        makeFinding(ctx, {
          line: line.line,
          message: `Security check disabled by construction (${guard.label}): \`${line.text.trim()}\`.`,
          after: line.text,
        }),
      );
    }

    return findings;
  },
};
