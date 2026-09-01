import type {
  LanguageAdapter,
  TestBlock,
  Assertion,
  Mock,
  FunctionBlock,
  Node,
  Tree,
} from './types.js';
import { normalizeName } from './types.js';
import { walk, lineOf, endLineOf, textOf, firstStringArg, argTexts } from './walk.js';

/**
 * JavaScript / TypeScript / TSX adapter, covering Jest, Vitest, Mocha, and Chai.
 *
 * The parser is injected rather than imported so this file stays synchronous and testable;
 * `parsers/index.ts` supplies a Parser already bound to the right grammar.
 */

const SUITE_NAMES = new Set(['describe', 'context', 'suite', 'xdescribe', 'fdescribe']);
const CASE_NAMES = new Set(['it', 'test', 'specify', 'xit', 'xtest', 'fit', 'bench']);

/** Chain links that modify an assertion rather than being the matcher itself. */
const CHAIN_MODIFIERS = new Set([
  'not',
  'resolves',
  'rejects',
  'to',
  'be',
  'been',
  'have',
  'has',
  'that',
  'which',
  'with',
  'and',
  'is',
  'a',
  'an',
  'does',
  'deep',
  'own',
  'nested',
  'ordered',
  'any',
  'all',
  'first',
  'second',
  'lastCalledWith',
]);

const NEGATION_LINKS = new Set(['not', 'rejects', 'never']);

/**
 * Assertion strength. Higher is stronger, and only the ORDER matters -- NOB-102 fires when
 * a matcher is replaced by one with a strictly lower number.
 *
 * The scale reflects how much a matcher actually constrains the value: an exact comparison
 * pins it down completely, a type check admits infinitely many values, and a truthiness
 * check admits almost anything.
 */
const STRENGTH: Record<string, number> = {
  // Exact value or structure: strongest.
  toBe: 100,
  toEqual: 100,
  toStrictEqual: 110,
  toMatchObject: 90,
  toMatchInlineSnapshot: 90,
  toMatchSnapshot: 85,
  toHaveBeenCalledWith: 100,
  toHaveBeenNthCalledWith: 100,
  toHaveBeenLastCalledWith: 100,
  toHaveBeenCalledTimes: 90,
  toHaveLength: 90,
  toHaveProperty: 85,
  toContainEqual: 85,
  toContain: 80,
  toThrowError: 80,
  toThrow: 75,
  toMatch: 80,
  toBeCloseTo: 85,
  toBeGreaterThan: 70,
  toBeLessThan: 70,
  // Chai / Mocha equivalents.
  equal: 100,
  equals: 100,
  eql: 100,
  deepEqual: 100,
  strictEqual: 110,
  notStrictEqual: 60,
  include: 80,
  match: 80,
  // Weak: type or existence checks only.
  toBeInstanceOf: 50,
  toBeTypeOf: 45,
  instanceOf: 50,
  toHaveBeenCalled: 40,
  toBeCalled: 40,
  toBeDefined: 30,
  toBeUndefined: 30,
  toBeNull: 30,
  toBeNaN: 30,
  exist: 30,
  ok: 25,
  toBeTruthy: 20,
  toBeFalsy: 20,
  true: 20,
  false: 20,
  // Weakest: asserts nothing about the value at all.
  toBeAnything: 5,
};

const DEFAULT_STRENGTH = 60;

