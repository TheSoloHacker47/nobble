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
 * Ruby adapter, covering RSpec and Minitest.
 *
 * Ruby's grammar is flatter than TypeScript's: nearly everything is a `call` node with an
 * `identifier` and an `argument_list`, and RSpec's `expect(x).to eq(y)` is a call whose
 * receiver is itself a call. That makes matcher extraction a matter of looking one level
 * into the argument list rather than walking a member chain.
 */

const SUITE_NAMES = new Set([
  'describe',
  'context',
  'xdescribe',
  'xcontext',
  'feature',
  'shared_examples',
]);
const CASE_NAMES = new Set([
  'it',
  'specify',
  'example',
  'scenario',
  'xit',
  'xspecify',
  'fit',
  'test',
]);

/** RSpec's `to` / `not_to` / `to_not`, which carry the matcher as their argument. */
const EXPECT_VERBS = new Set(['to', 'not_to', 'to_not']);
const NEGATED_VERBS = new Set(['not_to', 'to_not']);

const STRENGTH: Record<string, number> = {
  // Exact value or structure.
  eq: 100,
  eql: 100,
  equal: 110,
  match: 80,
  match_array: 90,
  contain_exactly: 95,
  have_attributes: 90,
  include: 80,
  start_with: 80,
  end_with: 80,
  raise_error: 80,
  change: 80,
  have_received: 85,
  // Minitest.
  assert_equal: 100,
  assert_same: 110,
  assert_match: 80,
  assert_includes: 80,
  assert_raises: 80,
  refute_equal: 60,
  // Weak: type or existence only.
  be_a: 50,
  be_an: 50,
  be_kind_of: 50,
  be_instance_of: 50,
  be_within: 70,
  assert_kind_of: 50,
  assert_instance_of: 50,
  be_present: 25,
  be_truthy: 20,
  be_falsey: 20,
  be_falsy: 20,
  be_nil: 30,
  be_empty: 40,
  be: 60,
  assert: 25,
  assert_nil: 30,
  assert_not_nil: 25,
  refute_nil: 25,
  assert_predicate: 45,
};

const DEFAULT_STRENGTH = 60;

/** Arguments that throw the exact value away even under a strong matcher. */
const LOOSE_ARG =
  /\b(anything|any_args|instance_of|kind_of|be_a_kind_of|hash_including|a_string_matching)\b/;

/** Minitest and RSpec bare assertion methods, matched by name. */
const BARE_ASSERTION = /^(assert|refute)(_\w+)?$/;

/**
 * `refute_x` is `assert_x` inverted. Reporting the matcher as `assert_x` with
 * `isNegated: true` keeps negation in one place, so NOB-105 sees the inversion and NOB-102
 * does not mistake it for a weaker matcher. See the same helper in the Python adapter.
 */
function denegate(method: string): string {
  return method.replace(/^refute(_|$)/, 'assert$1').replace(/^assert_not_/, 'assert_');
}

/** Minitest declares tests as `def test_*` methods, the way Python does. */
const TEST_METHOD = /^test_/;
const TEST_CLASS = /Test$|^Test/;

/** RSpec's `is_expected.to ...` reads as an assertion with no explicit `expect(`. */
const IMPLICIT_SUBJECT = new Set(['is_expected', 'expect']);

const MOCK_RECEIVERS = new Set([
  'allow',
  'expect',
  'allow_any_instance_of',
  'expect_any_instance_of',
]);
const DOUBLE_BUILDERS = new Set([
  'double',
  'instance_double',
  'class_double',
  'object_double',
  'spy',
  'stub_const',
]);

function callName(node: Node): string | undefined {
  // `foo(...)`      -> method is a direct identifier child
  // `recv.foo(...)` -> method is the `method` field, receiver the `receiver` field
  const method = node.childForFieldName('method');
  if (method) return method.text;
  const first = node.namedChild(0);
  return first?.type === 'identifier' ? first.text : undefined;
}

function receiverOf(node: Node): Node | null {
  return node.childForFieldName('receiver');
}

/** The block a `do ... end` / `{ ... }` attaches to a call. */
function blockOf(node: Node): Node | null {
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child && (child.type === 'do_block' || child.type === 'block')) return child;
  }
  return null;
}

