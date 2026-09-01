import type { TestBlock, Assertion, LanguageAdapter } from '../parsers/types.js';
import type { RuleContext } from './types.js';

/**
 * Shared machinery for the four assertion-tampering rules (NOB-101, 102, 103, 105).
 *
 * All four ask the same underlying question -- "what happened to this specific test block
 * between before and after?" -- so they share one matching pass rather than each inventing
 * its own notion of block identity and disagreeing at the edges.
 */

export interface MatchedBlock {
  before: TestBlock;
  after: TestBlock;
  beforeAssertions: Assertion[];
  afterAssertions: Assertion[];
}

export interface BlockDiff {
  /** Blocks present on both sides, matched by normalized name. */
  matched: MatchedBlock[];
  /** Blocks present before and gone after, with no similarly-named replacement. */
  removed: TestBlock[];
  /**
   * Before-blocks with more than one plausible successor -- almost always a test that was
   * split in two. No rule fires on these: guessing which half is "the" successor produces
   * a confident, wrong finding, which is worse than staying quiet.
   */
  ambiguous: TestBlock[];
  added: TestBlock[];
  beforeAdapter: LanguageAdapter;
  afterAdapter: LanguageAdapter;
  /** Total assertions in the whole file, each side. The key NOB-101 guard. */
  totalBefore: number;
  totalAfter: number;
}

/**
 * Levenshtein distance, capped -- used only to tell "renamed" from "deleted", so an exact
 * distance beyond a few edits is not worth computing.
 */
function editDistance(a: string, b: string, cap = 8): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      curr[j] = Math.min(
        prev[j]! + 1,
        curr[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = curr;
    if (Math.min(...curr) > cap) return cap + 1;
  }
  return prev[b.length]!;
}

/**
 * Two names are "the same test, renamed" if they are close relative to their length.
 *
 * Containment alone is not enough. In a file with `test_foo`, `test_foo_disable`, and
 * `test_foo_enable`, a bare `a.includes(b)` makes `test_foo` a rename of BOTH, and the
 * greedy matcher pairs it with whichever it reaches first -- producing findings like
 * "10 assertions removed (11 -> 1)" from what was actually a test being split in two.
 * Containment therefore also has to be substantial.
 */
export function isRename(a: string, b: string): boolean {
  if (a === b) return true;
  const longer = Math.max(a.length, b.length);
  const shorter = Math.min(a.length, b.length);
  if (longer === 0) return true;
  if ((a.includes(b) || b.includes(a)) && shorter >= longer * 0.6) return true;
  const threshold = Math.max(2, Math.floor(longer * 0.34));
  return editDistance(a, b, threshold + 1) <= threshold;
}

/**
 * Only assertions belonging directly to a block, not to its nested children. Without this
 * a `describe` would be credited with every assertion in the file and the counts would
 * double-count at every nesting level.
 */
function ownAssertions(
  block: TestBlock,
  blocks: TestBlock[],
  adapter: LanguageAdapter,
): Assertion[] {
  const all = adapter.findAssertions(block.node);
  const nested = blocks.filter(
    (b) =>
      b !== block &&
      b.node.startIndex >= block.node.startIndex &&
      b.node.endIndex <= block.node.endIndex,
  );
  if (nested.length === 0) return all;
  return all.filter(
    (a) =>
      !nested.some(
        (n) => a.node.startIndex >= n.node.startIndex && a.node.endIndex <= n.node.endIndex,
      ),
  );
}

/** Returns undefined when either side is unavailable -- the caller must then not fire. */
export function diffTestBlocks(ctx: RuleContext): BlockDiff | undefined {
  const beforeAdapter = ctx.before?.adapter;
  const afterAdapter = ctx.after?.adapter;
  const beforeTree = ctx.before?.tree;
  const afterTree = ctx.after?.tree;
  if (!beforeAdapter || !afterAdapter || !beforeTree || !afterTree) return undefined;

  const beforeBlocks = beforeAdapter.findTestBlocks(beforeTree);
  const afterBlocks = afterAdapter.findTestBlocks(afterTree);

  const matched: MatchedBlock[] = [];
  const removed: TestBlock[] = [];
  const ambiguous: TestBlock[] = [];
  const usedAfter = new Set<TestBlock>();

  for (const before of beforeBlocks) {
    // Exact normalized-name match first, then a rename-tolerant pass. Doing exact first
    // stops a near-miss from stealing the match from an exact one.
    let after = afterBlocks.find(
      (b) =>
        !usedAfter.has(b) && b.kind === before.kind && b.normalizedName === before.normalizedName,
    );
    if (!after) {
      const candidates = afterBlocks.filter(
        (b) =>
          !usedAfter.has(b) &&
          b.kind === before.kind &&
          isRename(before.normalizedName, b.normalizedName),
      );
      // More than one plausible successor means the test was split, not renamed. Picking
      // one would be a guess, and a guess here reads as a confident finding.
      if (candidates.length > 1) {
        ambiguous.push(before);
        for (const c of candidates) usedAfter.add(c);
        continue;
      }
      after = candidates[0];
    }
    if (!after) {
      removed.push(before);
      continue;
    }
    usedAfter.add(after);
    matched.push({
      before,
      after,
      beforeAssertions: ownAssertions(before, beforeBlocks, beforeAdapter),
      afterAssertions: ownAssertions(after, afterBlocks, afterAdapter),
    });
  }

  return {
    matched,
    removed,
    ambiguous,
    added: afterBlocks.filter((b) => !usedAfter.has(b)),
    beforeAdapter,
    afterAdapter,
    totalBefore: beforeAdapter.findAssertions(beforeTree.rootNode).length,
    totalAfter: afterAdapter.findAssertions(afterTree.rootNode).length,
  };
}

/**
 * The guard that carries most of the false-positive load for NOB-101 and NOB-103.
 *
 * A test file whose total assertion count did not drop is being restructured, not gutted:
 * a test split in two, a Mocha suite ported to Jest, assertions moved into a helper. All
 * of those move assertions between blocks, so per-block counts fall while the file total
 * holds. Requiring the file total to drop as well removes that entire class of noise.
 */
export function fileLostAssertions(diff: BlockDiff): boolean {
  return diff.totalAfter < diff.totalBefore;
}

/**
 * True when the file's own source was deleted alongside it -- deleting a feature and its
 * tests together is correct, not tampering. Spec §11.2's third mandatory negative.
 */
export function pairedSourceDeleted(ctx: RuleContext): boolean {
  return ctx.allFiles.some(
    (f) => f.status === 'deleted' && f.kind === 'source' && sharesBasename(f.path, ctx.file.path),
  );
}

function sharesBasename(sourcePath: string, testPath: string): boolean {
  const base = (p: string) =>
    (p.split('/').pop() ?? '')
      .replace(/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|py|rb|go)$/, '')
      .replace(/^test_/, '')
      .replace(/[._-](test|spec)$/, '')
      .toLowerCase();
  const b = base(sourcePath);
  return b.length > 2 && b === base(testPath);
}
