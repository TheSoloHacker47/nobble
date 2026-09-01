<p align="center">
  <img src="https://raw.githubusercontent.com/TheSoloHacker47/nobble/main/docs/assets/nobble-banner.png" alt="Nobble — catch weakened tests before they merge" width="100%">
</p>

<p align="center">
  <a href="https://github.com/TheSoloHacker47/nobble/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/TheSoloHacker47/nobble/ci.yml?branch=main&style=flat-square&label=build" alt="Build status"></a>
  <a href="https://www.npmjs.com/package/nobble"><img src="https://img.shields.io/npm/v/nobble?style=flat-square&color=32c7e8" alt="npm version"></a>
  <a href="https://www.npmjs.com/package/nobble"><img src="https://img.shields.io/npm/dm/nobble?style=flat-square&color=65e6bd" alt="Monthly npm downloads"></a>
  <a href="https://github.com/TheSoloHacker47/nobble/releases"><img src="https://img.shields.io/github/v/release/TheSoloHacker47/nobble?style=flat-square&color=f7b955" alt="GitHub release"></a>
  <a href="https://github.com/TheSoloHacker47/nobble/blob/main/LICENSE"><img src="https://img.shields.io/github/license/TheSoloHacker47/nobble?style=flat-square" alt="MIT license"></a>
</p>

<p align="center"><strong>A deterministic GitHub Action and CLI that catches pull requests where tests were weakened instead of fixed.</strong></p>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#what-nobble-catches">Rules</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#action-reference">Action reference</a> ·
  <a href="https://www.npmjs.com/package/nobble">npm</a>
</p>

---

To **nobble** is to tamper with a racehorse before a race so it cannot win. The same thing happens to a test suite when someone edits it just to stop it failing.

```diff
 it('charges the card', () => {
-  expect(charge()).toBe(1000);
-  expect(fee()).toBe(30);
-  expect(receipt()).toEqual({ id: 1, total: 1030 });
+  expect(charge()).toBeTruthy();
 });
```

The suite is green. The assertion is not. Nobble puts that change at the top of the review.

## Why Nobble

Large, AI-assisted pull requests can hide tiny changes that make a test suite easier to pass: a deleted assertion, a skipped test, an authorization mock, a lower coverage threshold, or `continue-on-error: true`. Nobble is built for that one review gap.

| Focused                                                         | Private by design                                                       | Predictable                                            | Safe to adopt                                             |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------- |
| 16 rules for test, security, source, coverage, and CI weakening | Runs inside your workflow; no model calls and no code sent to a service | Static rules produce the same result for the same diff | Reports without failing CI until you opt into enforcement |

<p align="center">
  <img src="https://raw.githubusercontent.com/TheSoloHacker47/nobble/main/docs/assets/how-nobble-works.svg" alt="Nobble reads a diff, detects weakening, scores risk, and reports in the pull request" width="100%">
</p>

## Quick start

Add `.github/workflows/nobble.yml`:

```yaml
name: Nobble

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with:
          fetch-depth: 0
      - uses: TheSoloHacker47/nobble@v1
```

That is enough for a sticky PR comment and workflow annotations. The default is deliberately non-blocking.

Prefer the CLI?

```bash
npx nobble --base main
```

No install is required. Nobble needs Node.js 20 or newer when used as a CLI.

## See it in a pull request

<p align="center">
  <a href="https://github.com/TheSoloHacker47/nobble/pull/1">
    <img src="https://raw.githubusercontent.com/TheSoloHacker47/nobble/main/docs/pr-comment.png" alt="A real Nobble pull request comment with five findings" width="880">
  </a>
</p>

<p align="center"><sub>A real comment from <a href="https://github.com/TheSoloHacker47/nobble/pull/1">pull request #1</a>, which intentionally weakens the payment suite.</sub></p>

## What Nobble catches

