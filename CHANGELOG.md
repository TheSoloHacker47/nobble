# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2026-09-01

### Fixed

- GitHub Marketplace display name changed from `Nobble` to `Nobble Test Integrity`.
  Marketplace requires an action's name to be unique across every action, **user, and
  organization** on GitHub, and a user account named `Nobble` has existed since 2014, so
  the listing was rejected. Affects the Marketplace listing title only — the npm package
  (`nobble`), the repository, the `nobble` CLI binary, and `uses: TheSoloHacker47/nobble@v1`
  are all unchanged.

## [1.0.0] - 2026-09-01

### Added

- 16 rules: NOB-101/102/103/104/105 (assertion tampering), NOB-201/202/203 (security and
  boundary mocking), NOB-301/302/303 (escape hatches), NOB-401/402/403/404 (config and CI
  tampering), and NOB-001 (unexplained suppression).
- Language adapters for TypeScript/JavaScript/TSX, Ruby, and Python, plus a regex fallback
  so skip, suppression, coverage-config, and CI rules run on every language.
- CLI (`npx nobble`) with terminal, markdown, JSON, and SARIF reporters.
- GitHub Action with a sticky PR comment, workflow annotations, and SARIF output.
- `.nobble.yml` configuration with per-rule severity, weight, and enablement overrides.
- Inline suppression via `nobble-ignore <RULE>: <reason>`, with the reason mandatory.
- 175 fixtures across three languages, and a smoke test against real public repositories.

### Notes

- The GitHub Action runs on `node24`. Node 20 was removed from GitHub-hosted runners on
  2026-09-16, so an action declaring `node20` no longer runs.

### Measured

- Finding rate over 150 merged pull requests from `vitejs/vite`, `pallets/flask`, and
  `sinatra/sinatra`: 5.3% of all PRs, 16.7% of PRs that touched a test file, and 2.0%
  reaching verdict `block`.
- Cold run on a 1002-file diff across three languages: 700ms, against a 5s budget.
- Coverage on `src/rules/` and `src/engine/`: 92% statements, 85% branches.

[1.0.0]: https://github.com/TheSoloHacker47/nobble/releases/tag/v1.0.0
[1.0.1]: https://github.com/TheSoloHacker47/nobble/releases/tag/v1.0.1
