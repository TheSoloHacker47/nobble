# The original build specification

> **Historical document.** This is the specification Nobble was built from, written
> before any code existed and preserved unedited. It is published because the
> specification, rather than the code, is where the design decisions live.
>
> **It is not documentation.** For what Nobble does today, read the
> [README](README.md). For the decisions taken while building it, including the ones
> that departed from this document, read [DECISIONS.md](DECISIONS.md) — the spec
> required that every ambiguous call be recorded there, and it was.
>
> The constraints it sets are the interesting part: build exactly what is specified
> and nothing more, resolve genuine ambiguity by choosing the simpler option, and pass
> each milestone's exit criteria before starting the next.

---

## 1. What this is

Nobble is a CLI and GitHub Action that reads a pull request diff and flags changes where **the tests were weakened to make the code pass**, rather than the code being fixed to make the tests pass.

It is a static, deterministic tool. No LLM calls in the core. It runs offline, sends no data anywhere, and finishes in under 5 seconds on a typical PR.

### The problem in one paragraph

Teams reviewing AI-assisted pull requests keep hitting the same failure mode: the agent cannot make a test pass, so it edits the test. Assertions get deleted or weakened, tests get skipped, authorization gets mocked out, coverage thresholds get lowered, and CI steps get `continue-on-error: true`. Each of these is a two-line diff buried inside a 1,500-line PR, and the human reviewer misses it. Nobble surfaces exactly these changes at the top of the review.

### Success looks like

A reviewer opens a PR and sees a single comment saying: `2 findings. Tests for PaymentAuthorizer were weakened (3 assertions removed) and a mock was introduced around current_user.` They click through to the two exact lines. Total setup cost for that team was pasting six lines into a workflow file.

---

## 2. Non-goals

Do not build any of these. They are explicitly out of scope.

- Detecting whether code was written by AI. Nobble judges the diff, not the author.
- General linting, style checking, or code quality scoring. Existing tools do that.
- Running the test suite. Nobble never executes user code.
- Measuring code coverage. It only detects tampering with coverage _configuration_.
- Any LLM inference in the core detection path.
- A hosted service, dashboard, or database.
- Auto-fixing anything.

---

## 3. Naming and repo

- **Package name:** `nobble` (verified available on npm as of writing).
- **Origin, for the README:** to nobble is to tamper with a racehorse before a race so it cannot win. That is precisely what happens to a test suite when someone edits it to stop it failing. Use this in the README opener, one sentence, no elaboration.
- **Tagline:** "Catches nobbled tests."
- **Backup names if taken:** `declaw`, `hamstring`, `gutted`.
- **Repo:** `nobble`, MIT license, public.
- Rule IDs use the `NOB-` prefix and are permanent.
- The npm package, the CLI binary, and the GitHub Action all live in one repository.

---

## 4. Technology choices

| Concern      | Choice                                             | Reason                                                                       |
| ------------ | -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Language     | TypeScript, strict mode                            | Required for a JS GitHub Action, and gives the widest install base via `npx` |
| Runtime      | Node 20+                                           | Node 20 is the current GitHub Action runtime                                 |
| Parsing      | `web-tree-sitter` with WASM grammars               | One parser API across every target language, no native build step            |
| Diff parsing | `parse-diff` or a hand written unified-diff parser | Small dependency surface                                                     |
| Config       | YAML via `yaml`                                    | Familiar to the target user                                                  |
| Testing      | Vitest                                             | Fast, good snapshot support                                                  |
| Bundling     | esbuild into a single `dist/index.js`              | GitHub Actions require committed bundled output                              |
| Lint/format  | ESLint + Prettier                                  | Standard                                                                     |

Keep runtime dependencies under 10 packages. Every dependency added must be justified in `DECISIONS.md`.

### Language support

Ship v1 with full AST support for:

1. **JavaScript / TypeScript** (Jest, Vitest, Mocha)
2. **Ruby** (RSpec, Minitest)
3. **Python** (pytest, unittest)

