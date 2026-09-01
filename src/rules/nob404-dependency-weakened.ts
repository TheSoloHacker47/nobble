import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';

/**
 * NOB-404 Dependency pinned down or integrity check removed.
 *
 * Two distinct shapes:
 *  - a lockfile integrity/resolved field removed, which disables tamper detection
 *  - a dependency downgraded across a major version, which is how an agent "fixes" a
 *    failure caused by a breaking change it does not want to adapt to
 */

const INTEGRITY_FIELD = /^\s*"?(integrity|resolved|checksum)"?\s*[:=]/;

/** `"name": "^1.2.3"` in package.json, or `name = "1.2.3"` in a manifest. */
const DEP_LINE = /^\s*"?([@\w][\w./-]*)"?\s*[:=]\s*"?([\^~>=<]*\s*v?)(\d+)\.(\d+)\.(\d+)/;

export const nob404: Rule = {
  id: 'NOB-404',
  title: 'Dependency pinned down or integrity check removed',
  defaultSeverity: 'medium',
  weight: 15,
  requiresAst: false,
  appliesTo: ['coverage_config', 'other', 'source'],
  rationale:
    'Removing an integrity hash disables tamper detection. Downgrading a major version avoids adapting to a breaking change rather than handling it.',
  run(ctx) {
    const name = ctx.file.path.split('/').pop() ?? '';
    const isLockfile =
      /^(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|Gemfile\.lock|poetry\.lock|Cargo\.lock)$/.test(
        name,
      );
    const isManifest =
      /^(package\.json|Gemfile|pyproject\.toml|requirements\.txt|Cargo\.toml)$/.test(name);
    if (!isLockfile && !isManifest) return [];

    const findings = [];

    if (isLockfile) {
      const addedIntegrity = ctx.addedLines.filter((l) => INTEGRITY_FIELD.test(l.text)).length;
      const removedIntegrity = ctx.removedLines.filter((l) => INTEGRITY_FIELD.test(l.text));
      // A net loss of integrity fields. An equal swap is a normal dependency bump.
      if (removedIntegrity.length > addedIntegrity) {
        const first = removedIntegrity[0]!;
        findings.push(
          makeFinding(ctx, {
            line: ctx.addedLines[0]?.line ?? 1,
            message: `${removedIntegrity.length - addedIntegrity} integrity field(s) removed from ${name} without replacement.`,
            before: first.text,
          }),
        );
      }
    }

    if (isManifest) {
      const versions = (lines: { line: number; text: string }[]) => {
        const m = new Map<string, { major: number; line: number; text: string }>();
        for (const l of lines) {
          const match = DEP_LINE.exec(l.text);
          if (!match) continue;
          m.set(match[1]!, { major: Number(match[3]), line: l.line, text: l.text });
        }
        return m;
      };
      const before = versions(ctx.removedLines);
      const after = versions(ctx.addedLines);
      for (const [dep, a] of after) {
        const b = before.get(dep);
        if (!b || a.major >= b.major) continue;
        findings.push(
          makeFinding(ctx, {
            line: a.line,
            message: `Dependency \`${dep}\` downgraded from major ${b.major} to ${a.major}.`,
            before: b.text,
            after: a.text,
          }),
        );
      }
    }

    return findings;
  },
};
