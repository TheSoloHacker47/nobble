import { describe, it, expect } from 'vitest';
import { findPairedTest } from '../../src/engine/pairing.js';
import { buildMatchers } from '../../src/diff/classify.js';
import { defaultConfig } from '../../src/config/load.js';

const isTest = buildMatchers(defaultConfig()).isTest;
const pair = (src: string, tracked: string[]) =>
  findPairedTest(src, isTest, { trackedFiles: tracked });

describe('source-to-test pairing', () => {
  it('heuristic 1: JS/TS sibling and test-root layouts', () => {
    expect(pair('src/foo/bar.ts', ['src/foo/bar.ts', 'src/foo/bar.test.ts'])).toBe(
      'src/foo/bar.test.ts',
    );
    expect(pair('src/foo/bar.ts', ['src/foo/bar.spec.ts'])).toBe('src/foo/bar.spec.ts');
    expect(pair('src/foo/bar.ts', ['test/foo/bar.test.ts'])).toBe('test/foo/bar.test.ts');
    expect(pair('src/foo/bar.ts', ['__tests__/foo/bar.test.ts'])).toBe('__tests__/foo/bar.test.ts');
  });

  it('heuristic 2: Ruby spec and test layouts', () => {
    expect(pair('app/models/user.rb', ['spec/models/user_spec.rb'])).toBe(
      'spec/models/user_spec.rb',
    );
    expect(pair('app/models/user.rb', ['test/models/user_test.rb'])).toBe(
      'test/models/user_test.rb',
    );
  });

  it('heuristic 3: Python test layouts', () => {
    expect(pair('pkg/thing.py', ['tests/test_thing.py'])).toBe('tests/test_thing.py');
    expect(pair('pkg/thing.py', ['pkg/test_thing.py'])).toBe('pkg/test_thing.py');
  });

  it('heuristic 4: basename match anywhere, but only when unambiguous', () => {
    expect(pair('src/deep/nested/widget.ts', ['some/other/place/widget.test.ts'])).toBe(
      'some/other/place/widget.test.ts',
    );
    // Two candidates is ambiguous, so it must refuse rather than guess.
    expect(pair('src/deep/widget.ts', ['a/widget.test.ts', 'b/widget.spec.ts'])).toBeUndefined();
  });

  it('returns undefined rather than guessing when nothing matches', () => {
    expect(pair('src/foo/bar.ts', ['src/foo/bar.ts', 'src/unrelated.test.ts'])).toBeUndefined();
  });

  it('will not fall back to a short basename, which matches too much', () => {
    // `src/a.ts` -> `test/a.test.ts` is still a legitimate heuristic-1 hit...
    expect(pair('src/a.ts', ['test/a.test.ts'])).toBe('test/a.test.ts');
    // ...but a two-letter basename must never trigger the repo-wide heuristic-4 scan,
    // or every `id.ts` in a monorepo pairs with somebody else's `id.test.ts`.
    expect(pair('src/deep/nested/id.ts', ['unrelated/corner/id.test.ts'])).toBeUndefined();
  });
});
