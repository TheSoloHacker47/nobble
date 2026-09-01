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
