import { describe, it, expect, beforeAll } from 'vitest';
import { initParsers, initAdapters, adapterForPath } from '../../src/parsers/index.js';
import type { LanguageAdapter } from '../../src/parsers/types.js';

let rb: LanguageAdapter;
let py: LanguageAdapter;

beforeAll(async () => {
  await initParsers();
  await initAdapters();
  rb = adapterForPath('x.rb')!;
  py = adapterForPath('x.py')!;
});

describe('Ruby adapter', () => {
  const parse = (src: string) => rb.parse(src);

  it('finds RSpec suites and examples', () => {
    const blocks = rb.findTestBlocks(
      parse(`describe "PaymentAuthorizer" do
  context "with a valid card" do
    it "charges the card" do
      expect(charge).to eq(1000)
    end
  end
end`),
    );
    expect(blocks.map((b) => [b.kind, b.name])).toEqual([
      ['suite', 'PaymentAuthorizer'],
      ['suite', 'with a valid card'],
      ['case', 'charges the card'],
    ]);
  });

  it('finds RSpec assertions and their matchers', () => {
    const assertions = rb.findAssertions(
      parse(`it "x" do
  expect(charge).to eq(1000)
  expect(user).not_to be_nil
  expect(name).to match(/pay/)
  is_expected.to be_truthy
end`).rootNode,
    );
    expect(assertions.map((a) => a.matcher)).toEqual(['eq', 'be_nil', 'match', 'be_truthy']);
    expect(assertions.map((a) => a.isNegated)).toEqual([false, true, false, false]);
  });

  it('finds Minitest assertions', () => {
    const assertions = rb.findAssertions(
      parse(`def test_charges
  assert_equal 1000, charge
  refute_nil user
  assert charge.positive?
end`).rootNode,
    );
    // `refute_nil` is reported as `assert_nil` + isNegated, so negation lives in one place
    // across all three languages. Without that, NOB-102 reads an inversion as a weakening
    // and NOB-105 never sees it.
    expect(assertions.map((a) => a.matcher)).toEqual(['assert_equal', 'assert_nil', 'assert']);
    expect(assertions.map((a) => a.isNegated)).toEqual([false, true, false]);
  });

  it('does not mistake ordinary calls for assertions', () => {
    const assertions = rb.findAssertions(
      parse(`user.save\nlogger.info("done")\nitems.map(&:id)`).rootNode,
    );
    expect(assertions).toHaveLength(0);
  });

  it('ranks matcher strength', () => {
    const s = (src: string) => rb.assertionStrength(rb.findAssertions(parse(src).rootNode)[0]!);
    expect(s('expect(a).to eq(1)')).toBeGreaterThan(s('expect(a).to be_truthy'));
    expect(s('expect(a).to eq(1)')).toBeGreaterThan(s('expect(a).to be_a(Integer)'));
    expect(s('assert_equal 1, a')).toBeGreaterThan(s('assert a'));
  });

  it('finds message stubs and doubles', () => {
    const mocks = rb.findMocks(
      parse(`allow(user).to receive(:current_user).and_return(admin)
allow(policy).to receive(:authorize)
session = instance_double("SessionStore")`),
    );
    expect(mocks.map((m) => m.target)).toEqual([
      'user.current_user',
      'policy.authorize',
      'SessionStore',
    ]);
  });

  it('finds method bodies for early-return detection', () => {
    const fns = rb.findFunctions(
      parse(
        `def authorize(u)\n  return true\n  u.admin?\nend\n\ndef self.verify(t)\n  t.valid?\nend`,
      ),
    );
    expect(fns.map((f) => f.name)).toEqual(['authorize', 'verify']);
    expect(fns.every((f) => f.bodyNode !== null)).toBe(true);
  });
});

describe('Python adapter', () => {
  const parse = (src: string) => py.parse(src);

  it('finds pytest functions and unittest classes', () => {
    const blocks = py.findTestBlocks(
      parse(`def test_charges():
    assert charge() == 1000

class TestPayments:
    def test_refunds(self):
        assert refund() == 500
`),
    );
    expect(blocks.map((b) => [b.kind, b.name])).toEqual([
      ['case', 'test_charges'],
      ['suite', 'TestPayments'],
      ['case', 'TestPayments.test_refunds'],
    ]);
  });

  it('keeps same-named methods in different classes distinct', () => {
    const blocks = py.findTestBlocks(
      parse(`class TestA:
    def test_x(self):
        assert 1 == 1

class TestB:
    def test_x(self):
        assert 2 == 2
`),
    );
    const cases = blocks.filter((b) => b.kind === 'case');
    expect(cases[0]!.normalizedName).not.toBe(cases[1]!.normalizedName);
  });

  it('finds bare asserts, unittest assertions and pytest.raises', () => {
    const assertions = py.findAssertions(
      parse(`def test_x(self):
    assert charge() == 1000
    self.assertEqual(fee(), 30)
    self.assertTrue(ok)
    with pytest.raises(ValueError):
        charge(bad)
`).rootNode,
    );
    expect(assertions.map((a) => a.matcher)).toEqual([
      'assert',
      'assertEqual',
      'assertTrue',
      'assertRaises',
    ]);
  });

  it('detects negation', () => {
    const assertions = py.findAssertions(
      parse(`def test_x(self):
    self.assertNotEqual(a, b)
    self.assertEqual(a, b)
    assert a != b
`).rootNode,
    );
    expect(assertions.map((a) => a.isNegated)).toEqual([true, false, true]);
    // Negation is stripped from the matcher name for the same reason as Ruby's refute_*.
    expect(assertions[0]!.matcher).toBe('assertEqual');
  });

  it('grades a bare assert by whether it compares anything', () => {
    const s = (src: string) => py.assertionStrength(py.findAssertions(parse(src).rootNode)[0]!);
    // `assert x == 1000` pins the value; `assert x` only checks truthiness.
    expect(s('assert charge() == 1000\n')).toBeGreaterThan(s('assert charge()\n'));
    expect(s('self.assertEqual(a, b)\n')).toBeGreaterThan(s('self.assertTrue(a)\n'));
    expect(s('self.assertEqual(a, b)\n')).toBeGreaterThan(s('self.assertIsNotNone(a)\n'));
  });

  it('finds patch and monkeypatch mocks, including the decorator form', () => {
    const mocks = py.findMocks(
      parse(`mock.patch("app.auth.current_user")
monkeypatch.setattr(auth, "verify", lambda: True)

@patch("app.session.token")
def test_x():
    pass
`),
    );
    expect(mocks.map((m) => m.target)).toContain('app.auth.current_user');
    expect(mocks.map((m) => m.target)).toContain('auth.verify');
    expect(mocks.map((m) => m.target)).toContain('app.session.token');
  });

  it('finds function bodies for early-return detection', () => {
    const fns = py.findFunctions(
      parse(`def authorize(u):\n    return True\n\ndef verify(t):\n    return t.valid\n`),
    );
    expect(fns.map((f) => f.name)).toEqual(['authorize', 'verify']);
    expect(fns.every((f) => f.bodyNode !== null)).toBe(true);
  });
});
