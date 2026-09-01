import type { Node, Tree } from './types.js';

/**
 * Plain tree walking rather than tree-sitter queries.
 *
 * Queries would be tidier for one language, but the query dialect and node names differ
 * enough between the TS, Ruby, and Python grammars that three query sets would drift apart.
 * A shared walker keeps the three adapters structurally identical, which is what makes
 * "adding a language touches one file" actually true.
 */

export function walk(node: Node, visit: (n: Node) => void | false): void {
  const stack: Node[] = [node];
  while (stack.length) {
    const current = stack.pop()!;
    // `false` means "do not descend into this node".
    if (visit(current) === false) continue;
    for (let i = current.namedChildCount - 1; i >= 0; i--) {
      const child = current.namedChild(i);
      if (child) stack.push(child);
    }
  }
}

export function collect(root: Node, types: string | string[]): Node[] {
  const wanted = new Set(Array.isArray(types) ? types : [types]);
  const out: Node[] = [];
  walk(root, (n) => {
    if (wanted.has(n.type)) out.push(n);
  });
  return out;
}

export function rootOf(tree: Tree): Node {
  return tree.rootNode;
}

/** 1-based line number, which is what every reporter and every editor uses. */
export function lineOf(node: Node): number {
  return node.startPosition.row + 1;
}

export function endLineOf(node: Node): number {
  return node.endPosition.row + 1;
}

/** Text of a node, collapsed to one line, for messages and evidence. */
export function textOf(node: Node, maxLength = 200): string {
  const text = node.text.replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text;
}

/** Strips quotes from a string literal node's text. */
export function unquote(text: string): string {
  return text.replace(/^['"`]|['"`]$/g, '');
}

/** First string-literal argument of a call, which is the name in every test framework. */
export function firstStringArg(argsNode: Node | null): string | undefined {
  if (!argsNode) return undefined;
  for (let i = 0; i < argsNode.namedChildCount; i++) {
    const child = argsNode.namedChild(i);
    if (!child) continue;
    if (
      child.type === 'string' ||
      child.type === 'template_string' ||
      child.type === 'string_literal'
    ) {
      return unquote(child.text);
    }
  }
  return undefined;
}

/** Named arguments of a call node as source text, for matcher-argument comparison. */
export function argTexts(argsNode: Node | null): string[] {
  if (!argsNode) return [];
  const out: string[] = [];
  for (let i = 0; i < argsNode.namedChildCount; i++) {
    const child = argsNode.namedChild(i);
    if (child) out.push(textOf(child, 80));
  }
  return out;
}

/** Nearest enclosing node of one of the given types, or undefined. */
export function ancestorOfType(node: Node, types: string[]): Node | undefined {
  const wanted = new Set(types);
  let current: Node | null = node.parent;
  while (current) {
    if (wanted.has(current.type)) return current;
    current = current.parent;
  }
  return undefined;
}