| Area                            | Rules           | Examples                                                                        |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------- |
| **Assertions & tests**          | `NOB-101`–`105` | Assertions removed or weakened, tests deleted or skipped, expectations inverted |
| **Security boundaries**         | `NOB-201`–`203` | Sensitive mocks, untested security-path changes, early-return bypasses          |
| **Escape hatches**              | `NOB-301`–`303` | Blanket suppressions, swallowed exceptions, fixed sleeps                        |
| **Coverage, CI & dependencies** | `NOB-401`–`404` | Lower thresholds, neutralized checks, excluded tests, weakened lockfiles        |
| **Suppression hygiene**         | `NOB-001`       | A `nobble-ignore` comment without a reason                                      |

<details>
<summary><strong>View all 16 rules and default weights</strong></summary>

| Rule      | Severity | Weight | Fires when…                                                         |
| --------- | -------- | -----: | ------------------------------------------------------------------- |
| `NOB-101` | high     |     30 | Assertions are removed from a test that still exists                |
| `NOB-102` | high     |     30 | A precise assertion becomes a weaker one                            |
| `NOB-103` | high     |     25 | A test block is deleted without a similar replacement               |
| `NOB-104` | high     |     25 | A test is disabled with `skip`, `todo`, `pending`, or an equivalent |
| `NOB-105` | medium   |     15 | An expectation is inverted instead of satisfied                     |
| `NOB-201` | critical |     40 | A mock is introduced around a sensitive symbol                      |
| `NOB-202` | high     |     25 | Security-path code changes without corresponding test coverage      |
| `NOB-203` | high     |     25 | An unconditional early exit is added to a security function         |
| `NOB-301` | medium   |     10 | A blanket type or lint suppression is added                         |
| `NOB-302` | medium   |     15 | An empty or log-only exception handler is added                     |
| `NOB-303` | low      |      8 | A fixed sleep is added to a test                                    |
| `NOB-401` | high     |     30 | A coverage threshold is lowered                                     |
| `NOB-402` | critical |     40 | A CI test or check is made non-failing                              |
| `NOB-403` | high     |     25 | A test path is added to an ignore list                              |
| `NOB-404` | medium   |     15 | Lockfile integrity is removed or a dependency drops a major version |
| `NOB-001` | low      |      5 | A Nobble suppression has no explanation                             |

</details>

Scores are the sum of finding weights, capped at 100: **0 = pass**, **1–39 = warn**, **40+ = block**.

## Built for signal, not noise

Nobble reports what changed in the diff; it does not guess why the author changed it. Its rules were calibrated against 150 merged pull requests from Vite, Flask, and Sinatra.

<p align="center">
  <img src="https://raw.githubusercontent.com/TheSoloHacker47/nobble/main/docs/assets/calibration-chart.svg" alt="Calibration results: 5.3 percent of all pull requests had findings, 16.7 percent of test-touching pull requests had findings, and 2 percent reached block" width="100%">
</p>

The three PRs that reached `block` were changes worth a reviewer’s attention: one was titled “Skip broken tests,” one reverted it, and one deleted two test cases. Reproduce the sample yourself with `npm run smoke -- --limit 50 --verbose`.

## Language support

| Language                    | Analysis        | Test frameworks                                                |
| --------------------------- | --------------- | -------------------------------------------------------------- |
| TypeScript, JavaScript, TSX | tree-sitter AST | Jest, Vitest, Mocha, Chai                                      |
| Python                      | tree-sitter AST | pytest, unittest                                               |
| Ruby                        | tree-sitter AST | RSpec, Minitest                                                |
| Everything else             | regex fallback  | Language-independent skip, suppression, coverage, and CI rules |

## Start reporting, then enforce

Nobble exits successfully by default. Once your team is comfortable with the signal, enable blocking:

```yaml
- uses: TheSoloHacker47/nobble@v1
  with:
    fail-on: block
```

To suppress a finding, leave a reason in the diff:

```ts
// nobble-ignore NOB-102: rewriting this suite for the new API shape, see #482
```

The reason is mandatory. An empty reason triggers `NOB-001` and leaves the original finding active.

