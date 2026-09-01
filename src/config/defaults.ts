import type { Severity } from '../types.js';

/** Spec §5: a file is a test file if its path matches any of these. */
export const DEFAULT_TEST_GLOBS = [
  '**/*_test.{js,ts,jsx,tsx,py,go,rb}',
  '**/*.test.{js,ts,jsx,tsx}',
  '**/*.spec.{js,ts,jsx,tsx,rb}',
  '**/test_*.py',
  '**/{test,tests,spec,__tests__}/**',
];

/** Spec §6, NOB-202. */
export const DEFAULT_SECURITY_GLOBS = [
  '**/{auth,authz,authentication,authorization,security,middleware,policies,permissions}/**',
  '**/*{auth,policy,permission,guard,session,token}*.{js,ts,rb,py,go}',
];

/** Spec §6, NOB-201. Matched case-insensitively against a mock target. */
export const DEFAULT_SENSITIVE_SYMBOLS = [
  'auth',
  'authn',
  'authz',
  'authorize',
  'authenticate',
  'permission',
  'policy',
  'can\\?',
  'ability',
  'current_user',
  'session',
  'token',
  'jwt',
  'csrf',
  'verify',
  'validate_signature',
  'signature',
  'encrypt',
  'decrypt',
  'password',
  'secret',
  'credential',
  'rbac',
  'guard',
  'tenant',
  'owner',
];

export const DEFAULT_IGNORE_GLOBS: string[] = [];

/** Paths that are coverage configuration for the purposes of NOB-401. */
export const COVERAGE_CONFIG_GLOBS = [
  '**/jest.config.{js,cjs,mjs,ts,json}',
  '**/vitest.config.{js,cjs,mjs,ts}',
  '**/.simplecov',
  '**/.coveragerc',
  '**/codecov.{yml,yaml}',
  '**/.codecov.{yml,yaml}',
  '**/sonar-project.properties',
  '**/pyproject.toml',
  '**/.nycrc{,.json,.yml,.yaml}',
  '**/setup.cfg',
  '**/package.json',
];

/** Paths that are CI configuration for the purposes of NOB-402. */
export const CI_CONFIG_GLOBS = [
  '.github/workflows/**',
  '**/.gitlab-ci.yml',
  '.circleci/**',
  '**/azure-pipelines.yml',
  '**/Jenkinsfile',
];

export const DEFAULT_THRESHOLDS = { block: 40, warn: 1 };
export const DEFAULT_MAX_FINDINGS = 20;
export const DEFAULT_COMMENT_MODE = 'sticky' as const;
export const DEFAULT_FAIL_ON = 'none' as const;

/** Rule metadata defaults live on the rules themselves; this is only the config surface. */
export interface RuleOverride {
  enabled?: boolean;
  severity?: Severity;
  weight?: number;
  /** NOB-201 only. Appended to DEFAULT_SENSITIVE_SYMBOLS, per spec §8. */
  symbols?: string[];
}
