import { describe, it, expect } from 'vitest';
import { score, verdictFor, sortFindings, exitCode } from '../../src/engine/score.js';
import { defaultConfig } from '../../src/config/load.js';
import type { Finding, Severity } from '../../src/types.js';

const f = (severity: Severity, weight: number, over: Partial<Finding> = {}): Finding => ({
  ruleId: 'NOB-101',
  title: 't',
  severity,
  weight,
  file: 'a.ts',
  line: 1,
  message: 'm',
  evidence: {},
  suppressWith: '',
  ...over,
});

describe('scoring', () => {
  const config = defaultConfig();

  it('sums weights and caps at 100', () => {
    expect(score([])).toBe(0);
    expect(score([f('high', 30), f('high', 25)])).toBe(55);
    expect(score([f('critical', 40), f('critical', 40), f('high', 30), f('high', 30)])).toBe(100);
  });

  it('maps score to the spec verdict bands', () => {
    expect(verdictFor(0, config)).toBe('pass');
    expect(verdictFor(1, config)).toBe('warn');
    expect(verdictFor(39, config)).toBe('warn');
    expect(verdictFor(40, config)).toBe('block');
    expect(verdictFor(100, config)).toBe('block');
  });

  it('sorts by severity, then weight, then location', () => {
    const sorted = sortFindings([
      f('low', 8, { file: 'z.ts' }),
      f('critical', 40),
      f('high', 25, { line: 5 }),
      f('high', 30),
    ]);
    expect(sorted.map((x) => `${x.severity}:${x.weight}`)).toEqual([
      'critical:40',
      'high:30',
      'high:25',
      'low:8',
    ]);
  });

  it('is non-blocking by default', () => {
    expect(exitCode('block', 'none')).toBe(0);
    expect(exitCode('warn', 'none')).toBe(0);
  });

  it('exits 1 only at or above the configured level', () => {
    expect(exitCode('block', 'block')).toBe(1);
    expect(exitCode('warn', 'block')).toBe(0);
    expect(exitCode('warn', 'warn')).toBe(1);
    expect(exitCode('block', 'warn')).toBe(1);
    expect(exitCode('pass', 'warn')).toBe(0);
  });
});
