import { describe, it, expect } from 'vitest';
import { runFixture, describeMismatch, discoverFixtures } from '../fixture-harness.js';

/**
 * Fixture suite for the rules that need no AST.
 *
 * Fixture names encode intent: `-pos-` must fire, `-neg-` must not. The suite asserts that
 * convention separately from the expected.json contents, so a fixture cannot quietly be
 * "fixed" by editing its expectations to match a regression.
 */
const fixtures = discoverFixtures('regex');

describe('regex-only rules', () => {
  it('found the fixture set', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(57);
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

  it('positive fixtures expect their rule, negative fixtures exclude it', async () => {
    for (const f of fixtures) {
      const m = /^(nob)(\d{3})-(pos|neg)-/.exec(f.name)!;
      const ruleId = `NOB-${m[2]}`;
      const { expected } = await runFixture(f.dir);
      const mentionsRule = expected.findings.some((x) => x.ruleId === ruleId);
      if (m[3] === 'pos') {
        expect(mentionsRule, `${f.name} is positive but does not expect ${ruleId}`).toBe(true);
      } else {
        // A negative fixture must exclude ITS OWN rule. It may still legitimately expect
        // another rule -- e.g. nob001-neg-suppression-for-other-rule expects the NOB-104
        // it declines to suppress.
        expect(mentionsRule, `${f.name} is negative but expects ${ruleId}`).toBe(false);
      }
    }
  }, 120_000);
});
