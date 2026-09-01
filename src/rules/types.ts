import type { Finding, FileKind, Line, Severity } from '../types.js';
import type { ResolvedConfig } from '../config/schema.js';
import type { LanguageAdapter, Tree } from '../parsers/types.js';
import type { ParsedFile } from '../diff/parse.js';
import type { Matchers } from '../diff/classify.js';

/** One side of a file: its text, and its AST if a rule asked for one. */
export interface FileSnapshot {
  source: string;
  /** Populated lazily -- only files a rule actually needs an AST for get parsed. */
  tree?: Tree;
  adapter?: LanguageAdapter;
}

export interface ChangedFile extends ParsedFile {
  kind: FileKind;
  isSecurityPath: boolean;
}

/** The rule's own metadata after user config overrides have been applied. */
export interface ResolvedRule {
  id: string;
  title: string;
  severity: Severity;
  weight: number;
}

export interface RuleContext {
  file: ChangedFile;
  before?: FileSnapshot;
  after?: FileSnapshot;
  /** Path of the paired test file, plus whether this diff touched it. */
  pairedTest?: { path: string; changed: boolean; file?: ChangedFile };
  addedLines: Line[];
  removedLines: Line[];
  config: ResolvedConfig;
  rule: ResolvedRule;
  matchers: Matchers;
  /** True when the before-blob could not be retrieved; before-dependent rules must bail. */
  degraded: boolean;
  /** Every file in the diff, for the few rules that need cross-file context. */
  allFiles: ChangedFile[];
}

export interface Rule {
  id: string;
  title: string;
  defaultSeverity: Severity;
  weight: number;
  requiresAst: boolean;
  appliesTo: FileKind[];
  /** One sentence for the report's "why this rule exists" detail block. */
  rationale: string;
  run(ctx: RuleContext): Finding[];
}

/** The comment a user pastes to silence a finding. Reason is mandatory (spec §8). */
export function suppressionFor(ruleId: string, commentToken = '//'): string {
  return `${commentToken} nobble-ignore ${ruleId}: <reason>`;
}

export type { Finding, FileKind, Severity, Line };
