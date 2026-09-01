import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    // Fixture trees contain files literally named `*.test.ts` -- they are INPUT to the
    // suite, not part of it. Without this vitest tries to execute them.
    exclude: ['test/fixtures/**', 'node_modules/**', 'dist/**'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/rules/**', 'src/engine/**'],
      thresholds: { lines: 85, functions: 85, branches: 75, statements: 85 },
    },
  },
});
