# Contributing to Nobble

## The one thing that matters

This tool lives or dies on its false-positive rate. A rule that fires on ordinary work gets
the whole tool switched off, and a switched-off tool catches nothing.

So: **the negative fixtures are the point.** Every rule needs at least three cases that
should fire and at least three that must not, and the second set is where the real design
work is.

## Getting set up

```bash
npm install
npm test
npm run build
```

Node 24 or later. There is no native build step — the tree-sitter grammars ship as WASM.

## Adding a rule

1. Write `src/rules/nobNNN-short-name.ts` exporting one `Rule` object.
2. Add it to the list in `src/rules/register.ts`. Nothing else changes.
3. Add fixtures to `scripts/fixtures/` and run `node scripts/make-fixtures.mjs`.
4. `npm test`.

Rule IDs are permanent and must never be reused, even for a rule that gets deleted.

Fixtures are declared in `scripts/fixtures/*.mjs` and generated into `test/fixtures/`. Both
the declaration and the generated tree are committed: the declaration is what you edit, the
tree is what the harness reads. The harness materializes `before/` and `after/` as two real
git commits and diffs them, so a fixture exercises the same git output and line numbering a
real pull request does.

## Adding a language

Implement `LanguageAdapter` in `src/parsers/`, register it in `src/parsers/index.ts`, and
add a grammar to the copy list in `scripts/build.mjs` if it is not already shipped by
`@vscode/tree-sitter-wasm`.

**If adding a language requires editing a rule file, that is a bug in the abstraction, not
a language quirk.** Fix the abstraction. Two examples already in the tree: negation is
normalized out of matcher names in the Ruby and Python adapters so `assertNotEqual` does not
read as a _weaker_ matcher than `assertEqual`, and Minitest's `def test_*` blocks are
recognized in the adapter rather than special-cased in NOB-101.

## Before opening a pull request

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build          # dist/ is committed; CI fails if it is stale
```

If you changed a rule's behaviour, re-run the smoke test and put the new number in the
README:

```bash
npm run smoke -- --limit 50
```

The gate is roughly 10%. If ordinary human pull requests are being flagged more often than
that, the rule is too loose — tighten it before merging, and record the before-and-after
measurement in `DECISIONS.md`.

## Style

Match the surrounding code. Comments explain _why_, especially for the guard clauses:
almost every one of them exists because a specific false positive was observed, and losing
that context is how they get "simplified" back out again.
