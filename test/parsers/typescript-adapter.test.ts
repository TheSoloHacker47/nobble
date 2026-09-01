import { describe, it, expect, beforeAll } from 'vitest';
import { initParsers, initAdapters, adapterForPath } from '../../src/parsers/index.js';
import type { LanguageAdapter } from '../../src/parsers/types.js';

let ts: LanguageAdapter;

beforeAll(async () => {
  await initParsers();
  await initAdapters();
  ts = adapterForPath('x.ts')!;
});

const parse = (src: string) => ts.parse(src);

describe('TypeScript adapter', () => {
  it('finds named test blocks and their kinds', () => {
    const blocks = ts.findTestBlocks(
      parse(`describe('PaymentAuthorizer', () => {
  it('charges the card', () => {});
  test('refunds', () => {});
});`),
    );
    expect(blocks.map((b) => [b.kind, b.name])).toEqual([
      ['suite', 'PaymentAuthorizer'],
      ['case', 'charges the card'],
      ['case', 'refunds'],
    ]);
  });

  it('normalizes names so reformatting is not a rename', () => {
    const a = ts.findTestBlocks(parse(`it('charges the card', () => {});`))[0]!;
    const b = ts.findTestBlocks(parse(`it("Charges  the CARD!", () => {});`))[0]!;
    expect(a.normalizedName).toBe(b.normalizedName);
  });

  it('treats skip and only variants as the same block', () => {
    const blocks = ts.findTestBlocks(
      parse(`it.skip('a', () => {}); describe.only('b', () => {});`),
    );
    expect(blocks.map((b) => b.name)).toEqual(['a', 'b']);
  });

  it('finds assertions and their matchers', () => {
    const tree = parse(`it('x', () => {
  expect(charge()).toBe(1000);
  expect(fn).toHaveBeenCalledWith(1, 2);
  expect(x).not.toBeNull();
  await expect(p).resolves.toEqual(3);
  assert.equal(a, b);
});`);
    const assertions = ts.findAssertions(tree.rootNode);
    expect(assertions.map((a) => a.matcher)).toEqual([
      'toBe',
      'toHaveBeenCalledWith',
      'toBeNull',
      'toEqual',
      'equal',
    ]);
  });

  it('detects negation', () => {
    const tree = parse(`expect(x).not.toBe(1); expect(y).toBe(1);`);
    expect(ts.findAssertions(tree.rootNode).map((a) => a.isNegated)).toEqual([true, false]);
  });

  it('does not mistake ordinary method calls for assertions', () => {
    const tree = parse(`const r = user.save(); logger.info('done'); items.map(x => x.id);`);
    expect(ts.findAssertions(tree.rootNode)).toHaveLength(0);
  });

  it('ranks matcher strength so weakening is detectable', () => {
    const s = (src: string) => ts.assertionStrength(ts.findAssertions(parse(src).rootNode)[0]!);
    expect(s('expect(a).toBe(1);')).toBeGreaterThan(s('expect(a).toBeTruthy();'));
    expect(s('expect(a).toEqual(x);')).toBeGreaterThan(s('expect(a).toBeDefined();'));
    expect(s('expect(f).toHaveBeenCalledWith(1);')).toBeGreaterThan(
      s('expect(f).toHaveBeenCalled();'),
    );
    expect(s('expect(a).toBe(1);')).toBeGreaterThan(s('expect(a).toBeInstanceOf(Thing);'));
  });

  it('downgrades an exact matcher fed a wildcard argument', () => {
    const s = (src: string) => ts.assertionStrength(ts.findAssertions(parse(src).rootNode)[0]!);
    expect(s('expect(f).toHaveBeenCalledWith(expect.any(Number));')).toBeLessThan(
      s('expect(f).toHaveBeenCalledWith(42);'),
    );
  });

  it('finds mocks and their targets', () => {
    const mocks = ts.findMocks(
      parse(`jest.mock('../auth/current_user');
vi.mock('./session', () => ({}));
jest.spyOn(auth, 'verify');
sinon.stub(billing, 'charge');
vi.spyOn(tokenStore, 'read');`),
    );
    expect(mocks.map((m) => m.target)).toEqual([
      '../auth/current_user',
      './session',
      'auth.verify',
      'billing.charge',
      'tokenStore.read',
    ]);
    expect(mocks.map((m) => m.construct)).toEqual([
      'jest.mock',
      'vi.mock',
      'jest.spyOn',
      'sinon.stub',
      'vi.spyOn',
    ]);
  });

  it('finds function bodies for early-return detection', () => {
    const fns = ts.findFunctions(
      parse(`function authorize(u) { return true; }
const check = (u) => { return next(); };
class A { verify() { return true; } }`),
    );
    expect(fns.length).toBeGreaterThanOrEqual(3);
    expect(fns.some((f) => f.name === 'authorize')).toBe(true);
    expect(fns.every((f) => f.bodyNode !== null)).toBe(true);
  });
});
