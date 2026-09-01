import type { AnalysisResult, Finding, Severity } from '../types.js';
import { ruleById } from '../rules/index.js';

/** The marker that makes the PR comment sticky -- it is how we find our own comment again. */
export const COMMENT_MARKER = '<!-- nobble -->';

const EMOJI: Record<Severity, string> = {
  critical: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '⚪',
};

export interface MarkdownOptions {
  /** `owner/repo` + sha, used to build permalinks to each finding. */
  repoUrl?: string;
  sha?: string;
}

function link(f: Finding, opts: MarkdownOptions): string {
  const label = `\`${f.file}:${f.line}\``;
  if (!opts.repoUrl || !opts.sha) return label;
  return `[${label}](${opts.repoUrl}/blob/${opts.sha}/${f.file}#L${f.line})`;
}

/** Table cells cannot contain raw newlines or unescaped pipes. */
function cell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ').trim();
}

function detailsFor(f: Finding, opts: MarkdownOptions): string {
  const rule = ruleById(f.ruleId);
  const parts: string[] = [];
  parts.push(`#### ${EMOJI[f.severity]} ${f.ruleId} — ${f.title}`);
  parts.push('');
  parts.push(`${link(f, opts)} · severity \`${f.severity}\` · weight ${f.weight}`);
  parts.push('');
  parts.push(f.message);

  if (f.evidence.before || f.evidence.after) {
    parts.push('');
    parts.push('```diff');
    if (f.evidence.before) {
      for (const l of f.evidence.before.split('\n')) parts.push(`- ${l.trim()}`);
    }
    if (f.evidence.after) {
      for (const l of f.evidence.after.split('\n')) parts.push(`+ ${l.trim()}`);
    }
    parts.push('```');
  }

  if (rule?.rationale) {
    parts.push('');
    parts.push(`*Why this rule exists:* ${rule.rationale}`);
  }

  if (f.suppressWith) {
    parts.push('');
    parts.push('To suppress, add this comment above the line (a reason is required):');
    parts.push('');
    parts.push('```');
    parts.push(f.suppressWith);
    parts.push('```');
  }
  return parts.join('\n');
}

/** The one-line clean state. Never spam a clean PR with a full report. */
export function renderCleanMarkdown(): string {
  return `${COMMENT_MARKER}\n### 🐎 Nobble: no findings.\n`;
}

export function renderMarkdown(result: AnalysisResult, opts: MarkdownOptions = {}): string {
  if (result.totalFindings === 0) return renderCleanMarkdown();

  const out: string[] = [COMMENT_MARKER];
  const n = result.totalFindings;
  out.push(
    `### 🐎 Nobble: ${n} finding${n === 1 ? '' : 's'} (score ${result.score}, verdict: ${result.verdict})`,
  );
  out.push('');

  if (result.degraded) {
    out.push(
      `> ⚠️ Degraded run: ${result.degradedReason ?? 'file contents before the change were unavailable'}. Only rules that work from the diff alone ran.`,
    );
    out.push('');
  }

  out.push('| Severity | Rule | Location | What happened |');
  out.push('|---|---|---|---|');
  for (const f of result.findings) {
    out.push(
      `| ${EMOJI[f.severity]} ${f.severity} | ${f.ruleId} | ${link(f, opts)} | ${cell(f.message)} |`,
    );
  }

  const hidden = result.totalFindings - result.findings.length;
  if (hidden > 0) {
    out.push('');
    out.push(`_+${hidden} more not shown._`);
  }

  out.push('');
  out.push('<details><summary>Details and how to suppress</summary>');
  out.push('');
  for (const f of result.findings) {
    out.push(detailsFor(f, opts));
    out.push('');
    out.push('---');
    out.push('');
  }
  out.push('</details>');
  out.push('');
  return out.join('\n');
}
