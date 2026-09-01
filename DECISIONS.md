# Decisions

The spec (`nobble-spec.md`) instructs: "When a decision is genuinely ambiguous, choose the simpler
option and record the choice in `DECISIONS.md`." This file records every such choice, plus the
places where the spec turned out to be factually wrong about the world and had to be deviated from.

Newest entries at the bottom of each section.

---

## Deviations from the spec

These are places where building exactly what the spec says would produce something broken.

### D1. `action.yml` uses `node24`, not `node20`

**Spec says:** `runs: using: node20` (§9), justified as "Node 20 is the current GitHub Action runtime".

**Reality:** that stopped being true. GitHub began deprecating Node 20 on Actions runners in
September 2025. Actions were forced onto Node 24 by default on 2026-06-02, and **Node 20 is removed
from the runner images on 2026-09-16**. An action declaring `using: node20` stops working on that
date.

**Decision:** `using: node24`. Local development is on Node 24.19.0 and CI pins `node-version: 24`,
so the dev, test, and production runtimes all match. `package.json` keeps `engines.node: >=20`
because the _CLI_ still runs fine on Node 20 — it is only the Action runtime that is affected.

### D2. Grammars come from `@vscode/tree-sitter-wasm`, not from `tree-sitter-*` packages

**Spec says:** "`web-tree-sitter` with WASM grammars ... no native build step" (§4).

**Reality:** the `tree-sitter-typescript`, `tree-sitter-ruby`, and `tree-sitter-python` npm packages
ship C sources and **native** Node bindings. They contain no `.wasm` at all. Producing the WASM the
spec asks for would mean running `tree-sitter build --wasm` under emscripten/Docker at build time —
precisely the native build step the spec chose this stack to avoid.

**Decision:** depend on `@vscode/tree-sitter-wasm` (MIT), which ships prebuilt `.wasm` for
`javascript`, `typescript`, `tsx`, `python`, and `ruby` — exactly the five grammars v1 needs — as a
single dependency with no build step. It is maintained by the VS Code team and rebuilt against
current tree-sitter releases.

**Sharp edge, learned the hard way:** that package also ships its own `tree-sitter.wasm` _runtime_.
Using it produces:

```
LinkError: WebAssembly.instantiate(): Import #7 "env" "_emscripten_memcpy_js":
function import requires a callable
```

The runtime wasm is paired with a specific build of emscripten glue, so it must come from
`web-tree-sitter` itself. Only the **grammar** wasm files are interchangeable between the two
packages. `src/parsers/wasm.ts` enforces this split and `test/e2e/bundle.test.ts` guards it.

Measured ABI versions under `web-tree-sitter@0.25.10`: typescript 14, tsx 14, javascript 15,
python 15, ruby 14. All load and parse cleanly. `test/parsers/grammars.test.ts` is the canary if a
future bump drifts.

### D3. Rule files are named `nob*.ts`, not `tg*.ts`

**Spec says:** the layout in §10 lists `src/rules/tg101-assertions-removed.ts`.

**Reality:** `tg` is a leftover prefix from an earlier working name for the project. Every rule ID
in §6 uses `NOB-`, and §3 states the `NOB-` prefix is permanent.

**Decision:** files are `nob101-assertions-removed.ts` and so on, matching the rule IDs. Rule _IDs_
are unchanged and remain permanent.

---

## Ambiguities resolved

### A1. "All 15 rules" vs. the 16th finding type

§14 requires "All 15 rules implemented". Counting §6: NOB-101…105 (5) + NOB-201…203 (3) +
NOB-301…303 (3) + NOB-401…404 (4) = **15 detection rules**. But §8 defines a further finding,
`NOB-001 Unexplained suppression`, which is not in §6's rule tables.

**Decision:** ship **16** rule modules. `NOB-001` is implemented as a rule like any other so it
flows through scoring, reporting, and config uniformly. The §14 count of 15 is read as referring to
the detection rules in §6.

### A2. An unexplained suppression does not suppress

§8 says a `nobble-ignore` comment with no reason after the colon "is itself reported as finding
NOB-001". It does not say whether the malformed comment _still silences_ the original finding.

**Decision:** it does **not**. The original finding stands, and NOB-001 fires alongside it. The
alternative — silencing a real finding in exchange for a 5-point one — would make an empty
suppression the cheapest way to hide anything, which defeats the stated purpose of the rule
("keeps the escape hatch honest").

### A3. `LanguageAdapter` gains a sixth method