function firstStringArgument(node: Node): string | undefined {
  const args = node.childForFieldName('arguments') ?? node.namedChild(1);
  if (!args) return undefined;
  for (let i = 0; i < args.namedChildCount; i++) {
    const child = args.namedChild(i);
    if (!child) continue;
    if (child.type === 'string') {
      const content = child.namedChild(0);
      return content ? content.text : child.text.replace(/^['"]|['"]$/g, '');
    }
    if (child.type === 'constant' || child.type === 'simple_symbol') {
      return child.text.replace(/^:/, '');
    }
  }
  return undefined;
}

/**
 * Source text of a call's first argument, whatever its node type.
 *
 * `firstStringArgument` only sees strings, constants, and symbols, so for `allow(user)` it
 * returns undefined and the caller would fall back to the whole call's text -- yielding a
 * mock target of "allow(user).current_user" instead of "user.current_user".
 */
function firstArgumentText(node: Node): string | undefined {
  const args = argumentList(node);
  const first = args?.namedChild(0);
  return first ? first.text : undefined;
}

function argumentList(node: Node): Node | null {
  const named = node.childForFieldName('arguments');
  if (named) return named;
  for (let i = 0; i < node.namedChildCount; i++) {
    const child = node.namedChild(i);
    if (child?.type === 'argument_list') return child;
  }
  return null;
}

export function createRubyAdapter(parse: (source: string) => Tree): LanguageAdapter {
  return {
    id: 'ruby',
    extensions: ['.rb', '.rake'],
    parse,

    findTestBlocks(tree: Tree): TestBlock[] {
      const out: TestBlock[] = [];
      walk(tree.rootNode, (node) => {
        // Minitest: `class PayTest < Minitest::Test` with `def test_*` methods inside.
        // Same shape as Python, and it has to live here rather than in a rule, because
        // "what is a test block" is exactly what a LanguageAdapter is for.
        if (node.type === 'class') {
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
        if (node.type === 'method') {
          const name = node.childForFieldName('name')?.text;
          if (!name || !TEST_METHOD.test(name)) return;
          out.push({
            name,
            normalizedName: normalizeName(name),
            kind: 'case',
            node,
            startLine: lineOf(node),
            endLine: endLineOf(node),
          });
          return;
        }
        if (node.type !== 'call') return;
        const name = callName(node);
        if (!name) return;
        const isSuite = SUITE_NAMES.has(name);
        const isCase = CASE_NAMES.has(name);
        if (!isSuite && !isCase) return;
        // `describe "x" do ... end` -- a test block always carries a block body.
        if (!blockOf(node)) return;

        const title = firstStringArgument(node);
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
        if (n.type !== 'call') return;
        const name = callName(n);
        if (!name) return;

        // Shape 1: expect(x).to eq(y) / is_expected.not_to be_nil
        if (EXPECT_VERBS.has(name)) {
          const receiver = receiverOf(n);
          const receiverName = receiver
            ? receiver.type === 'call'
              ? callName(receiver)
              : receiver.text
            : undefined;
          if (!receiverName || !IMPLICIT_SUBJECT.has(receiverName)) return;

          // The matcher is the argument to `to`: `eq(1000)`, `be_truthy`, `match(/x/)`.
          const args = argumentList(n);
          const matcherNode = args?.namedChild(0) ?? null;
          const matcher = matcherNode
            ? matcherNode.type === 'call'
              ? (callName(matcherNode) ?? matcherNode.text)
              : matcherNode.text
            : 'to';

          out.push({
            node: n,
            startLine: lineOf(n),
            matcher,
            text: textOf(n),
            isNegated: NEGATED_VERBS.has(name),
            args: matcherNode?.type === 'call' ? argTexts(argumentList(matcherNode)) : [],
          });
          return;
        }

        // Shape 2: Minitest `assert_equal 1000, charge` / `refute_nil x`
        if (BARE_ASSERTION.test(name)) {
          out.push({
            node: n,
            startLine: lineOf(n),
            matcher: denegate(name),
            text: textOf(n),
            isNegated: name.startsWith('refute') || /_not_/.test(name),
            args: argTexts(argumentList(n)),
          });
        }
      });
      return out;
    },

    findMocks(tree: Tree): Mock[] {
      const out: Mock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type !== 'call') return;
        const name = callName(node);
        if (!name) return;

        // `allow(user).to receive(:current_user)` -- the target is the received message,
        // which is what actually gets replaced, falling back to the receiver.
        if (EXPECT_VERBS.has(name)) {
          const receiver = receiverOf(node);
          if (!receiver || receiver.type !== 'call') return;
          const receiverName = callName(receiver);
          if (!receiverName || !MOCK_RECEIVERS.has(receiverName)) return;

          const args = argumentList(node);
          const first = args?.namedChild(0);
          if (!first) return;
          // Unwrap `receive(:foo).and_return(x)` down to the `receive(...)` call.
          let receiveCall: Node | null = first;
          while (
            receiveCall &&
            receiveCall.type === 'call' &&
            callName(receiveCall) !== 'receive'
          ) {
            receiveCall = receiverOf(receiveCall);
          }
          if (!receiveCall || callName(receiveCall) !== 'receive') return;

          const message = firstStringArgument(receiveCall);
          const subject =
            firstArgumentText(receiver) ?? firstStringArgument(receiver) ?? receiver.text;
          out.push({
            node,
            startLine: lineOf(node),
            target: message ? `${subject}.${message}` : subject,
            construct: `${receiverName}(...).${name} receive`,
            text: textOf(node),
          });
          return;
        }

        // `instance_double(CurrentUser)`, `double("session")`, `stub_const("Auth", x)`
        if (DOUBLE_BUILDERS.has(name)) {
          const target = firstStringArgument(node);
          if (!target) return;
          out.push({
            node,
            startLine: lineOf(node),
            target,
            construct: name,
            text: textOf(node),
          });
        }
      });
      return out;
    },

    findFunctions(tree: Tree): FunctionBlock[] {
      const out: FunctionBlock[] = [];
      walk(tree.rootNode, (node) => {
        if (node.type !== 'method' && node.type !== 'singleton_method') return;
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
      if (base >= 80 && a.args.some((arg) => LOOSE_ARG.test(arg))) return 45;
      return base;
    },
  };
}
