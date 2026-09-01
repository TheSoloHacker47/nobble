# Changelog

All notable changes to this project are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
