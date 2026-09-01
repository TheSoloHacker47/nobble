import parseDiff from 'parse-diff';
import type { Line } from '../types.js';

export type ChangeStatus = 'added' | 'deleted' | 'modified' | 'renamed';

export interface ParsedFile {
  /** Path in the after-tree. For deletions this is the old path. */
  path: string;
  /** Path in the before-tree, differs from `path` only for renames. */
  oldPath: string;
  status: ChangeStatus;
  addedLines: Line[];
  removedLines: Line[];
  additions: number;
  deletions: number;
}

/** parse-diff reports absent sides as the literal string "/dev/null". */
function clean(p: string | undefined): string | undefined {
  if (!p || p === '/dev/null') return undefined;
  return p.replace(/^[ab]\//, '');
}

export function parseUnifiedDiff(diffText: string): ParsedFile[] {
  const files = parseDiff(diffText);
  const out: ParsedFile[] = [];

  for (const f of files) {
    const from = clean(f.from);
    const to = clean(f.to);
    const path = to ?? from;
    if (!path) continue; // no usable path on either side

    let status: ChangeStatus;
    if (f.new || !from) status = 'added';
    else if (f.deleted || !to) status = 'deleted';
    else if (from !== to) status = 'renamed';
    else status = 'modified';

    const addedLines: Line[] = [];
    const removedLines: Line[] = [];
    for (const chunk of f.chunks) {
      for (const change of chunk.changes) {
        // parse-diff keeps the leading +/- in `content`.
        const text = change.content.slice(1);
        if (change.type === 'add') addedLines.push({ line: change.ln, text });
        else if (change.type === 'del') removedLines.push({ line: change.ln, text });
      }
    }

    out.push({
      path,
      oldPath: from ?? path,
      status,
      addedLines,
      removedLines,
      additions: f.additions,
      deletions: f.deletions,
    });
  }
  return out;
}