Everything else falls back to a regex analyzer that only runs the rules that do not need an AST (skips, coverage config, CI config). The architecture must make adding a fourth language a matter of writing one grammar adapter file, nothing more.

---

## 5. How it works

```
                  ┌──────────────┐
  git diff  ───▶  │ Diff Parser  │ ──▶ ChangedFile[]
                  └──────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ Classifier   │ ──▶ TEST | SOURCE | COVERAGE_CONFIG | CI_CONFIG | OTHER
                  └──────────────┘
                          │
                          ▼
   before blob ──▶ ┌──────────────┐
   after blob  ──▶ │ Parsers      │ ──▶ AST pair per file
                  └──────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ Rule Engine  │ ──▶ Finding[]
                  └──────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ Scorer       │ ──▶ Verdict (pass | warn | block)
                  └──────────────┘
                          │
                          ▼
             Reporters: terminal | markdown | json | sarif
```

### Key input requirement

Several rules need to compare the file **before** and **after**, not just read the diff hunks. The tool must be able to fetch both blobs. In git context use `git show <base>:<path>`. In GitHub Action context use the checkout that the action already has, with `git fetch origin <base_ref> --depth=1`. If the before-blob cannot be retrieved, degrade to diff-only rules and note the degradation in the report.

### File classification

A file is a **test file** if its path matches any configured test glob. Defaults:

```
**/*_test.{js,ts,jsx,tsx,py,go,rb}
**/*.test.{js,ts,jsx,tsx}
**/*.spec.{js,ts,jsx,tsx,rb}
**/test_*.py
**/{test,tests,spec,__tests__}/**
```

A **source file** is any tracked code file that is not a test file, config, or documentation.

### Source-to-test pairing

Used by NOB-101. Try these heuristics in order and stop at the first hit:

1. `src/foo/bar.ts` → `src/foo/bar.test.ts`, `src/foo/bar.spec.ts`, `test/foo/bar.test.ts`, `__tests__/foo/bar.test.ts`
2. `app/models/user.rb` → `spec/models/user_spec.rb`, `test/models/user_test.rb`
3. `pkg/thing.py` → `tests/test_thing.py`, `pkg/test_thing.py`
4. Basename match anywhere in the repo, only if exactly one candidate exists.

If no pair is found, skip the paired rules for that file. Never guess.

---

## 6. The rules

Every rule has a stable ID, a default severity, and a weight. Users can disable, downgrade, or upgrade any rule in config. Rule IDs are permanent and must never be reused.

### Group 1: Assertion tampering (needs AST)

**NOB-101 Assertions removed from an existing test**
Severity: `high`. Weight: 30.
The count of assertion calls inside a named test block decreased between before and after, and the test block still exists. Fires per test block, not per assertion.
Assertion detection per language:

- JS/TS: `expect(...)`, `assert.*`, `chai.expect`, `should`
- Ruby: `expect(...)`, `assert*`, `refute*`, `is_expected`
- Python: bare `assert`, `self.assert*`, `pytest.raises` as context

**NOB-102 Assertion weakened**
Severity: `high`. Weight: 30.
A specific assertion was replaced with a strictly weaker one at the same position. Maintain a per-language weakening table:

| Language | Strong                             | Weak                                                                       |
| -------- | ---------------------------------- | -------------------------------------------------------------------------- |
| JS/TS    | `toBe`, `toEqual`, `toStrictEqual` | `toBeDefined`, `toBeTruthy`, `toBeFalsy`, `not.toBeNull`, `toBeInstanceOf` |
| JS/TS    | `toHaveBeenCalledWith`             | `toHaveBeenCalled`                                                         |
| Ruby     | `eq`, `match`, `have_attributes`   | `be_truthy`, `be_present`, `be_a`, `not_to be_nil`                         |
| Python   | `assertEqual`                      | `assertTrue`, `assertIsNotNone`                                            |

Also fires when an exact-value comparison becomes an `any`/`anything`/`instance_of` matcher.

