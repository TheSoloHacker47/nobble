import { styleText } from 'node:util';
import type { AnalysisResult, Finding, Severity } from '../types.js';

/**
 * `util.styleText` honours NO_COLOR, FORCE_COLOR and TTY detection on its own, so there is
 * no colour library here and no manual `isTTY` check. See DECISIONS.md A4.
 */

const SEVERITY_STYLE: Record<Severity, Parameters<typeof styleText>[0]> = {
  critical: ['red', 'bold'],
  high: ['red'],
  medium: ['yellow'],
  low: ['gray'],
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: 'critical',
  high: 'high    ',
  medium: 'medium  ',
  low: 'low     ',
};

function paint(text: string, style: Parameters<typeof styleText>[0]): string {
  try {
    return styleText(style, text);
  } catch {
    return text; // unknown style name on an older Node; plain text is fine
  }
}

function renderFinding(f: Finding): string {
  const lines: string[] = [];
  const sev = paint(SEVERITY_LABEL[f.severity], SEVERITY_STYLE[f.severity]);
  const loc = paint(`${f.file}:${f.line}`, ['cyan']);
  lines.push(`  ${sev}  ${paint(f.ruleId, ['bold'])}  ${loc}`);
  lines.push(`            ${f.title}`);
  lines.push(`            ${f.message}`);

  if (f.evidence.before) {
    for (const l of f.evidence.before.split('\n').slice(0, 3)) {
      lines.push(`            ${paint('- ' + l.trim(), ['red'])}`);
    }
  }
  if (f.evidence.after) {
    for (const l of f.evidence.after.split('\n').slice(0, 3)) {
      lines.push(`            ${paint('+ ' + l.trim(), ['green'])}`);
    }
  }
  if (f.suppressWith) {
    lines.push(`            ${paint('suppress: ' + f.suppressWith, ['gray'])}`);
  }
  return lines.join('\n');
}

export interface TerminalOptions {
  /** Only print findings, no summary or verdict line. */
  quiet?: boolean;
}

export function renderTerminal(result: AnalysisResult, opts: TerminalOptions = {}): string {
  const out: string[] = [];

  if (result.degraded && !opts.quiet) {
    out.push(
      paint(`! degraded: ${result.degradedReason ?? 'before-images unavailable'}`, ['yellow']),
    );
    out.push('');
  }

  if (result.findings.length === 0) {
    if (opts.quiet) return '';
    out.push(paint('No findings.', ['green']));
    out.push(
      paint(
        `  ${result.filesAnalyzed} file${result.filesAnalyzed === 1 ? '' : 's'} analyzed, score 0, verdict: pass`,
        ['gray'],
      ),
    );
    return out.join('\n') + '\n';
  }

  const order: Severity[] = ['critical', 'high', 'medium', 'low'];
  for (const sev of order) {
    const group = result.findings.filter((f) => f.severity === sev);
    if (group.length === 0) continue;
    out.push('');
    for (const f of group) {
      out.push(renderFinding(f));
      out.push('');
    }
  }

  const hidden = result.totalFindings - result.findings.length;
  if (hidden > 0) out.push(paint(`  +${hidden} more`, ['gray']));

  if (!opts.quiet) {
    const verdictStyle =
      result.verdict === 'block'
        ? ['red', 'bold']
        : result.verdict === 'warn'
          ? ['yellow']
          : ['green'];
    out.push(
      `${paint(String(result.totalFindings), ['bold'])} finding${result.totalFindings === 1 ? '' : 's'}, ` +
        `score ${paint(String(result.score), ['bold'])}, ` +
        `verdict: ${paint(result.verdict, verdictStyle as Parameters<typeof styleText>[0])}`,
    );
  }
  return out.join('\n') + '\n';
}
