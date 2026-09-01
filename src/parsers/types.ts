import type { Node, Tree } from 'web-tree-sitter';

export type { Node, Tree };

/** A named test block: `it(...)`, `describe(...)`, `def test_x`, RSpec `it "..." do`. */
export interface TestBlock {
  /** Raw name as written, e.g. "charges the card". */
  name: string;
  /** Lowercased, punctuation/whitespace stripped. Used to match across before/after. */
  normalizedName: string;
  kind: 'suite' | 'case';
  node: Node;
  startLine: number;
  endLine: number;
}

export interface Assertion {
  node: Node;
  startLine: number;
  /** The matcher/method that decides strength: `toBe`, `eq`, `assertEqual`, `assert`. */
  matcher: string;
  /** Source text of the whole assertion, trimmed. */
  text: string;
  /** `.not`, `not_to`, `assertNotEqual`, `refute`. Drives NOB-105. */
  isNegated: boolean;
  /** Argument source texts, used to spot exact-value -> `any`/`anything` weakening. */
  args: string[];
}

export interface Mock {
  node: Node;
  startLine: number;
  /** What is being mocked: module path, receiver, or attribute. Matched against NOB-201 symbols. */
  target: string;
  /** The construct used, e.g. `jest.mock`, `allow(...).to receive`, `patch`. */
  construct: string;
  text: string;
}

/** Needed by NOB-203, which asks "is this early return at the top of a function body?". */
export interface FunctionBlock {
  name: string;
  node: Node;
  bodyNode: Node | null;
  startLine: number;
  endLine: number;
}

export interface LanguageAdapter {
  id: string;
  extensions: string[];
  parse(source: string): Tree;
  findTestBlocks(tree: Tree): TestBlock[];
  /** Assertions inside `node`. Pass a test block's node to scope it, or the root for the file. */
  findAssertions(node: Node): Assertion[];
  findMocks(tree: Tree): Mock[];
  findFunctions(tree: Tree): FunctionBlock[];
  /** Higher is stronger. Used by NOB-102 to detect a strictly weaker replacement. */
  assertionStrength(a: Assertion): number;
}

/** Normalizes a test name so renames and reformatting do not look like deletions. */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}
