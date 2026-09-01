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
import { walk, lineOf, endLineOf, textOf, argTexts } from './walk.js';

/**
 * Python adapter, covering pytest and unittest.
 *
 * Python has no `it("name")` construct: a test block is a `def test_*` function or a
 * `class Test*`. The block's identity is therefore its function name rather than a string
 * literal, so `normalizeName` runs over the identifier instead.
 */

const TEST_FUNCTION = /^test_?/i;
const TEST_CLASS = /^Test/;

const STRENGTH: Record<string, number> = {
  // Exact value or structure.
  assertEqual: 100,
  assertEquals: 100,
  assertIs: 110,
  assertDictEqual: 100,
  assertListEqual: 100,
  assertSetEqual: 100,
  assertTupleEqual: 100,
  assertMultiLineEqual: 100,
  assertSequenceEqual: 100,
  assertCountEqual: 90,
  assertRaises: 80,
  assertRaisesRegex: 90,
  assertRegex: 80,
  assertIn: 80,
  assertAlmostEqual: 85,
  assert_called_once_with: 100,
  assert_called_with: 100,
  assert_has_calls: 90,
  // A bare `assert` carries whatever the expression says; treat a comparison as strong
  // and a bare truthiness check as weak (resolved in `assertionStrength`).
  assert: 90,
  // Weak: type or existence only.
  assertIsInstance: 50,
  assertIsNotNone: 25,
  assertIsNone: 30,
  assertTrue: 20,
  assertFalse: 20,
  assertNotEqual: 60,
  assert_called: 40,
  assert_called_once: 45,
  assertGreater: 70,
  assertLess: 70,
};

const DEFAULT_STRENGTH = 60;

const LOOSE_ARG = /\b(mock\.ANY|ANY|unittest\.mock\.ANY|pytest\.approx)\b/;

/** unittest assertion methods, called on `self`. */
const UNITTEST_ASSERTION = /^assert[A-Z_]/;
/** mock assertion methods, called on a mock object. */
const MOCK_ASSERTION = /^assert_(called|not_called|has_calls|any_call)/;

const NEGATED = /^(assertNot|assertIsNot|assertFalse|assertNotIn|assertIsNone)/;

/**
 * Strips the negation out of a method name so the matcher describes WHAT is compared and
 * `isNegated` carries whether it is inverted.
 *
 * Without this, `assertEqual` -> `assertNotEqual` reads to NOB-102 as a matcher swapped for
 * a weaker one, and NOB-105 -- whose job an inversion actually is -- never sees it. RSpec
 * gets this for free because negation is a separate verb (`to` vs `not_to`); Python and
 * Minitest bake it into the name, so the adapter has to undo that.
 */
function denegate(method: string): string {
  return method
    .replace(/^assertNotEqual$/, 'assertEqual')
    .replace(/^assertNotIn$/, 'assertIn')
    .replace(/^assertIsNot$/, 'assertIs')
    .replace(/^assertIsNone$/, 'assertIsNotNone')
    .replace(/^assertFalse$/, 'assertTrue')
    .replace(/^assert_not_called$/, 'assert_called');
}

const MOCK_CONSTRUCTS: { object: string; method: string }[] = [
  { object: 'mock', method: 'patch' },
  { object: 'unittest', method: 'patch' },
  { object: 'monkeypatch', method: 'setattr' },
  { object: 'monkeypatch', method: 'setitem' },
  { object: 'mocker', method: 'patch' },
];

function attributeParts(node: Node): string[] | undefined {
  // `a.b.c` is nested `attribute` nodes.
  if (node.type === 'identifier') return [node.text];
  if (node.type !== 'attribute') return undefined;
  const object = node.childForFieldName('object');
  const attr = node.childForFieldName('attribute');
  if (!object || !attr) return undefined;
  const head = attributeParts(object);
  if (!head) return [attr.text];
  return [...head, attr.text];
}

function calleeParts(call: Node): string[] | undefined {
  const fn = call.childForFieldName('function');
  return fn ? attributeParts(fn) : undefined;
}