**NOB-103 Whole test block deleted**
Severity: `high`. Weight: 25.
A named `it` / `test` / `describe` / `def test_*` block present before is absent after, and no block with a similar name was added elsewhere in the file (use normalized-name matching so renames do not fire).

**NOB-104 Test disabled or skipped**
Severity: `high`. Weight: 25.
An added line introduces a skip: `it.skip`, `xit`, `xdescribe`, `describe.skip`, `test.todo`, `@pytest.mark.skip`, `@pytest.mark.xfail`, `@unittest.skip`, `skip`/`pending` in RSpec, `t.Skip()`, `@Ignore`.
This rule works on regex alone and must run for unsupported languages too.

**NOB-105 Expected-failure inversion**
Severity: `medium`. Weight: 15.
A test's expectation was inverted rather than fixed: `expect(x).toBe(y)` became `expect(x).not.toBe(y)`, or `assertEqual` became `assertNotEqual`, or an RSpec `to` became `not_to`.

### Group 2: Security and boundary mocking (needs AST)

**NOB-201 Mock introduced around a sensitive symbol**
Severity: `critical`. Weight: 40.
A new mock, stub, spy, or double was added whose target matches the sensitive-symbol list. Mock constructs: `jest.mock`, `vi.mock`, `sinon.stub`, `allow(...).to receive`, `instance_double`, `unittest.mock.patch`, `monkeypatch.setattr`.
Default sensitive-symbol patterns (case insensitive, configurable):

```
auth, authn, authz, authorize, authenticate, permission, policy, can\?, ability,
current_user, session, token, jwt, csrf, verify, validate_signature, signature,
encrypt, decrypt, password, secret, credential, rbac, guard, tenant, owner
```

**NOB-202 Security-path source change with no new test coverage**
Severity: `high`. Weight: 25.
A source file matching the security-path globs was modified, and its paired test file was either untouched or only had assertions removed.
Default security-path globs:

```
**/{auth,authz,authentication,authorization,security,middleware,policies,permissions}/**
**/*{auth,policy,permission,guard,session,token}*.{js,ts,rb,py,go}
```

**NOB-203 Early return or bypass added in a security path**
Severity: `high`. Weight: 25.
An added line in a security-path file introduces an unconditional early exit (`return true`, `return next()`, `return`, `pass`, `head :ok`) at the top of a function body, or wraps a check in an `if false` / feature-flag-always-on pattern.

### Group 3: Escape hatches in source (needs AST or regex)

**NOB-301 Type or lint suppression added**
Severity: `medium`. Weight: 10. Fires once per file, not per occurrence.
Added lines contain `@ts-ignore`, `@ts-expect-error`, `as any`, `: any` on a previously typed symbol, `eslint-disable`, `rubocop:disable`, `# type: ignore`, `# noqa`, `#pragma warning disable`.

**NOB-302 Broad exception swallow added**
Severity: `medium`. Weight: 15.
An added `catch (e) {}` / `except Exception: pass` / `rescue => e` with an empty or log-only body, especially when it wraps code that previously propagated.

**NOB-303 Timing band-aid added**
Severity: `low`. Weight: 8.
An added `setTimeout`, `sleep`, `time.sleep`, or `await new Promise(r => setTimeout(...))` inside a test file or inside a retry loop. This is a known agent workaround for race conditions it does not understand.

### Group 4: Config and CI tampering (regex only, runs for all languages)

**NOB-401 Coverage threshold lowered**
Severity: `high`. Weight: 30.
A numeric threshold decreased in any of: `jest.config.*` (`coverageThreshold`), `vitest.config.*`, `.simplecov`, `.coveragerc`, `codecov.yml`, `sonar-project.properties`, `pyproject.toml` (`fail_under`), `nyc` config.

**NOB-402 Test or check step neutralized in CI**
Severity: `critical`. Weight: 40.
In any file under `.github/workflows/`, `.gitlab-ci.yml`, `.circleci/`, an added or modified line:

