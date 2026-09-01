import { describe, it, expect } from 'vitest';
import { findSuppressions, applySuppressions } from '../../src/engine/suppress.js';
import type { Finding } from '../../src/types.js';

const finding = (over: Partial<Finding> = {}): Finding => ({
  ruleId: 'NOB-102',
  title: 'Assertion weakened',
  severity: 'high',
  weight: 30,
  file: 'a.ts',
  line: 10,
  message: 'm',
  evidence: {},
  suppressWith: '',
  ...over,
});

describe('inline suppression', () => {
  it('parses comments in several languages', () => {
    const src = [
      '// nobble-ignore NOB-102: rewriting for the new API, see #482',
      '# nobble-ignore NOB-101: ported to rspec',
      '/* nobble-ignore NOB-103: dead feature removed */',
    ].join('\n');
    const found = findSuppressions(src);
    expect(found.map((s) => s.ruleId)).toEqual(['NOB-102', 'NOB-101', 'NOB-103']);
    expect(found.every((s) => s.hasReason)).toBe(true);
    expect(found[2]!.reason).toBe('dead feature removed');
  });

  it('suppresses on the same line or the line above', () => {
    const sup = new Map([['a.ts', findSuppressions('// nobble-ignore NOB-102: valid reason\n')]]);
    // comment on line 1, finding on line 2 -> suppressed
    expect(applySuppressions([finding({ line: 2 })], sup).kept).toHaveLength(0);
    // finding far away -> not suppressed
    expect(applySuppressions([finding({ line: 9 })], sup).kept).toHaveLength(1);
  });

  it('only suppresses the rule it names', () => {
    const sup = new Map([['a.ts', findSuppressions('// nobble-ignore NOB-999: reason\n')]]);
    expect(applySuppressions([finding({ line: 2 })], sup).kept).toHaveLength(1);
  });

  it('a reasonless suppression does NOT suppress, and is itself reported', () => {
    const sup = new Map([['a.ts', findSuppressions('// nobble-ignore NOB-102:\n')]]);
    const res = applySuppressions([finding({ line: 2 })], sup);
    expect(res.kept).toHaveLength(1); // the original finding survives
    expect(res.suppressed).toHaveLength(0);
    expect(res.unexplained).toHaveLength(1); // and NOB-001 has something to report
  });

  it('treats a missing colon as reasonless', () => {
    const found = findSuppressions('// nobble-ignore NOB-102\n');
    expect(found[0]!.hasReason).toBe(false);
  });
});
