import fs from 'node:fs';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { VERSION } from './version.js';
import { loadConfig, ConfigError } from './config/load.js';
import { run } from './engine/run.js';
import { exitCode } from './engine/score.js';
import { renderMarkdown, renderCleanMarkdown, COMMENT_MARKER } from './report/markdown.js';
import { renderSarif } from './report/sarif.js';
import { diffText, fetchBaseRef, revParse, GitError } from './diff/git.js';
import { registerAllRules } from './rules/register.js';
import type { FailOn, CommentMode } from './config/schema.js';
import type { AnalysisResult } from './types.js';

interface PrContext {
  owner: string;
  repo: string;
  number: number;
  baseSha: string;
  headSha: string;
  baseRef: string;
}

function pullRequestContext(): PrContext | undefined {
  const pr = github.context.payload.pull_request;
  if (!pr) return undefined;
  const { owner, repo } = github.context.repo;
  return {
    owner,
    repo,
    number: pr.number,
    baseSha: (pr.base as { sha: string }).sha,
    headSha: (pr.head as { sha: string }).sha,
    baseRef: (pr.base as { ref: string }).ref,
  };
}

/**
 * Finds our own comment by its HTML marker so the report updates in place instead of
 * adding one more comment on every push.
 */
async function upsertStickyComment(
  token: string,
  pr: PrContext,
  body: string,
  mode: CommentMode,
  hasFindings: boolean,
): Promise<void> {
  const octokit = github.getOctokit(token);

  if (mode === 'new') {
    await octokit.rest.issues.createComment({
      owner: pr.owner,
      repo: pr.repo,
      issue_number: pr.number,
      body,
    });
    return;
  }

  const existing = await octokit.paginate(octokit.rest.issues.listComments, {
    owner: pr.owner,
    repo: pr.repo,
    issue_number: pr.number,
    per_page: 100,
  });
  const ours = existing.find((c) => c.body?.includes(COMMENT_MARKER));

  if (ours) {
    await octokit.rest.issues.updateComment({
      owner: pr.owner,
      repo: pr.repo,
      comment_id: ours.id,
      body,
    });
    return;
  }

  // Never spam a clean PR: with nothing to report and no existing comment, say nothing.
  if (!hasFindings) {
    core.info('No findings and no existing comment: posting nothing.');
    return;
  }

  await octokit.rest.issues.createComment({
    owner: pr.owner,
    repo: pr.repo,
    issue_number: pr.number,
    body,
  });
}

function setOutputs(result: AnalysisResult): void {
  core.setOutput('score', String(result.score));
  core.setOutput('verdict', result.verdict);
  core.setOutput('findings', JSON.stringify(result.findings));
}

/** A compact run summary, so the findings are visible without opening the PR comment. */
function writeJobSummary(markdown: string): void {
  try {
    core.summary.addRaw(markdown.replace(COMMENT_MARKER, '')).write();
  } catch {
    // Summaries are a convenience; never fail the run over one.
  }
}

async function main(): Promise<void> {
  registerAllRules();

  const failOnInput = (core.getInput('fail-on') || 'none') as FailOn;
  const configPath = core.getInput('config') || undefined;
  const shouldComment = (core.getInput('comment') || 'true') !== 'false';
  const token = core.getInput('github-token');
  const sarifPath = core.getInput('sarif-file') || 'nobble.sarif';

  if (!['none', 'warn', 'block'].includes(failOnInput)) {
    core.setFailed(`fail-on must be none | warn | block, got "${failOnInput}"`);
    return;
  }

  let config;
  try {
    config = loadConfig(configPath === '.nobble.yml' ? undefined : configPath).config;
  } catch (err) {
    if (err instanceof ConfigError) {
      core.setFailed(err.message);
      return;
    }
    throw err;
  }
  // The action input wins over the file, so a workflow can tighten without editing config.
  if (core.getInput('fail-on')) config.failOn = failOnInput;

  const pr = pullRequestContext();
  if (!pr) {
    core.info('Not a pull_request event; nothing to analyze.');
    core.setOutput('score', '0');
    core.setOutput('verdict', 'pass');
    core.setOutput('findings', '[]');
    return;
  }

  // actions/checkout with fetch-depth: 0 already has the base. With a shallow checkout it
  // does not, so fetch just enough to reach it before giving up on before-image rules.
  if (!revParse(pr.baseSha)) {
    core.info(`Base commit ${pr.baseSha.slice(0, 8)} not present; fetching ${pr.baseRef}.`);
    fetchBaseRef(pr.baseRef);
  }

  let diff: string;
  try {
    diff = diffText(pr.baseSha, pr.headSha);
  } catch (err) {
    if (err instanceof GitError) {
      core.setFailed(
        `${err.message}\nCheck out with "fetch-depth: 0" so Nobble can reach the base commit.`,
      );
      return;
    }
    throw err;
  }

  const result = await run({ diffText: diff, config, base: pr.baseSha });

  if (result.degraded) {
    core.warning(`Nobble ran in degraded mode: ${result.degradedReason}`);
  }
  core.info(
    `Nobble: ${result.totalFindings} finding(s), score ${result.score}, verdict ${result.verdict}`,
  );

  setOutputs(result);

  const markdown =
    result.totalFindings === 0
      ? renderCleanMarkdown()
      : renderMarkdown(result, {
          repoUrl: `${github.context.serverUrl}/${pr.owner}/${pr.repo}`,
          sha: pr.headSha,
        });

  // Written unconditionally: uploading it is a separate step with security-events: write,
  // and a workflow that does not upload should still be able to keep the file.
  try {
    fs.writeFileSync(sarifPath, renderSarif(result, VERSION));
    core.setOutput('sarif-file', sarifPath);
  } catch (err) {
    core.warning(`Could not write SARIF to ${sarifPath}: ${String(err)}`);
  }

  writeJobSummary(markdown);

  if (shouldComment && config.commentMode !== 'none') {
    if (!token) {
      core.warning('No github-token supplied; skipping the PR comment.');
    } else {
      try {
        await upsertStickyComment(
          token,
          pr,
          markdown,
          config.commentMode,
          result.totalFindings > 0,
        );
      } catch (err) {
        // A missing pull-requests: write permission is the usual cause. Worth a warning,
        // never worth failing a run that otherwise succeeded.
        core.warning(
          `Could not post the PR comment: ${err instanceof Error ? err.message : String(err)}. ` +
            'The workflow may need "permissions: pull-requests: write".',
        );
      }
    }
  }

  // Annotations put each finding on its line in the Files Changed view even without SARIF.
  for (const f of result.findings) {
    const annotate = f.severity === 'critical' || f.severity === 'high' ? core.error : core.warning;
    annotate(f.message, {
      title: `${f.ruleId} ${f.title}`,
      file: f.file,
      startLine: f.line,
      ...(f.endLine ? { endLine: f.endLine } : {}),
    });
  }

  if (exitCode(result.verdict, config.failOn) !== 0) {
    core.setFailed(
      `Nobble: verdict ${result.verdict} (score ${result.score}) with fail-on: ${config.failOn}.`,
    );
  }
}

main().catch((err: unknown) => {
  core.setFailed(err instanceof Error ? (err.stack ?? err.message) : String(err));
});