- adds `continue-on-error: true`
- appends `|| true` or `; exit 0` to a command containing `test`, `spec`, `lint`, `audit`, or `typecheck`
- adds `--passWithNoTests`, `--maxfail=0`, `--force`
- removes a step whose `run` contained a test command

**NOB-403 Test file excluded from tooling**
Severity: `high`. Weight: 25.
A test path was added to an ignore or exclude list: `testPathIgnorePatterns`, `.eslintignore`, `exclude` in tsconfig, `--ignore` flags, `.rspec` exclusions, `norecursedirs`.

**NOB-404 Dependency pinned down or integrity check removed**
Severity: `medium`. Weight: 15.
A lockfile integrity field removed, or a dependency downgraded to an older major while its usage stayed the same.

---

## 7. Scoring and verdict

```
score = sum(weight of each finding, capped at 100)
```

Verdict thresholds, all configurable:

| Score   | Verdict | Exit code                     |
| ------- | ------- | ----------------------------- |
| 0       | `pass`  | 0                             |
| 1 to 39 | `warn`  | 0                             |
| 40+     | `block` | 1 in strict mode, 0 otherwise |

**Default posture is non-blocking.** The action comments and exits 0 unless the user opts into `fail-on: block`. This matters for adoption. A tool that breaks people's CI on day one gets uninstalled on day one.

Cap the number of findings reported at 20, sorted by severity then weight, with a `+N more` line.

---

## 8. Configuration

Optional file `.nobble.yml` at repo root. Every field optional, sane defaults built in.

```yaml
# .nobble.yml
version: 1

fail_on: none # none | block | warn

paths:
  tests:
    - 'spec/**'
    - '**/*.test.ts'
  security:
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
    symbols:
      - 'billing_account' # appended to defaults
      - 'feature_flag'

thresholds:
  block: 40
  warn: 1

report:
  max_findings: 20
  comment_mode: sticky # sticky | new | none
```

### Inline suppression

A finding can be suppressed with a comment on the line above or the same line:

```ts
// nobble-ignore NOB-102: rewriting this suite for the new API shape, see #482
```

**A reason is mandatory.** A suppression comment without text after the colon is itself reported as finding `NOB-001 Unexplained suppression`, severity `low`, weight 5. This keeps the escape hatch honest and is a nice detail for the README.

---

## 9. Interfaces

### CLI

```
npx nobble [options]

Options:
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

Terminal output: grouped by severity, colorized, each finding showing `file:line`, the rule ID and title, a one-line explanation, and the offending line with the removed part in red and added part in green. Finish with a one-line verdict.

### GitHub Action

`action.yml` at repo root so `uses: <owner>/nobble@v1` works directly.

```yaml
name: Nobble
description: Flags pull requests where tests were weakened instead of fixed
inputs:
  fail-on:
    description: none | warn | block
    default: none
  config:
    description: Path to .nobble.yml
    default: .nobble.yml
  comment:
    description: Post a PR comment
    default: 'true'
  github-token:
    default: ${{ github.token }}
outputs:
  score:
    description: Total risk score
  verdict:
    description: pass | warn | block
  findings:
    description: JSON array of findings
runs:
  using: node20
  main: dist/index.js
```

The README quickstart must be exactly this and nothing longer:

```yaml
- uses: actions/checkout@v4
  with: { fetch-depth: 0 }
- uses: <owner>/nobble@v1
```

### PR comment format

One sticky comment, updated in place on every push, identified by an HTML marker comment. Structure:

```markdown
<!-- nobble -->

### 🐎 Nobble: 2 findings (score 70, verdict: block)

| Severity    | Rule    | Location                           | What happened                                |
| ----------- | ------- | ---------------------------------- | -------------------------------------------- |
| 🔴 critical | NOB-201 | [`spec/payments_spec.rb:44`](link) | Mock added around `current_user`             |
| 🟠 high     | NOB-101 | [`spec/payments_spec.rb:12`](link) | 3 assertions removed from `charges the card` |

