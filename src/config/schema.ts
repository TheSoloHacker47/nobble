import type { Severity } from '../types.js';
import type { RuleOverride } from './defaults.js';

export type FailOn = 'none' | 'warn' | 'block';
export type CommentMode = 'sticky' | 'new' | 'none';

/** The shape of `.nobble.yml` as written by a user. Every field optional. */
export interface UserConfig {
  version?: number;
  fail_on?: FailOn;
  paths?: { tests?: string[]; security?: string[]; ignore?: string[] };
  rules?: Record<string, RuleOverride>;
  thresholds?: { block?: number; warn?: number };
  report?: { max_findings?: number; comment_mode?: CommentMode };
}

/** The fully-defaulted config the engine actually runs on. */
export interface ResolvedConfig {
  failOn: FailOn;
  testGlobs: string[];
  securityGlobs: string[];
  ignoreGlobs: string[];
  rules: Record<string, RuleOverride>;
  sensitiveSymbols: string[];
  thresholds: { block: number; warn: number };
  maxFindings: number;
  commentMode: CommentMode;
}

export class ConfigError extends Error {
  readonly summary: string;

  constructor(
    summary: string,
    readonly problems: string[],
  ) {
    // The problems are folded into `message` so that anything which only logs
    // `err.message` -- a bare `catch`, a test assertion, another tool wrapping the CLI --
    // still shows the user what is actually wrong with their config.
    super(problems.length ? `${summary}\n${problems.map((p) => `  - ${p}`).join('\n')}` : summary);
    this.name = 'ConfigError';
    this.summary = summary;
  }
}

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
const FAIL_ONS: FailOn[] = ['none', 'warn', 'block'];
const COMMENT_MODES: CommentMode[] = ['sticky', 'new', 'none'];
const RULE_ID = /^NOB-\d{3}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Validates raw parsed YAML. Collects *every* problem rather than throwing on the first,
 * so a user with three typos fixes them in one pass instead of three.
 */
export function validateUserConfig(raw: unknown, source: string): UserConfig {
  const problems: string[] = [];
  const at = (p: string, msg: string) => problems.push(`${p}: ${msg}`);

  if (raw === null || raw === undefined) return {};
  if (!isPlainObject(raw)) {
    throw new ConfigError(`${source} must contain a YAML mapping at the top level.`, [
      `expected a mapping, got ${Array.isArray(raw) ? 'a list' : typeof raw}`,
    ]);
  }

  const cfg = raw as Record<string, unknown>;

  const known = ['version', 'fail_on', 'paths', 'rules', 'thresholds', 'report'];
  for (const key of Object.keys(cfg)) {
    if (!known.includes(key)) {
      at(key, `unknown top-level key. Expected one of: ${known.join(', ')}`);
    }
  }

  if (cfg.version !== undefined && cfg.version !== 1) {
    at(
      'version',
      `unsupported config version ${JSON.stringify(cfg.version)}. Only 1 is supported.`,
    );
  }

  if (cfg.fail_on !== undefined && !FAIL_ONS.includes(cfg.fail_on as FailOn)) {
    at('fail_on', `expected one of ${FAIL_ONS.join(' | ')}, got ${JSON.stringify(cfg.fail_on)}`);
  }

  if (cfg.paths !== undefined) {
    if (!isPlainObject(cfg.paths)) {
      at('paths', 'expected a mapping with keys tests, security, ignore');
    } else {
      for (const key of ['tests', 'security', 'ignore']) {
        const v = cfg.paths[key];
        if (v === undefined) continue;
        if (!Array.isArray(v) || v.some((g) => typeof g !== 'string')) {
          at(`paths.${key}`, 'expected a list of glob strings');
        }
      }
      for (const key of Object.keys(cfg.paths)) {
        if (!['tests', 'security', 'ignore'].includes(key)) {
          at(`paths.${key}`, 'unknown key. Expected one of: tests, security, ignore');
        }
      }
    }
  }

  if (cfg.rules !== undefined) {
    if (!isPlainObject(cfg.rules)) {
      at('rules', 'expected a mapping of rule ID to overrides, e.g. "NOB-303: { enabled: false }"');
    } else {
      for (const [id, override] of Object.entries(cfg.rules)) {
        if (!RULE_ID.test(id)) {
          at(`rules.${id}`, 'not a valid rule ID. Rule IDs look like "NOB-101".');
          continue;
        }
        if (!isPlainObject(override)) {
          at(`rules.${id}`, 'expected a mapping, e.g. "{ enabled: false }"');
          continue;
        }
        if (override.enabled !== undefined && typeof override.enabled !== 'boolean') {
          at(`rules.${id}.enabled`, 'expected true or false');
        }
        if (
          override.severity !== undefined &&
          !SEVERITIES.includes(override.severity as Severity)
        ) {
          at(
            `rules.${id}.severity`,
            `expected one of ${SEVERITIES.join(' | ')}, got ${JSON.stringify(override.severity)}`,
          );
        }
        if (
          override.weight !== undefined &&
          (typeof override.weight !== 'number' || override.weight < 0)
        ) {
          at(`rules.${id}.weight`, 'expected a number >= 0');
        }
        if (override.symbols !== undefined) {
          if (id !== 'NOB-201') {
            at(`rules.${id}.symbols`, 'only NOB-201 accepts a symbols list');
          } else if (
            !Array.isArray(override.symbols) ||
            override.symbols.some((s) => typeof s !== 'string')
          ) {
            at(`rules.${id}.symbols`, 'expected a list of strings');
          }
        }
        for (const key of Object.keys(override)) {
          if (!['enabled', 'severity', 'weight', 'symbols'].includes(key)) {
            at(`rules.${id}.${key}`, 'unknown key. Expected: enabled, severity, weight, symbols');
          }
        }
      }
    }
  }

  if (cfg.thresholds !== undefined) {
    if (!isPlainObject(cfg.thresholds)) {
      at('thresholds', 'expected a mapping with keys block and warn');
    } else {
      for (const key of ['block', 'warn']) {
        const v = cfg.thresholds[key];
        if (v !== undefined && (typeof v !== 'number' || v < 0)) {
          at(`thresholds.${key}`, 'expected a number >= 0');
        }
      }
      const b = cfg.thresholds.block;
      const w = cfg.thresholds.warn;
      if (typeof b === 'number' && typeof w === 'number' && w > b) {
        at('thresholds', `warn (${w}) must not be greater than block (${b})`);
      }
    }
  }

  if (cfg.report !== undefined) {
    if (!isPlainObject(cfg.report)) {
      at('report', 'expected a mapping with keys max_findings and comment_mode');
    } else {
      const mf = cfg.report.max_findings;
      if (mf !== undefined && (typeof mf !== 'number' || mf < 1)) {
        at('report.max_findings', 'expected a number >= 1');
      }
      const cm = cfg.report.comment_mode;
      if (cm !== undefined && !COMMENT_MODES.includes(cm as CommentMode)) {
        at(
          'report.comment_mode',
          `expected one of ${COMMENT_MODES.join(' | ')}, got ${JSON.stringify(cm)}`,
        );
      }
    }
  }

  if (problems.length > 0) {
    throw new ConfigError(
      `${source} has ${problems.length} problem${problems.length === 1 ? '' : 's'}:`,
      problems,
    );
  }
  return cfg as UserConfig;
}
