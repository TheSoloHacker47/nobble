import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig, resolveConfig, defaultConfig, ConfigError } from '../../src/config/load.js';
import { validateUserConfig } from '../../src/config/schema.js';
import { DEFAULT_SENSITIVE_SYMBOLS } from '../../src/config/defaults.js';

function withConfig<T>(contents: string, fn: (dir: string) => T): T {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-cfg-'));
  try {
    fs.writeFileSync(path.join(dir, '.nobble.yml'), contents);
    return fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

describe('config loading', () => {
  it('falls back to defaults when no file exists', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-empty-'));
    try {
      const { config, path: p } = loadConfig(undefined, dir);
      expect(p).toBeUndefined();
      expect(config.failOn).toBe('none');
      expect(config.thresholds).toEqual({ block: 40, warn: 1 });
      expect(config.maxFindings).toBe(20);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('errors when an explicitly requested config is missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nobble-missing-'));
    try {
      expect(() => loadConfig('nope.yml', dir)).toThrow(ConfigError);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('parses the example config from the spec', () => {
    const yaml = `
version: 1
fail_on: none
paths:
  tests: ["spec/**", "**/*.test.ts"]
  security: ["app/policies/**"]
  ignore: ["vendor/**"]
rules:
  NOB-303:
    enabled: false
  NOB-301:
    severity: low
  NOB-201:
    symbols: ["billing_account", "feature_flag"]
thresholds:
  block: 40
  warn: 1
report:
  max_findings: 20
  comment_mode: sticky
`;
    withConfig(yaml, (dir) => {
      const { config } = loadConfig(undefined, dir);
      expect(config.testGlobs).toEqual(['spec/**', '**/*.test.ts']);
      expect(config.rules['NOB-303']?.enabled).toBe(false);
      expect(config.rules['NOB-301']?.severity).toBe('low');
      // symbols APPEND to the defaults; paths REPLACE them. See DECISIONS.md A6.
      expect(config.sensitiveSymbols).toContain('billing_account');
      expect(config.sensitiveSymbols).toContain('current_user');
      expect(config.sensitiveSymbols.length).toBe(DEFAULT_SENSITIVE_SYMBOLS.length + 2);
    });
  });

  it('collects every validation problem at once, not just the first', () => {
    let caught: ConfigError | undefined;
    try {
      validateUserConfig(
        {
          fail_on: 'sometimes',
          thresholds: { block: -1 },
          rules: { 'NOB-999x': {}, 'NOB-101': { severity: 'catastrophic' } },
          wat: true,
        },
        '.nobble.yml',
      );
    } catch (e) {
      caught = e as ConfigError;
    }
    expect(caught).toBeInstanceOf(ConfigError);
    expect(caught!.problems.length).toBeGreaterThanOrEqual(4);
    expect(caught!.problems.join('\n')).toContain('fail_on');
    expect(caught!.problems.join('\n')).toContain('wat');
  });

  it('rejects warn above block', () => {
    expect(() => validateUserConfig({ thresholds: { block: 10, warn: 50 } }, 'x')).toThrow(
      /warn \(50\) must not be greater than block \(10\)/,
    );
  });

  it('reports a line number for malformed YAML', () => {
    withConfig('paths:\n  tests:\n   - "a"\n  - "b"\n', (dir) => {
      expect(() => loadConfig(undefined, dir)).toThrow(ConfigError);
    });
  });

  it('only lets NOB-201 carry a symbols list', () => {
    expect(() => validateUserConfig({ rules: { 'NOB-101': { symbols: ['x'] } } }, 'x')).toThrow(
      /only NOB-201 accepts a symbols list/,
    );
  });

  it('resolveConfig leaves defaults untouched when user config is empty', () => {
    expect(resolveConfig({})).toEqual(defaultConfig());
  });
});
