# Nobble

[![CI](https://github.com/TheSoloHacker47/nobble/actions/workflows/ci.yml/badge.svg)](https://github.com/TheSoloHacker47/nobble/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/nobble.svg)](https://www.npmjs.com/package/nobble)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

**Catches nobbled tests.** Nobble reads a pull request diff and flags changes where the
tests were weakened to make the code pass, rather than the code being fixed to make the
tests pass.

To nobble is to tamper with a racehorse before a race so it cannot win. That is precisely
what happens to a test suite when someone edits it to stop it failing.

<!-- SCREENSHOT -->

---

## The problem

Reviewing AI-assisted pull requests keeps hitting the same failure mode: the agent cannot
make a test pass, so it edits the test. The change is two lines inside a 1,500-line diff,
and it looks like ordinary test maintenance.

```diff
 it('charges the card', () => {
-  expect(charge()).toBe(1000);
-  expect(fee()).toBe(30);
-  expect(receipt()).toEqual({ id: 1, total: 1030 });
+  expect(charge()).toBeTruthy();
 });
```

The suite is green, the diff is small, and the test now passes for a charge of any non-zero
amount. Nobble puts that at the top of the review.

## Quickstart

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: TheSoloHacker47/nobble@v1
```

Locally:

```bash
npx nobble --base main
```

## What it catches

| Rule      | Severity     | Weight | Fires when                                                                                                                                  |
| --------- | ------------ | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `NOB-101` | high         | 30     | Assertions removed from a test that still exists — `expect(a).toBe(1); expect(b).toBe(2);` becomes just the first                           |
| `NOB-102` | high         | 30     | An assertion replaced with a weaker one — `toBe(1000)` → `toBeTruthy()`, `toHaveBeenCalledWith(id)` → `toHaveBeenCalled()`                  |
| `NOB-103` | high         | 25     | A whole test block deleted — `it('rejects an expired card')` is gone and nothing like it was added back                                     |
| `NOB-104` | high         | 25     | A test disabled — `it.skip`, `xit`, `@pytest.mark.skip`, `pending`, `t.Skip()`, `@Ignore`                                                   |
| `NOB-105` | medium       | 15     | An expectation inverted rather than satisfied — `toBe(y)` → `not.toBe(y)`, `assertEqual` → `assertNotEqual`                                 |
| `NOB-201` | **critical** | 40     | A mock introduced around a sensitive symbol — `jest.mock('../auth/current_user')`, `allow(policy).to receive(:authorize)`                   |
| `NOB-202` | high         | 25     | A security-path file changed while its paired test was untouched, or only lost assertions                                                   |
| `NOB-203` | high         | 25     | An unconditional early exit at the top of a security function — `return true;` above the check it skips                                     |
| `NOB-301` | medium       | 10     | A blanket suppression added — `@ts-ignore`, `as any`, bare `# type: ignore`. Coded ones like `# type: ignore[return-value]` do **not** fire |
| `NOB-302` | medium       | 15     | An empty or log-only `catch` / `except` / `rescue` added around code that used to propagate                                                 |
| `NOB-303` | low          | 8      | A fixed sleep added to a test — `setTimeout`, `time.sleep`. Not flagged when the diff also removes one                                      |
| `NOB-401` | high         | 30     | A coverage threshold lowered in `jest.config.*`, `.coveragerc`, `codecov.yml`, `pyproject.toml`, `sonar-project.properties`                 |
| `NOB-402` | **critical** | 40     | A CI check neutralized — `continue-on-error: true`, `\|\| true` on a test command, a `run:` step with tests removed                         |
| `NOB-403` | high         | 25     | A test path added to an ignore list — `testPathIgnorePatterns`, `.eslintignore`, `norecursedirs`                                            |
| `NOB-404` | medium       | 15     | A lockfile integrity field removed, or a dependency downgraded across a major version                                                       |
| `NOB-001` | low          | 5      | A `nobble-ignore` comment with no reason after the colon                                                                                    |

Score is the sum of weights, capped at 100. **0 = pass, 1–39 = warn, 40+ = block.**

## False positives

Nobble judges the diff, not the author. It cannot know whether a deleted test _should_ have
been deleted — only that it was. So the defaults are built around not being in your way:

**The default posture is non-blocking.** The action comments and exits 0 unless you opt in
with `fail-on: block`. A tool that breaks your CI on day one gets uninstalled on day one.

**Measured finding rate.** Run against the last 50 merged pull requests of
[`vitejs/vite`](https://github.com/vitejs/vite), [`pallets/flask`](https://github.com/pallets/flask),
and [`sinatra/sinatra`](https://github.com/sinatra/sinatra) — 150 ordinary human PRs:

|                                               |                     |
| --------------------------------------------- | ------------------- |
| PRs with at least one finding                 | **5.3%** (8 of 150) |
| PRs that touched a test file and were flagged | 16.7% (7 of 42)     |
| **PRs reaching verdict `block`**              | **2.0%** (3 of 150) |

The three that would block are `sinatra/sinatra#2115` (titled _"Skip broken tests."_), its
revert `#2124`, and `#2114`, which deletes two test cases. All three are changes worth a
reviewer's attention, which is the entire point.

The 16.7% figure is the strict one and is quoted here rather than hidden: among PRs that
touch tests, roughly one in six gets a finding. Every one of those in the sample accurately
described a real event — a test deleted, a test skipped, a blanket suppression added.

Reproduce it yourself:

```bash
npm run smoke -- --limit 50 --verbose
```

**When a finding is wrong**, you have three levers, in increasing order of bluntness:

```ts
// nobble-ignore NOB-102: rewriting this suite for the new API shape, see #482
```

A reason is mandatory. A suppression with nothing after the colon does not suppress
anything — it reports itself as `NOB-001` and leaves the original finding standing. That
keeps the escape hatch honest.

Per-rule config, and whole-rule disabling, are both in `.nobble.yml` below.

## Configuration

Everything is optional. `.nobble.yml` at the repo root:

```yaml
version: 1

fail_on: none # none | block | warn

paths:
  tests: # REPLACES the built-in test globs
    - 'spec/**'
    - '**/*.test.ts'
  security: # REPLACES the built-in security-path globs
    - 'app/policies/**'
    - 'app/middleware/**'
  ignore:
    - 'vendor/**'
    - 'db/schema.rb'

rules:
  NOB-303:
    enabled: false # turn a rule off entirely
  NOB-301:
    severity: low # or downgrade it
  NOB-201:
    symbols: # APPENDS to the default sensitive-symbol list
      - 'billing_account'
      - 'feature_flag'

thresholds:
  block: 40
  warn: 1

report:
  max_findings: 20
  comment_mode: sticky # sticky | new | none
```

Note the asymmetry: `paths.*` replaces the defaults, `NOB-201.symbols` appends to them.

### CLI

```
npx nobble [options]

  --base <ref>          Base git ref to diff against       [default: origin/HEAD]
  --head <ref>          Head ref                           [default: working tree]
  --diff <file>         Read a unified diff from a file or "-" for stdin
  --config <path>       Config file path                   [default: .nobble.yml]
  --format <fmt>        terminal | markdown | json | sarif [default: terminal]
  --fail-on <level>     none | warn | block                [default: none]
  --rules <ids>         Comma separated allowlist of rule IDs to run
  --quiet               Only print findings, no summary
  --version, --help
```

### Inline annotations

To get findings on the lines themselves in Files Changed, upload the SARIF:

```yaml
permissions:
  contents: read
  pull-requests: write
  security-events: write

steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - uses: TheSoloHacker47/nobble@v1
  - uses: github/codeql-action/upload-sarif@v3
    if: always()
    with:
      sarif_file: nobble.sarif
      category: nobble
```

Code scanning upload is free on public repositories; private repositories need GitHub
Advanced Security. Without it, Nobble still posts the PR comment and workflow annotations.

## How it is different

**Linters** check that code follows conventions. Nobble does not care about conventions; it
compares a test file against its own previous version and reports what got weaker.

**Coverage gates** tell you a percentage moved. They cannot tell you that
`expect(total).toBe(1030)` became `expect(total).toBeTruthy()` — the line is still covered.
Nobble detects tampering with the coverage _configuration_ but never measures coverage.

**AI code review bots** send your diff to a model and return prose. Nobble makes no network
calls, runs no inference, and sends your code nowhere. Same input, same output, every time.

It targets exactly one failure mode. Everything in §2 of the [spec](nobble-spec.md) —
detecting AI authorship, style scoring, running your tests, auto-fixing — is deliberately
out of scope.

## Writing a custom rule

A rule is one object. Implement `Rule`, add it to the registry in `src/rules/register.ts`,
and nothing else changes:

```ts
import type { Rule } from './types.js';
import { makeFinding } from './helpers.js';

export const nob999: Rule = {
  id: 'NOB-999',
  title: 'Snapshot obsoleted rather than updated',
  defaultSeverity: 'medium',
  weight: 15,
  requiresAst: false,
  appliesTo: ['test'],
  rationale: 'Deleting a snapshot file makes the assertion vacuous instead of reviewing it.',

  run(ctx) {
    return ctx.addedLines
      .filter((line) => /toMatchSnapshot\(\)/.test(line.text))
      .map((line) =>
        makeFinding(ctx, {
          line: line.line,
          message: `Snapshot assertion added in \`${ctx.file.path}\`.`,
          after: line.text,
        }),
      );
  },
};
```

`ctx` carries the parsed diff, the before and after file contents, both ASTs when the
language has an adapter, the paired test file, and the resolved config. Adding a _language_
is the same shape: implement `LanguageAdapter`, register it, change nothing else.

## Language support

| Language                      | Parser      | Frameworks                                                                            |
| ----------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| TypeScript / JavaScript / TSX | tree-sitter | Jest, Vitest, Mocha, Chai                                                             |
| Ruby                          | tree-sitter | RSpec, Minitest                                                                       |
| Python                        | tree-sitter | pytest, unittest                                                                      |
| Everything else               | regex       | The rules that need no AST still run: skips, suppressions, coverage config, CI config |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Every rule needs at least three positive and three
negative fixtures; the negatives are the ones that matter. [DECISIONS.md](DECISIONS.md)
records every ambiguity resolved while building this, including the two places the original
spec turned out to be wrong about the world.

MIT licensed.
