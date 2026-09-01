import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';
import { diffTestBlocks, fileLostAssertions, pairedSourceDeleted } from './block-matching.js';

/**
 * NOB-103 Whole test block deleted.
 *
 * `diffTestBlocks` already matches renames (exact normalized name first, then edit
 * distance), so a block only lands in `removed` if nothing resembling it survived.
 *
 * Guards: the file itself must not be deleted, its paired source must not be deleted, and
 * the file must have lost assertions overall -- a block that vanished while the file's
 * assertion count held is a restructure, not a deletion.
 */
export const nob103: Rule = {
  id: 'NOB-103',
  title: 'Whole test block deleted',
  defaultSeverity: 'high',
  weight: 25,
  requiresAst: true,
  appliesTo: ['test'],
  rationale:
    'The test is gone rather than fixed. Nothing fails, and the file list shows no deletion, so the loss is invisible in review.',
  run(ctx) {
    if (ctx.degraded) return [];
    if (ctx.file.status === 'deleted') return [];
    if (pairedSourceDeleted(ctx)) return [];

    const diff = diffTestBlocks(ctx);
    if (!diff) return [];
    if (!fileLostAssertions(diff)) return [];

    const findings = [];
    for (const block of diff.removed) {
      // A suite disappearing because every case inside it moved elsewhere is covered by
      // the cases' own findings; reporting the suite too would double-report one edit.
      if (block.kind === 'suite' && diff.removed.some((b) => b.kind === 'case')) continue;

      findings.push(
        makeFinding(ctx, {
          // The block is gone from the after-file, so anchor to where it used to start.
          line: Math.max(1, Math.min(block.startLine, countLines(ctx.after?.source))),
          message: `Test ${block.kind === 'suite' ? 'suite' : 'case'} \`${block.name}\` was deleted.`,
          before: block.node.text.split('\n').slice(0, 3).join('\n'),
        }),
      );
    }
    return findings;
  },
};

function countLines(source: string | undefined): number {
  if (!source) return 1;
  return source.split('\n').length;
}
