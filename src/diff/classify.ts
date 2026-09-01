import picomatch from 'picomatch';
import type { FileKind } from '../types.js';
import type { ResolvedConfig } from '../config/schema.js';
import { COVERAGE_CONFIG_GLOBS, CI_CONFIG_GLOBS } from '../config/defaults.js';

export interface Matchers {
  isTest: (p: string) => boolean;
  isSecurity: (p: string) => boolean;
  isIgnored: (p: string) => boolean;
  isCoverageConfig: (p: string) => boolean;
  isCiConfig: (p: string) => boolean;
}

/** Compiled once per run; picomatch compilation is not free and paths are matched a lot. */
export function buildMatchers(config: ResolvedConfig): Matchers {
  const opts = { dot: true, posixSlashes: true };
  const any = (globs: string[]) => {
    if (globs.length === 0) return () => false;
    const m = picomatch(globs, opts);
    return (p: string) => m(p);
  };
  return {
    isTest: any(config.testGlobs),
    isSecurity: any(config.securityGlobs),
    isIgnored: any(config.ignoreGlobs),
    isCoverageConfig: any(COVERAGE_CONFIG_GLOBS),
    isCiConfig: any(CI_CONFIG_GLOBS),
  };
}

const DOC_EXTENSIONS = new Set(['.md', '.mdx', '.txt', '.rst', '.adoc']);
const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.rb',
  '.go',
  '.java',
  '.kt',
  '.cs',
  '.php',
  '.rs',
  '.swift',
  '.scala',
  '.ex',
  '.exs',
]);

function extname(p: string): string {
  const slash = p.lastIndexOf('/');
  const dot = p.lastIndexOf('.');
  return dot > slash ? p.slice(dot).toLowerCase() : '';
}

/**
 * Order matters. CI config is checked before coverage config because a workflow file under
 * `.github/workflows/` can also look like generic YAML, and before test globs because a
 * repo whose test glob is `**\/test/**` would otherwise swallow `.github/workflows/test.yml`.
 */
export function classify(filePath: string, m: Matchers): FileKind {
  if (m.isCiConfig(filePath)) return 'ci_config';
  if (m.isTest(filePath)) return 'test';
  if (m.isCoverageConfig(filePath)) return 'coverage_config';

  const ext = extname(filePath);
  if (DOC_EXTENSIONS.has(ext)) return 'other';
  if (CODE_EXTENSIONS.has(ext)) return 'source';
  return 'other';
}
