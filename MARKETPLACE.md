# GitHub Marketplace launch kit

This repository is a single JavaScript Action with one root `action.yml`, a public release, committed runtime bundle, and Marketplace-compatible branding metadata.

## Recommended listing

**Action name:** Nobble

**Short description:** Catch pull requests where tests were weakened instead of fixed.

**Primary category:** Code quality

**Secondary category:** Security

**Release title:** Nobble v1.0.0 — Catch weakened tests before they merge

**Release notes:**

> Nobble is a deterministic GitHub Action and CLI for one easy-to-miss review failure: a pull request makes the tests easier instead of making the code correct.
>
> Version 1.0 ships 16 rules for weakened assertions, deleted or skipped tests, sensitive mocks, security bypasses, blanket suppressions, swallowed exceptions, fixed sleeps, lowered coverage, neutralized CI, excluded tests, and weakened dependency integrity.
>
> It supports AST analysis for TypeScript/JavaScript/TSX, Python, and Ruby, with language-independent checks everywhere else. Nobble runs inside your workflow, makes no model calls, sends no code to a service, and starts in reporting-only mode.
>
> Add it to a pull request workflow:
>
> ```yaml
> - uses: actions/checkout@v5
>   with:
>     fetch-depth: 0
> - uses: TheSoloHacker47/nobble@v1
> ```

## Repository metadata

**About:** Catch weakened tests in pull requests. Deterministic GitHub Action and CLI for test, security, coverage, and CI tampering.

**Suggested topics:** `github-actions`, `code-review`, `testing`, `static-analysis`, `pull-requests`, `test-automation`, `security`, `typescript`, `python`, `ruby`, `ci-cd`, `developer-tools`

**Social preview:** Upload `docs/assets/nobble-social-preview.png` in **Settings → General → Social preview**.

## Publish checklist

- [ ] Confirm the repository is public and `action.yml` shows “Everything looks good.”
- [ ] Confirm the `Nobble` Action name is available in GitHub Marketplace.
- [ ] Accept the GitHub Marketplace Developer Agreement if prompted.
- [ ] Verify `v1.0.0` points to the intended release commit and `v1` points to the same tested major release.
- [ ] Open `action.yml`, choose **Draft a release**, and select **Publish this Action to the GitHub Marketplace**.
- [ ] Select **Code quality** as the primary category and **Security** as the secondary category.
- [ ] Paste the release title and notes above, then publish with two-factor authentication.
- [ ] Open the public Marketplace page in a signed-out browser and verify the install snippet, icon, README images, inputs, and links.
- [ ] When the README changes on npm, publish a new npm version; npm does not update a published package README from GitHub automatically.

## Maintainer release checks

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run smoke
git diff --check
```

Create or move release tags only after these checks pass and the release commit is final.
