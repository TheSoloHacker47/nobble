import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, YAMLParseError } from 'yaml';
import { validateUserConfig, ConfigError, type ResolvedConfig, type UserConfig } from './schema.js';
import {
  DEFAULT_TEST_GLOBS,
  DEFAULT_SECURITY_GLOBS,
  DEFAULT_IGNORE_GLOBS,
  DEFAULT_SENSITIVE_SYMBOLS,
  DEFAULT_THRESHOLDS,
  DEFAULT_MAX_FINDINGS,
  DEFAULT_COMMENT_MODE,
  DEFAULT_FAIL_ON,
} from './defaults.js';

export const DEFAULT_CONFIG_PATH = '.nobble.yml';

export function defaultConfig(): ResolvedConfig {
  return {
    failOn: DEFAULT_FAIL_ON,
    testGlobs: [...DEFAULT_TEST_GLOBS],
    securityGlobs: [...DEFAULT_SECURITY_GLOBS],
    ignoreGlobs: [...DEFAULT_IGNORE_GLOBS],
    rules: {},
    sensitiveSymbols: [...DEFAULT_SENSITIVE_SYMBOLS],
    thresholds: { ...DEFAULT_THRESHOLDS },
    maxFindings: DEFAULT_MAX_FINDINGS,
    commentMode: DEFAULT_COMMENT_MODE,
  };
}

/**
 * Merges a validated user config over the defaults.
 *
 * `paths.*` REPLACES the default globs; `rules['NOB-201'].symbols` APPENDS to the default
 * symbol list. That asymmetry is the spec's: §8 annotates the symbols list with
 * "appended to defaults" and annotates nothing else. See DECISIONS.md A6.
 */
export function resolveConfig(user: UserConfig): ResolvedConfig {
  const base = defaultConfig();

  if (user.fail_on) base.failOn = user.fail_on;
  if (user.paths?.tests) base.testGlobs = [...user.paths.tests];
  if (user.paths?.security) base.securityGlobs = [...user.paths.security];
  if (user.paths?.ignore) base.ignoreGlobs = [...user.paths.ignore];
  if (user.rules) base.rules = { ...user.rules };

  const extraSymbols = user.rules?.['NOB-201']?.symbols;
  if (extraSymbols?.length) base.sensitiveSymbols = [...base.sensitiveSymbols, ...extraSymbols];

  if (user.thresholds?.block !== undefined) base.thresholds.block = user.thresholds.block;
  if (user.thresholds?.warn !== undefined) base.thresholds.warn = user.thresholds.warn;
  if (user.report?.max_findings !== undefined) base.maxFindings = user.report.max_findings;
  if (user.report?.comment_mode !== undefined) base.commentMode = user.report.comment_mode;

  return base;
}

export interface LoadResult {
  config: ResolvedConfig;
  /** Absolute path actually read, or undefined when defaults were used. */
  path?: string;
}

/**
 * Loads `.nobble.yml`. A missing file at the default location is fine -- the whole config
 * is optional. A missing file at an *explicitly requested* path is an error, because the
 * user asked for something that is not there.
 */
export function loadConfig(configPath: string | undefined, cwd = process.cwd()): LoadResult {
  const explicit = configPath !== undefined;
  const rel = configPath ?? DEFAULT_CONFIG_PATH;
  const abs = path.isAbsolute(rel) ? rel : path.join(cwd, rel);

  if (!fs.existsSync(abs)) {
    if (explicit) {
      throw new ConfigError(`Config file not found: ${rel}`, [
        `looked for ${abs}`,
        'omit --config to run with built-in defaults',
      ]);
    }
    return { config: defaultConfig() };
  }

  const text = fs.readFileSync(abs, 'utf8');
  let raw: unknown;
  try {
    raw = parseYaml(text);
  } catch (err) {
    if (err instanceof YAMLParseError) {
      const line = err.linePos?.[0]?.line;
      throw new ConfigError(`${rel} is not valid YAML.`, [
        line ? `line ${line}: ${err.message.split('\n')[0]}` : err.message.split('\n')[0]!,
      ]);
    }
    throw err;
  }

  const user = validateUserConfig(raw, rel);
  return { config: resolveConfig(user), path: abs };
}

export { ConfigError };
export type { ResolvedConfig, UserConfig };