function stringArg(args: Node | null, index = 0): string | undefined {
  if (!args) return undefined;
  const child = args.namedChild(index);
  if (!child) return undefined;
  if (child.type === 'string') {
    for (let i = 0; i < child.namedChildCount; i++) {
      const part = child.namedChild(i);
      if (part?.type === 'string_content') return part.text;
    }
    return child.text.replace(/^['"]|['"]$/g, '');
  }
  return child.text;
}

/** `def test_x` inside `class TestY` reads as "TestY.test_x" for matching purposes. */
function enclosingClassName(node: Node): string | undefined {
  let current: Node | null = node.parent;
  while (current) {
    if (current.type === 'class_definition') {
      return current.childForFieldName('name')?.text;
    }
    current = current.parent;
  }
  return undefined;
}

export function createPythonAdapter(parse: (source: string) => Tree): LanguageAdapter {
  return {
    id: 'python',
    extensions: ['.py'],
    parse,

    findTestBlocks(tree: Tree): TestBlock[] {
      const out: TestBlock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type === 'class_definition') {
          const name = node.childForFieldName('name')?.text;
          if (!name || !TEST_CLASS.test(name)) return;
          out.push({
            name,
            normalizedName: normalizeName(name),
            kind: 'suite',
            node,
            startLine: lineOf(node),
            endLine: endLineOf(node),
          });
          return;
        }
        if (node.type !== 'function_definition') return;
        const name = node.childForFieldName('name')?.text;
        if (!name || !TEST_FUNCTION.test(name)) return;

        // Qualify with the class so `TestA.test_x` and `TestB.test_x` stay distinct.
        const cls = enclosingClassName(node);
        const qualified = cls ? `${cls}.${name}` : name;
        out.push({
          name: qualified,
          normalizedName: normalizeName(qualified),
          kind: 'case',
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
        // Shape 1: a bare `assert expr` statement.
        if (n.type === 'assert_statement') {
          const expr = n.namedChild(0);
          out.push({
            node: n,
            startLine: lineOf(n),
            matcher: 'assert',
            text: textOf(n),
            // `assert x != y` is a negated assertion.
            isNegated:
              expr?.type === 'comparison_operator' && /(!=|not\s+in|is\s+not)/.test(expr.text),
            args: expr ? [textOf(expr, 80)] : [],
          });
          return;
        }

        if (n.type !== 'call') return;
        const parts = calleeParts(n);
        if (!parts || parts.length === 0) return;
        const method = parts[parts.length - 1]!;

        // Shape 2: `self.assertEqual(...)` and friends.
        // Shape 3: `mock.assert_called_once_with(...)`.
        // Shape 4: `pytest.raises(...)` used as a context manager.
        const isUnittest = UNITTEST_ASSERTION.test(method);
        const isMockAssert = MOCK_ASSERTION.test(method);
        const isPytestRaises =
          parts.length >= 2 && parts[parts.length - 2] === 'pytest' && method === 'raises';
        if (!isUnittest && !isMockAssert && !isPytestRaises) return;

        out.push({
          node: n,
          startLine: lineOf(n),
          matcher: isPytestRaises ? 'assertRaises' : denegate(method),
          text: textOf(n),
          isNegated: NEGATED.test(method) || /not_called/.test(method),
          args: argTexts(n.childForFieldName('arguments')),
        });
      });
      return out;
    },

    findMocks(tree: Tree): Mock[] {
      const out: Mock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type !== 'call') return;
        const parts = calleeParts(node);
        if (!parts || parts.length < 2) return;
        const method = parts[parts.length - 1]!;
        const object = parts[parts.length - 2]!;

        // `patch(...)` used bare after `from unittest.mock import patch` counts too.
        const known = MOCK_CONSTRUCTS.some((c) => c.object === object && c.method === method);
        const isPatchAttr = method === 'patch' || method === 'patch.object';
        if (!known && !isPatchAttr) return;

        const args = node.childForFieldName('arguments');
        // patch("app.auth.current_user") -> the dotted path
        // monkeypatch.setattr(auth, "verify", ...) -> "auth.verify"
        const first = stringArg(args, 0);
        const second =
          method === 'setattr' || method === 'setitem' ? stringArg(args, 1) : undefined;

        const target = second ? `${first}.${second}` : (first ?? '');
        if (!target) return;

        out.push({
          node,
          startLine: lineOf(node),
          target,
          construct: `${object}.${method}`,
          text: textOf(node),
        });
      });

      // Decorator form: `@patch("app.auth.current_user")` above a test.
      walk(tree.rootNode, (node) => {
        if (node.type !== 'decorator') return;
        const call = node.namedChild(0);
        if (!call || call.type !== 'call') return;
        const parts = calleeParts(call);
        if (!parts) return;
        const method = parts[parts.length - 1]!;
        if (method !== 'patch' && method !== 'object') return;
        const target = stringArg(call.childForFieldName('arguments'), 0);
        if (!target) return;
        if (out.some((m) => m.startLine === lineOf(call))) return; // already recorded above
        out.push({
          node,
          startLine: lineOf(node),
          target,
          construct: `@${parts.join('.')}`,
          text: textOf(node),
        });
      });

      return out;
    },

    findFunctions(tree: Tree): FunctionBlock[] {
      const out: FunctionBlock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type !== 'function_definition') return;
        out.push({
          name: node.childForFieldName('name')?.text ?? '<anonymous>',
          node,
          bodyNode: node.childForFieldName('body'),
          startLine: lineOf(node),
          endLine: endLineOf(node),
        });
      });
      return out;
    },

    assertionStrength(a: Assertion): number {
      if (a.matcher === 'assert') {
        // `assert x == 1000` pins the value down; `assert x` only checks truthiness.
        const expr = a.args[0] ?? '';
        // `assert a == b` asserts exactly what `assertEqual(a, b)` does, so it must score
        // the same -- otherwise porting a suite from unittest to pytest reads as a
        // wholesale weakening. `assert a` alone only checks truthiness.
        if (/(==|!=|\bis\b|\bin\b|<=|>=|<|>)/.test(expr)) return STRENGTH.assertEqual!;
        return 25;
      }
      const base = STRENGTH[a.matcher] ?? DEFAULT_STRENGTH;
      if (base >= 80 && a.args.some((arg) => LOOSE_ARG.test(arg))) return 45;
      return base;
    },
  };
}