## Configuration

Everything is optional. Create `.nobble.yml` at the repository root only when you need to tune the defaults:

```yaml
version: 1

fail_on: none # none | warn | block

paths:
  tests: # replaces built-in test globs
    - 'spec/**'
    - '**/*.test.ts'
  security: # replaces built-in security globs
    - 'app/policies/**'
    - 'app/middleware/**'
  ignore:
    - 'vendor/**'
    - 'db/schema.rb'

rules:
  NOB-303:
    enabled: false
  NOB-301:
    severity: low
  NOB-201:
    symbols: # appends to the built-in sensitive-symbol list
      - 'billing_account'
      - 'feature_flag'

thresholds:
  block: 40
  warn: 1

report:
  max_findings: 20
  comment_mode: sticky # sticky | new | none
```

## Action reference

### Inputs

| Input          | Default               | Description                                                            |
| -------------- | --------------------- | ---------------------------------------------------------------------- |
| `fail-on`      | `none`                | Exit non-zero for `warn` or `block`, or keep the Action reporting-only |
| `config`       | `.nobble.yml`         | Path to the configuration file                                         |
| `comment`      | `true`                | Post the pull request comment                                          |
| `github-token` | `${{ github.token }}` | Token used to write the sticky comment                                 |
| `sarif-file`   | `nobble.sarif`        | Path where SARIF output is written                                     |

### Outputs

| Output       | Description                      |
| ------------ | -------------------------------- |
| `score`      | Total risk score from 0 to 100   |
| `verdict`    | `pass`, `warn`, or `block`       |
| `findings`   | JSON array of findings           |
| `sarif-file` | Path to the generated SARIF file |

Use outputs in later steps by assigning an `id`:

```yaml
- uses: TheSoloHacker47/nobble@v1
  id: nobble
- run: echo "Nobble verdict: ${{ steps.nobble.outputs.verdict }}"
```

### Inline code-scanning annotations

Upload Nobble’s SARIF to see findings on exact lines in **Files changed**:

```yaml
permissions:
  contents: read
  pull-requests: write
  security-events: write

steps:
  - uses: actions/checkout@v5
    with:
      fetch-depth: 0
  - uses: TheSoloHacker47/nobble@v1
  - uses: github/codeql-action/upload-sarif@v4
    if: always()
    with:
      sarif_file: nobble.sarif
      category: nobble
```

Code-scanning upload is available for public repositories. Private-repository availability depends on the repository’s GitHub security plan. Nobble’s PR comment and workflow annotations work without SARIF upload.

## CLI reference

```text
npx nobble [options]

  --base <ref>          Base git ref to diff against       [default: origin/HEAD]
  --head <ref>          Head ref                           [default: working tree]
  --diff <file>         Read a unified diff from a file or "-" for stdin
  --config <path>       Config file path                   [default: .nobble.yml]
  --format <fmt>        terminal | markdown | json | sarif [default: terminal]
  --fail-on <level>     none | warn | block                [default: none]
  --rules <ids>         Comma-separated allowlist of rule IDs
  --quiet               Print findings without the summary
  --version, --help
```

## How Nobble is different

| Tool           | What it answers                            | What Nobble adds                                                |
| -------------- | ------------------------------------------ | --------------------------------------------------------------- |
| Linters        | “Does this code follow our rules?”         | Compares tests with their previous version to find weakening    |
| Coverage gates | “Did the percentage move?”                 | Finds semantic weakening even when the line stays covered       |
| AI review bots | “What does a model think about this diff?” | Deterministic, offline rules with no inference or data transfer |

Nobble deliberately does **not** detect AI authorship, run tests, score style, measure coverage, auto-fix code, or operate a hosted service.

## Contributing

Issues and pull requests are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md); every new rule needs positive and negative fixtures. Design tradeoffs and spec deviations are documented in [DECISIONS.md](DECISIONS.md).

## License

[MIT](LICENSE) © TheSoloHacker47
