import type { Rule } from './types.js';
import { makeFinding, isCommentOnly } from './helpers.js';

/**
 * NOB-301 Type or lint suppression added.
 *
 * Fires once per file, not per occurrence (spec §6). A refactor that adds eight
 * `@ts-expect-error`s is one decision, not eight, and reporting it eight times would
 * crowd out more serious findings under the 20-item cap.
 */

/**
 * Directives that legitimately live inside comments -- that is where they belong, so a
 * comment-only line is exactly where we expect to find them.
 */
const COMMENT_DIRECTIVES: { re: RegExp; label: string }[] = [
  { re: /@ts-ignore\b/, label: '@ts-ignore' },
  { re: /@ts-expect-error\b/, label: '@ts-expect-error' },
  { re: /@ts-nocheck\b/, label: '@ts-nocheck' },
  { re: /eslint-disable(?:-next-line|-line)?\b/, label: 'eslint-disable' },
  { re: /\brubocop:disable\b/, label: 'rubocop:disable' },
  { re: /#\s*type:\s*ignore\b/, label: '# type: ignore' },
  { re: /#\s*noqa\b/, label: '# noqa' },
  { re: /#pragma\s+warning\s+disable\b/, label: '#pragma warning disable' },
  { re: /\bnolint\b/, label: 'nolint' },
];

/**
 * Suppressions that name the specific thing they silence.
 *
 * `# type: ignore[return-value]` suppresses one identified error; `# type: ignore`
 * silences every present and future error on that line. The same split applies to
 * `# noqa: F821`, `eslint-disable-next-line no-shadow`, and `rubocop:disable Style/Foo`.
 * Only the blanket form is the escape hatch this rule is about.
 *
 * This distinction was added after the §11.5 smoke test: NOB-301 accounted for 12 of the
 * 16 findings across 150 real PRs, and every one of those was a narrow, coded suppression
 * in ordinary typed-Python or lint work. See DECISIONS.md A8 for the measured effect.
 */
// The examples are spelled with a placeholder rather than verbatim, because ESLint parses
// a real `eslint-disable-next-line <rule>` in a comment as an actual directive -- including
// one written here only to document what this rule matches.
const TARGETED_SUPPRESSION = [
  /#\s*type:\s*ignore\[[^\]]+\]/, //             "# type: ignore[return-value]"
  /#\s*noqa\s*:\s*\w+/, //                        "# noqa: F821"
  /eslint-disable(?:-next-line|-line)?\s+[\w@/-]+/, // "eslint-disable-next-line <rule>"
  /rubocop:disable\s+[\w/]+/, //                   "rubocop:disable Style/Documentation"
  /nolint:\w+/, //                                 "nolint:errcheck"
];

function isTargeted(text: string): boolean {
  return TARGETED_SUPPRESSION.some((re) => re.test(text));
}

/**
 * Casts, which are code. These must NOT match a comment: prose like
 * "works for as many rows as any caller needs" contains a literal `as any`.
 */
const CODE_SUPPRESSIONS: { re: RegExp; label: string }[] = [
  { re: /\bas\s+any\b/, label: 'as any' },
  { re: /\bas\s+unknown\s+as\b/, label: 'as unknown as' },
];

/** `: any` only counts on a line that actually declares something. */
const COLON_ANY = /:\s*any\b/;

export const nob301: Rule = {
  id: 'NOB-301',
  title: 'Type or lint suppression added',
  defaultSeverity: 'medium',
  weight: 10,
  requiresAst: false,
  appliesTo: ['test', 'source'],
  rationale:
    'Silencing the type checker or linter removes the signal that something is wrong, rather than addressing it.',
  run(ctx) {
    for (const line of ctx.addedLines) {
      const text = line.text;

      for (const { re, label } of COMMENT_DIRECTIVES) {
        if (!re.test(text)) continue;
        // A suppression that names what it silences is a narrow, reviewable decision.
        // Only the blanket form is the escape hatch.
        if (isTargeted(text)) break;
        return [
          makeFinding(ctx, {
            line: line.line,
            message: `Blanket suppression added (${label}): \`${text.trim()}\``,
            after: text,
          }),
        ];
      }

      // Everything below is code, so a comment-only line cannot contain it.
      if (isCommentOnly(text)) continue;

      for (const { re, label } of CODE_SUPPRESSIONS) {
        if (!re.test(text)) continue;
        return [
          makeFinding(ctx, {
            line: line.line,
            message: `Suppression added (${label}): \`${text.trim()}\``,
            after: text,
          }),
        ];
      }

      if (
        COLON_ANY.test(text) &&
        /\b(let|const|var|function|readonly|private|public|\()/.test(text)
      ) {
        return [
          makeFinding(ctx, {
            line: line.line,
            message: `Suppression added (\`: any\` annotation): \`${text.trim()}\``,
            after: text,
          }),
        ];
      }
    }
    return [];
  },
};
