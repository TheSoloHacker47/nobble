import { describe, it, expect } from 'vitest';
import { runFixture, describeMismatch, discoverFixtures } from '../fixture-harness.js';

/** Fixture suite for the AST rules, TypeScript flavour. */
const fixtures = discoverFixtures('ts');

describe('TypeScript AST rules', () => {
  it('found the fixture set', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(43);
  });

  it.each(fixtures)('$name', async ({ dir }) => {
    const run = await runFixture(dir);
    const mismatch = describeMismatch(run);
    expect(mismatch ?? 'ok').toBe('ok');
  });

  it('every rule has at least 3 positive and 3 negative fixtures', () => {
    const counts = new Map<string, { pos: number; neg: number }>();
    for (const f of fixtures) {
      const m = /^(nob\d{3})-(pos|neg)-/.exec(f.name);
      if (!m) throw new Error(`fixture "${f.name}" does not follow <rule>-<pos|neg>-<case>`);
      const entry = counts.get(m[1]!) ?? { pos: 0, neg: 0 };
      if (m[2] === 'pos') entry.pos++;
      else entry.neg++;
      counts.set(m[1]!, entry);
    }
    for (const [rule, { pos, neg }] of counts) {
      expect(pos, `${rule} needs >=3 positive fixtures`).toBeGreaterThanOrEqual(3);
      expect(neg, `${rule} needs >=3 negative fixtures`).toBeGreaterThanOrEqual(3);
    }
  });
});