/** Matcher arguments that throw away the exact value even when the matcher is strong. */
const LOOSE_ARG =
  /\b(expect\.(any|anything)|any\(|anything\(|expect\.objectContaining|expect\.arrayContaining|expect\.stringContaining|expect\.stringMatching)/;

const MOCK_CONSTRUCTS: { object: string; method: string }[] = [
  { object: 'jest', method: 'mock' },
  { object: 'jest', method: 'doMock' },
  { object: 'jest', method: 'spyOn' },
  { object: 'jest', method: 'replaceProperty' },
  { object: 'vi', method: 'mock' },
  { object: 'vi', method: 'doMock' },
  { object: 'vi', method: 'spyOn' },
  { object: 'vi', method: 'stubGlobal' },
  { object: 'sinon', method: 'stub' },
  { object: 'sinon', method: 'spy' },
  { object: 'sinon', method: 'mock' },
  { object: 'sinon', method: 'replace' },
  { object: 'td', method: 'replace' },
];

const FUNCTION_TYPES = [
  'function_declaration',
  'function_expression',
  'generator_function_declaration',
  'arrow_function',
  'method_definition',
];

/** Resolves `a.b.c` into its dotted text, or undefined for anything else. */
function memberChain(node: Node): string[] | undefined {
  const parts: string[] = [];
  let current: Node | null = node;
  while (current) {
    if (current.type === 'member_expression') {
      const prop = current.childForFieldName('property');
      if (!prop) return undefined;
      parts.unshift(prop.text);
      current = current.childForFieldName('object');
    } else if (current.type === 'identifier') {
      parts.unshift(current.text);
      return parts;
    } else if (current.type === 'call_expression') {
      // e.g. `expect(x).not.toBe` -- the chain is rooted at a call, not an identifier.
      const fn = current.childForFieldName('function');
      if (fn?.type === 'identifier') {
        parts.unshift(`${fn.text}()`);
        return parts;
      }
      return parts.length ? parts : undefined;
    } else {
      return parts.length ? parts : undefined;
    }
  }
  return undefined;
}

function calleeName(call: Node): string | undefined {
  const fn = call.childForFieldName('function');
  if (!fn) return undefined;
  if (fn.type === 'identifier') return fn.text;
  if (fn.type === 'member_expression') {
    const chain = memberChain(fn);
    return chain?.join('.');
  }
  return undefined;
}

/** `it.skip('x')` and `it.each([...])('x')` both have `it` as the base. */
function baseCallee(name: string | undefined): string | undefined {
  return name?.split('.')[0]?.replace(/\(\)$/, '');
}

export function createTypeScriptAdapter(
  id: string,
  extensions: string[],
  parse: (source: string) => Tree,
): LanguageAdapter {
  const adapter: LanguageAdapter = {
    id,
    extensions,
    parse,

    findTestBlocks(tree: Tree): TestBlock[] {
      const out: TestBlock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type !== 'call_expression') return;
        let name = calleeName(node);
        const args = node.childForFieldName('arguments');

        // `it.each([...])('name', fn)` -- the outer call holds the name, the inner the base.
        if (!name) {
          const fn = node.childForFieldName('function');
          if (fn?.type === 'call_expression') name = calleeName(fn);
        }
        const base = baseCallee(name);
        if (!base) return;

        const isSuite = SUITE_NAMES.has(base);
        const isCase = CASE_NAMES.has(base);
        if (!isSuite && !isCase) return;

        const title = firstStringArg(args);
        // A dynamic title (a bare variable, or a template with only expressions) marks a
        // real block, but it cannot be matched across before/after. Skipping it is better
        // than matching every dynamic block to every other one.
        if (title === undefined) return;
        out.push({
          name: title,
          normalizedName: normalizeName(title),
          kind: isSuite ? 'suite' : 'case',
          node,
          startLine: lineOf(node),
          endLine: endLineOf(node),
        });
      });
      return out;
    },

    findAssertions(node: Node): Assertion[] {
      const out: Assertion[] = [];
      walk(node, (n) => {
        if (n.type !== 'call_expression') return;
        const fn = n.childForFieldName('function');
        if (!fn) return;

        // Shape 1: expect(x).chain.matcher(args)
        if (fn.type === 'member_expression') {
          const chain = memberChain(fn);
          if (!chain || chain.length < 2) return;
          const root = chain[0]!;
          const links = chain.slice(1);
          // `expect(x).toBe(y)` roots the chain at a CALL, so memberChain reports
          // `expect()`. A bare `expect` root means `expect.any(Number)` and friends, which
          // are matcher HELPERS passed as arguments, not assertions. Counting those as
          // assertions inflates the per-block count and stops NOB-102 aligning positions.
          const isExpect = root === 'expect()';
          const isAssert = root === 'assert' || root === 'chai' || root === 'should';
          const isShould = links.includes('should');
          if (!isExpect && !isAssert && !isShould) return;

          const matcher =
            [...links].reverse().find((l) => !CHAIN_MODIFIERS.has(l)) ?? links[links.length - 1]!;
          const args = n.childForFieldName('arguments');
          out.push({
            node: n,
            startLine: lineOf(n),
            matcher,
            text: textOf(n),
            isNegated:
              links.some((l) => NEGATION_LINKS.has(l)) ||
              /^(refute|notStrictEqual|notEqual|notDeepEqual)$/.test(matcher),
            args: argTexts(args),
          });
          return;
        }

        // Shape 2: assert(x) as a bare call.
        if (fn.type === 'identifier' && fn.text === 'assert') {
          out.push({
            node: n,
            startLine: lineOf(n),
            matcher: 'assert',
            text: textOf(n),
            isNegated: false,
            args: argTexts(n.childForFieldName('arguments')),
          });
        }
      });
      return out;
    },

    findMocks(tree: Tree): Mock[] {
      const out: Mock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type !== 'call_expression') return;
        const fn = node.childForFieldName('function');
        if (fn?.type !== 'member_expression') return;
        const chain = memberChain(fn);
        if (!chain || chain.length < 2) return;
        const object = chain[0]!;
        const method = chain[chain.length - 1]!;
        const construct = MOCK_CONSTRUCTS.find((c) => c.object === object && c.method === method);
        if (!construct) return;

        const args = node.childForFieldName('arguments');
        const texts = argTexts(args);

        // Two shapes, distinguished by the first argument rather than by method name:
        //   jest.mock('../auth/session')      -- a module path, one string argument
        //   sinon.stub(billing, 'charge')     -- a receiver and a method name
        // Keying off the method name misses `sinon.stub`/`sinon.spy`/`vi.spyOn`, which all
        // take the second shape, and the receiver is the part that matters for NOB-201.
        const firstArg = args?.namedChild(0);
        const receiverStyle =
          texts.length >= 2 &&
          firstArg !== null &&
          firstArg?.type !== 'string' &&
          firstArg?.type !== 'template_string';
        const target = receiverStyle
          ? texts
              .slice(0, 2)
              .map((t) => t.replace(/^['"`]|['"`]$/g, ''))
              .join('.')
          : (firstStringArg(args) ?? texts[0] ?? '');

        out.push({
          node,
          startLine: lineOf(node),
          target,
          construct: `${object}.${method}`,
          text: textOf(node),
        });
      });
      return out;
    },

    findFunctions(tree: Tree): FunctionBlock[] {
      const out: FunctionBlock[] = [];
      walk(tree.rootNode, (node) => {
        if (!FUNCTION_TYPES.includes(node.type)) return;
        const nameNode = node.childForFieldName('name');
        out.push({
          name: nameNode?.text ?? '<anonymous>',
          node,
          bodyNode: node.childForFieldName('body'),
          startLine: lineOf(node),
          endLine: endLineOf(node),
        });
      });
      return out;
    },

    assertionStrength(a: Assertion): number {
      const base = STRENGTH[a.matcher] ?? DEFAULT_STRENGTH;
      // An exact matcher fed `expect.any(...)` is not an exact assertion any more.
      if (base >= 80 && a.args.some((arg) => LOOSE_ARG.test(arg))) return 45;
      return base;
    },
  };
  return adapter;
}

export { STRENGTH as TS_STRENGTH };