<details><summary>Details and how to suppress</summary>
... per finding: the diff snippet, why the rule exists, the exact suppression comment to paste ...
</details>
```

If there are zero findings and `comment_mode: sticky`, update an existing comment to a one-line pass state, and post nothing if none exists. Never spam a clean PR.

Also emit SARIF so findings appear inline in the GitHub Files Changed view via code scanning upload.

---

## 10. Repository layout

```
nobble/
├── action.yml
├── package.json
├── tsconfig.json
├── README.md
├── LICENSE                     # MIT
├── CONTRIBUTING.md
├── DECISIONS.md
├── CHANGELOG.md
├── .nobble.yml              # dogfooding config
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint, typecheck, test, build, verify dist is current
│       └── nobble.yml       # runs itself on its own PRs
├── dist/                       # committed bundle, built by esbuild
├── src/
│   ├── cli.ts
│   ├── action.ts
│   ├── config/
│   │   ├── schema.ts
│   │   ├── defaults.ts
│   │   └── load.ts
│   ├── diff/
│   │   ├── parse.ts
│   │   ├── git.ts              # base/head blob retrieval
│   │   └── classify.ts
│   ├── parsers/
│   │   ├── index.ts            # language registry
│   │   ├── types.ts            # the adapter interface
│   │   ├── typescript.ts
│   │   ├── ruby.ts
│   │   ├── python.ts
│   │   └── fallback.ts         # regex only
│   ├── rules/
│   │   ├── index.ts            # registry, one file per rule
│   │   ├── tg101-assertions-removed.ts
│   │   ├── ...
│   │   └── types.ts
│   ├── engine/
│   │   ├── run.ts
│   │   ├── score.ts
│   │   ├── pairing.ts
│   │   └── suppress.ts
│   └── report/
│       ├── terminal.ts
│       ├── markdown.ts
│       ├── json.ts
│       └── sarif.ts
└── test/
    ├── fixtures/
    │   ├── ts/<case-name>/{before/,after/,expected.json}
    │   ├── ruby/...
    │   └── python/...
    ├── rules/*.test.ts
    └── e2e/*.test.ts
```

### Core interfaces

```ts
export interface Finding {
  ruleId: string; // "NOB-101"
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  weight: number;
  file: string;
  line: number;
  endLine?: number;
  message: string; // one sentence, specific, names the symbol
  evidence: { before?: string; after?: string };
  suppressWith: string; // the exact comment to paste
}

export interface LanguageAdapter {
  id: string;
  extensions: string[];
  parse(source: string): Tree;
  findTestBlocks(tree: Tree): TestBlock[];
  findAssertions(node: Node): Assertion[];
  findMocks(tree: Tree): Mock[];
  assertionStrength(a: Assertion): number; // higher is stronger
}

export interface Rule {
  id: string;
  title: string;
  defaultSeverity: Severity;
  weight: number;
  requiresAst: boolean;
  appliesTo: FileKind[];
  run(ctx: RuleContext): Finding[];
}
```

Adding a language means implementing `LanguageAdapter` and registering it. Adding a rule means implementing `Rule` and registering it. No other file should need to change.

---

## 11. Testing requirements

This tool lives or dies on its false positive rate. Testing is not optional polish.

1. **Fixture tests.** Every rule needs at least 3 positive fixtures (should fire) and 3 negative fixtures (must not fire), per supported language. A fixture is a `before/` tree, an `after/` tree, and an `expected.json` listing exactly the findings.
2. **Mandatory negative fixtures.** These represent legitimate work and must produce zero findings:
   - A test file renamed, with all assertions intact
   - A test suite refactored from Mocha style to Jest style
   - A feature deleted along with its tests, where the source file is also deleted
   - A test split into two smaller tests, total assertion count unchanged or higher
   - A flaky test correctly fixed by replacing a sleep with a proper wait
   - A dependency upgrade that changes assertion syntax mechanically
3. **Property test:** running Nobble on an empty diff yields zero findings and exits 0.
4. **Golden report tests:** snapshot the markdown and SARIF output.
5. **Real-world smoke test:** a script that runs the tool against the last 50 merged PRs of 3 large public repos and reports the finding rate. Document the result in the README. If the finding rate on ordinary human PRs is above roughly 10 percent, the rules are too loose and must be tightened before release.
6. **Dogfooding:** Nobble runs on its own pull requests via `.github/workflows/nobble.yml`.

Coverage target: 85 percent on `src/rules/` and `src/engine/`.

---

## 12. Milestones

Complete in order. Do not start a milestone before the previous one's exit criteria pass.

**M0. Skeleton**
Repo, TypeScript config, vitest, eslint, esbuild build to `dist/`, CI workflow, MIT license.
_Exit:_ `npm test` and `npm run build` pass in CI.

**M1. Diff pipeline**
Diff parsing, git blob retrieval, file classification, config loading with schema validation, source-to-test pairing, terminal reporter printing a stub verdict.
_Exit:_ `npx nobble --base main` runs on a real repo and correctly classifies every changed file.

**M2. Regex-only rules**
NOB-104, NOB-301, NOB-303, NOB-401, NOB-402, NOB-403, NOB-001 suppression handling, scoring, all four reporters.
_Exit:_ full fixture suite for these rules green, tool is already useful with no AST at all.

**M3. TypeScript AST rules**
`web-tree-sitter` wired up, TS/JS adapter, NOB-101, NOB-102, NOB-103, NOB-105, NOB-201, NOB-202, NOB-203.
_Exit:_ fixture suite green, smoke test against 3 public TS repos with an acceptable finding rate.

**M4. Ruby and Python adapters**
Same rules, adapter implementations only. No changes to rule files should be needed. If a rule file needs changing, the abstraction is wrong. Fix the abstraction.
_Exit:_ fixture suites green for all three languages.

**M5. GitHub Action and release**
`action.yml`, sticky PR comment, SARIF upload, `dist/` committed and verified fresh in CI, README, v1.0.0 tag, npm publish, GitHub Marketplace listing.
_Exit:_ the action runs green on a test repo's PR and posts a correct comment.

---

## 13. README requirements

The README is the product. Write it before the v1 tag, and structure it exactly like this:

1. **One-sentence description**, then one screenshot of a real PR comment showing a caught mock-out-of-auth. This is the single most important asset in the repo.
2. **The problem**, in three sentences with one concrete before/after diff showing a test being gutted.
3. **Quickstart:** the two-step YAML block, nothing more. A `npx nobble` line for local use.
4. **What it catches:** the full rule table with IDs, severities, and a one-line example each.
5. **False positives:** be upfront. Explain the non-blocking default, inline suppression, and per-rule config. State the measured finding rate from the smoke test.
6. **Configuration reference:** the annotated `.nobble.yml`.
7. **How it is different:** short honest comparison against linters, coverage gates, and AI code review bots. Nobble is deterministic, offline, and targets one specific failure mode.
8. **Writing a custom rule:** 20 lines showing the `Rule` interface in action.
9. Badges, license, contributing link.

Tone: plain, specific, no marketing language. Every claim backed by an example.

---

## 14. Definition of done

- [ ] All 15 rules implemented and covered by positive and negative fixtures
- [ ] Three language adapters plus regex fallback
- [ ] CLI with all documented flags
- [ ] GitHub Action publishable, `dist/` freshness verified in CI
- [ ] Four reporters, including valid SARIF that GitHub accepts
- [ ] Config loading with validation and helpful error messages
- [ ] Inline suppression with mandatory reasons
- [ ] Smoke test run documented with a measured finding rate
- [ ] README complete with a real screenshot
- [ ] Tool runs on its own PRs
- [ ] Cold run finishes in under 5 seconds on a 500-file diff
- [ ] `DECISIONS.md` records every ambiguity resolved during the build
