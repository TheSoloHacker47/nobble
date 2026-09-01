import { describe, it, expect } from 'vitest';
import { buildMatchers, classify } from '../../src/diff/classify.js';
import { defaultConfig } from '../../src/config/load.js';

const m = buildMatchers(defaultConfig());
const kind = (p: string) => classify(p, m);

describe('file classification', () => {
  it('recognizes test files across the default globs', () => {
    for (const p of [
      'src/foo/bar.test.ts',
      'src/foo/bar.spec.tsx',
      'lib/thing_test.rb',
      'pkg/thing_test.go',
      'tests/test_thing.py',
      'spec/models/user_spec.rb',
      'app/__tests__/helper.ts',
      'test/e2e/flow.ts',
    ]) {
      expect(kind(p), p).toBe('test');
    }
  });

  it('recognizes source files', () => {
    for (const p of ['src/index.ts', 'app/models/user.rb', 'pkg/service.py', 'internal/a.go']) {
      expect(kind(p), p).toBe('source');
    }
  });

  it('recognizes CI config, and prefers it over test globs', () => {
    // `.github/workflows/test.yml` matches nothing test-ish by extension, but a repo with a
    // broad `**/test/**` glob must still see it as CI config.
    expect(kind('.github/workflows/ci.yml')).toBe('ci_config');
    expect(kind('.github/workflows/test.yml')).toBe('ci_config');
    expect(kind('.gitlab-ci.yml')).toBe('ci_config');
    expect(kind('.circleci/config.yml')).toBe('ci_config');
  });

  it('recognizes coverage config', () => {
    for (const p of [
      'jest.config.js',
      'vitest.config.ts',
      '.coveragerc',
      'codecov.yml',
      'pyproject.toml',
      'sonar-project.properties',
      'package.json',
    ]) {
      expect(kind(p), p).toBe('coverage_config');
    }
  });

  it('treats docs and unknown files as other', () => {
    expect(kind('README.md')).toBe('other');
    expect(kind('docs/guide.rst')).toBe('other');
    expect(kind('assets/logo.svg')).toBe('other');
    expect(kind('Dockerfile')).toBe('other');
  });

  it('matches the default security globs', () => {
    for (const p of [
      'app/policies/admin_policy.rb',
      'src/middleware/auth.ts',
      'lib/authorization/check.py',
      'src/session_token.ts',
    ]) {
      expect(m.isSecurity(p), p).toBe(true);
    }
    expect(m.isSecurity('src/utils/format.ts')).toBe(false);
  });
});