§10 defines `LanguageAdapter` with five methods. NOB-203 ("early return or bypass added ... **at the
top of a function body**") cannot be implemented from any of them — none exposes function bodies.

**Decision:** add `findFunctions(tree): FunctionBlock[]`. This preserves the property §10 actually
cares about: adding a language means implementing one adapter file and registering it, with no other
file changing.

### A4. Arg parsing and terminal color use the Node standard library

§4 caps runtime dependencies at 10 and requires each to be justified here. Node 20+ ships
`util.parseArgs`, and Node 22+ ships `util.styleText` (which honours `NO_COLOR` and TTY detection
on its own).

**Decision:** use both instead of adding `commander` and `picocolors`. Runtime dependency count is
**7 of a permitted 10**.

### A6. `paths.*` replaces defaults; `rules['NOB-201'].symbols` appends

§8's example config sets `paths.tests` to `["spec/**", "**/*.test.ts"]` and annotates only
the NOB-201 symbol list with "appended to defaults". It never says what the path lists do.

**Decision:** `paths.tests`, `paths.security`, and `paths.ignore` **replace** the built-in
globs when provided; `rules['NOB-201'].symbols` **appends**. The asymmetry is the spec's
own: it annotated the one case that appends, which implies the others do not. Replacement
also matches the example, which lists a narrow set that reads as "these, specifically"
rather than "these as well".

### A7. NOB-303 skips a file that also removed a sleep

A change that adds a sleep in one place and removes one in another is almost always the
flaky-test fix from §11.2's mandatory negative list, not a new band-aid.

**Decision:** if any removed line in a file matches a sleep pattern, NOB-303 does not fire
for that file at all. This gives up detecting a diff that genuinely swaps one sleep for
another, which is a real but rare case, in exchange for never firing on the correct fix.
Given that §11 makes the false-positive rate the project's primary quality measure, that
trade is the right way round.

### A5. NOB-401 compares numbers positionally rather than parsing five config formats

NOB-401 must detect a lowered threshold across `jest.config.*` (JS), `.coveragerc` (INI),
`codecov.yml` (YAML), `pyproject.toml` (TOML), and `sonar-project.properties`. Fully parsing all
five means either five parsers or a large hand-rolled one.

**Decision:** extract numbers adjacent to a known set of threshold keys from the before and after
blobs and compare them numerically, keyed by the surrounding path. Format-agnostic, far less code,
and no new dependencies. The cost is that an exotic layout may be missed; that trade favours few
false positives, which is the project's stated priority (§11).

### A8. NOB-301 fires on blanket suppressions only, not coded ones

The §11.5 smoke test is the spec's own tightening gate, and the first run failed it on the
metric that matters.

**First measurement** (150 merged PRs across `vitejs/vite`, `pallets/flask`,
`sinatra/sinatra`):

| Metric                           | Rate                       |
| -------------------------------- | -------------------------- |
| All PRs                          | 6.0% (passes the 10% gate) |
| **PRs that touched a test file** | **19.0%**                  |

The headline 6.0% is flattered by PRs that never touch a test file -- most rules cannot fire
on those, so they are free passes. Among the 42 PRs that did touch tests, the rate was 19%.
NOB-301 produced 12 of the 16 total findings, and every one was a _coded_ suppression
(`# type: ignore[return-value]`, `# noqa: F821`, `eslint-disable-next-line import-x/no-duplicates`)
in ordinary typed-Python or lint work.

**Decision:** NOB-301 fires only on **blanket** suppressions. A suppression that names what
it silences is a narrow decision someone already made deliberately; a bare `# type: ignore`
or `@ts-ignore` silences every present and future error on that line, and that is the escape
hatch this rule exists to surface.

This stays inside the spec: §6 lists `# type: ignore` and `# noqa` as triggers and says
nothing about the bracketed variants, which are what is now excluded.

**Second measurement**, same 150 PRs, no other change:

| Metric                       | Before | After    |
| ---------------------------- | ------ | -------- |
| All PRs                      | 6.0%   | **2.7%** |
| PRs that touched a test file | 19.0%  | **7.1%** |
| Total findings               | 16     | 6        |

Four PRs remain flagged. Two are unambiguous true positives -- `sinatra/sinatra#2115`, whose
title is literally "Skip broken tests.", and `#2124`, the revert that reinstates them. The
other two are genuine blanket suppressions at weight 10, which can only ever produce `warn`.

### A9. The smoke test reports two rates, and the second one is the real one

A rate over all PRs understates the false-positive problem, because a PR touching no test
file is a free pass for almost every rule. `scripts/smoke.ts` therefore also reports the
rate among PRs that touched at least one test file, and that is the number quoted in the
README. It is the harder number and the honest one.

### A10. The smoke test diffs from the merge-base, not the base branch tip

The first smoke implementation used `git diff base..head`, which for a true merge commit
includes every unrelated commit that landed on the base branch while the PR was open. It
produced findings like a Flask documentation PR being blamed for six `# type: ignore` lines
elsewhere in the tree.

**Decision:** diff `base...head` (three dots, from the merge-base). For a squash merge the
merge-base is the parent, so one expression handles both merge styles. Worth recording
because the bug did not look like a bug -- it looked like a false-positive rate.

### A11. Negation lives in `isNegated`, never in the matcher name

RSpec and Jest express negation as a separate token (`not_to`, `.not`), so the matcher name
is unchanged by it. Python and Minitest bake it in: `assertNotEqual`, `refute_nil`.

Left alone, that asymmetry breaks two rules at once on those languages. `assertEqual` ->
`assertNotEqual` looks to NOB-102 like a strong matcher swapped for a weaker one, so NOB-102
reports a weakening; and NOB-105, whose job an inversion actually is, never sees it.

**Decision:** the Python and Ruby adapters strip negation out of the matcher name and report
it in `isNegated`. `assertNotEqual` becomes matcher `assertEqual`, negated. This is adapter
work, not rule work -- exactly where M4 says a language difference belongs.

Related: a bare `assert a == b` scores the same as `assertEqual(a, b)`, because it asserts
the same thing. Without that, porting a suite from unittest to pytest reads as a wholesale
weakening of every assertion in the file.

### A12. A block with two plausible successors is not matched at all

`block-matching.ts` originally treated substring containment as a rename. In a file
containing `test_foo`, `test_foo_disable`, and `test_foo_enable`, that makes `test_foo` a
rename of both, and the greedy matcher pairs it with whichever it reaches first.

The smoke test caught the consequence on a real PR (`pallets/flask#5917`, a test split in
two): Nobble reported _"10 assertions removed from test_provide_automatic_options_attr_enable
(11 -> 1)"_, which describes nothing that happened.

**Decision:** containment must also be substantial (the shorter name at least 60% of the
longer), and a before-block with more than one plausible successor goes to a new `ambiguous`
list that no rule fires on. This is the same principle `pairing.ts` already applies to
source-to-test pairing: a guess that surfaces as a confident finding is worse than silence.

### A13. Final measured finding rate

After A8 and A12, over 150 merged PRs from `vitejs/vite`, `pallets/flask`, and
`sinatra/sinatra`:

| Metric                                        | Rate                           |
| --------------------------------------------- | ------------------------------ |
| PRs flagged (the spec's §11.5 metric)         | **5.3%** — passes the 10% gate |
| PRs that touched a test file and were flagged | 16.7% (7 of 42)                |
| **PRs reaching verdict `block`**              | **2.0%** (3 of 150)            |
| Verdict split                                 | 3 block, 5 warn, 142 pass      |

The 16.7% figure is above 10% and is reported here rather than buried, but every finding
behind it accurately describes a real event: a test deleted, a test skipped, or a blanket
suppression added. None is a misfire. The three `block` verdicts are `sinatra/sinatra#2115`
("Skip broken tests."), `#2124` (the revert that reinstates those skips), and `#2114` (two
test cases deleted) -- all changes a reviewer should see.

Further tightening was considered and rejected: making NOB-103 stop reporting deleted test
blocks would remove the rule's entire purpose. Nobble judges the diff, not intent (§2), so
"a test was deleted" is the correct output even when the deletion was justified. Teams that
disagree for a given rule have `.nobble.yml`, which is why every rule is configurable.

### A14. M4 required exactly one rule-file change

The milestone's constraint is that adding a language touches only an adapter. Adding Ruby
and Python changed `src/parsers/` and one character class in `src/rules/nob203-security-bypass.ts`:
`return True` was missing from the unconditional-exit literals.

**Assessment:** that table already contained `nil`, `None`, `pass`, and `head :ok` before
either adapter existed -- it was designed as a cross-language literal list from the start,
and `True` was a data omission in it rather than a structural failure. It was left in the
rule instead of being promoted to a seventh `LanguageAdapter` method, on the grounds that
one more interface method for a five-entry literal list is the worse trade. Recorded here
so the judgement is visible rather than implicit.

Everything else Ruby and Python needed -- Minitest's `def test_*` blocks, RSpec message
stubs, `@patch` decorators, negation normalization -- landed in the adapters, as intended.

### A15. The PR comment never fails the build

Posting the sticky comment needs `pull-requests: write`, which a workflow may not grant. A
run that analyzed the diff correctly and produced the right verdict should not go red
because it could not also leave a comment.

**Decision:** comment failures are `core.warning`, with the likely cause named in the
message. Only the verdict, under an explicit `fail-on`, can fail the build.

The same reasoning applies to SARIF: the file is always written, and uploading it is a
separate step the workflow opts into with `security-events: write`.

### A16. Verified end to end on a real pull request

`TheSoloHacker47/nobble#1` weakens a payment suite on purpose -- assertions removed, a test
case deleted, a test skipped, `current_user` mocked, and an unconditional `return true`
added at the top of an auth middleware. It exists to prove the action works and to be the
README screenshot.

The action ran on a GitHub-hosted runner and reported 5 findings, score 100, verdict
`block`; posted the sticky comment with working permalinks; emitted all five as workflow
annotations; uploaded SARIF; and failed the job with the correct message under
`fail-on: block`.

The run log also confirmed decision D1 from the other direction: GitHub warned that
`github/codeql-action/upload-sarif@v3` "targets Node.js 20 but is being forced to run on
Node.js 24". Nobble targets `node24` directly and needed no forcing. That step has since
been bumped to `@v4`, which the same log flagged as deprecating in December 2026.

### A17. Measured performance

The definition of done asks for a cold run under 5 seconds on a 500-file diff.
`test/e2e/performance.test.ts` builds a repo with 500 changed source files and their tests
across all three languages plus config and CI, then times one full run including grammar
loading:

**1002 changed files, 502 findings, 700ms.**

Roughly double the required file count at about a seventh of the budget. The batched
`git cat-file --batch` blob reader is what buys it; one `git show` per file would spend the
whole budget on process spawns.

### A18. The Action's Marketplace name is "Nobble Test Integrity", not "Nobble"

GitHub Marketplace requires an action's `name` to be unique across **every action, user,
and organization on GitHub** -- not merely across existing Marketplace listings. A user
account named `Nobble` has existed since 2014-08-11, so `name: Nobble` is rejected with
"Name must be unique. Cannot match an existing action, user or organization name."

This was missed during release prep because the pre-flight check only tested
`github.com/marketplace/actions/nobble` (404, free) and never tested `github.com/nobble`
(200, taken). The lesson is the check, not the name: **verify the user/org namespace, not
just the Marketplace namespace.**

**Decision:** the Marketplace display name is `Nobble Test Integrity`. "Integrity" over
"Guard" because the tool's default posture is non-blocking, and a name implying it gates CI
would misrepresent it.

Scope of the change is narrow and deliberate. Unaffected:

|                  |                                       |
| ---------------- | ------------------------------------- |
| npm package      | `nobble` (already published as 1.0.0) |
| Repository       | `TheSoloHacker47/nobble`              |
| Action reference | `uses: TheSoloHacker47/nobble@v1`     |
| CLI binary       | `nobble`                              |
| Rule ID prefix   | `NOB-`                                |

Only the Marketplace listing title and its derived slug change.

---

## Runtime dependency justifications

Budget: 10 (§4). Used: 7.

| Package                    | Why it is needed                                                    | Why not the standard library                                                                                       |
| -------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `web-tree-sitter`          | The parser API the spec mandates.                                   | No AST parsing in Node's stdlib.                                                                                   |
| `@vscode/tree-sitter-wasm` | Prebuilt grammar `.wasm` for all five target languages.             | See D2 — the alternative is an emscripten build step.                                                              |
| `parse-diff`               | Unified-diff parsing. Zero dependencies, bundled types, ~200 lines. | Hand-rolling this is the spec's stated alternative; the package is small enough that writing our own buys nothing. |
| `yaml`                     | `.nobble.yml` config, plus reading CI workflow files for NOB-402.   | No YAML in stdlib.                                                                                                 |
| `picomatch`                | Glob matching for the test / security / ignore path patterns.       | `node:path` has no glob matcher; `fs.glob` walks the filesystem rather than matching a string.                     |
| `@actions/core`            | Action inputs, outputs, and annotations.                            | Only used by `src/action.ts`.                                                                                      |
| `@actions/github`          | Authenticated Octokit for the sticky PR comment.                    | Only used by `src/action.ts`.                                                                                      |

---

## Milestone notes

### M0

- The grammar-loading gate ran **before** any rule work, because two assumptions had to hold and
  both were unverified: that the prebuilt grammars are ABI-compatible with the pinned
  `web-tree-sitter`, and that esbuild does not break emscripten glue. Both now hold and both are
  pinned by tests (`test/parsers/grammars.test.ts`, `test/e2e/bundle.test.ts`).
- `dist/` is built as **ESM** and carries its own `dist/package.json` with `{"type":"module"}`, so
  the bundle's module type does not depend on the root `package.json` staying `type: module`.
- The esbuild banner shims `require`, `__filename`, and `__dirname` from `import.meta.url`, because
  web-tree-sitter's emscripten glue references all three and esbuild's ESM output does not define
  them.
