import { describe, it, expect } from 'vitest';
import { renderMarkdown, renderCleanMarkdown, COMMENT_MARKER } from '../../src/report/markdown.js';
import { renderSarif } from '../../src/report/sarif.js';
import { renderJson } from '../../src/report/json.js';
import { renderTerminal } from '../../src/report/terminal.js';
import { registerAllRules } from '../../src/rules/register.js';
import type { AnalysisResult, Finding } from '../../src/types.js';

registerAllRules();

const finding = (over: Partial<Finding> = {}): Finding => ({
  ruleId: 'NOB-104',
  title: 'Test disabled or skipped',
  severity: 'high',
  weight: 25,
  file: 'spec/payments_spec.rb',
  line: 12,
  message: 'Test skipped (RSpec skip/pending): `pending`',
  evidence: { before: 'it "charges the card" do', after: '  pending' },
  suppressWith: '# nobble-ignore NOB-104: <reason>',
  ...over,
});

const result = (over: Partial<AnalysisResult> = {}): AnalysisResult => ({
  findings: [
    finding({
      ruleId: 'NOB-402',
      title: 'Test or check step neutralized in CI',
      severity: 'critical',
      weight: 40,
      file: '.github/workflows/ci.yml',
      line: 8,
      message: 'CI check neutralized (continue-on-error: true)',
      evidence: { after: '        continue-on-error: true' },
      suppressWith: '# nobble-ignore NOB-402: <reason>',
    }),
    finding(),
  ],
  totalFindings: 2,
  score: 65,
  verdict: 'block',
  degraded: false,
  filesAnalyzed: 4,
  ...over,
});

describe('markdown reporter', () => {
  it('renders the sticky comment structure', () => {
    expect(renderMarkdown(result())).toMatchSnapshot();
  });

  it('carries the marker that makes the comment sticky', () => {
    expect(renderMarkdown(result()).startsWith(COMMENT_MARKER)).toBe(true);
    expect(renderCleanMarkdown().startsWith(COMMENT_MARKER)).toBe(true);
  });

  it('collapses to one line when there is nothing to report', () => {
    const clean = renderMarkdown(
      result({ findings: [], totalFindings: 0, score: 0, verdict: 'pass' }),
    );
    expect(clean).toBe(renderCleanMarkdown());
    expect(clean.split('\n').filter(Boolean)).toHaveLength(2);
  });

  it('notes a +N more line when findings are capped', () => {
    const md = renderMarkdown(result({ totalFindings: 25 }));
    expect(md).toContain('+23 more');
  });

  it('escapes pipes so a message cannot break the table', () => {
    const md = renderMarkdown(
      result({
        findings: [finding({ message: 'appended `|| true` to the command' })],
        totalFindings: 1,
      }),
    );
    const tableRow = md.split('\n').find((l) => l.startsWith('| 🟠'))!;
    // The message's pipes must be escaped, leaving exactly 5 real cell delimiters
    // (leading, three interior, trailing) around the four columns.
    const unescapedPipes = [...tableRow.matchAll(/(?<!\\)\|/g)].length;
    expect(unescapedPipes).toBe(5);
    expect(tableRow).toContain('\\|\\| true');
  });

  it('surfaces a degraded run', () => {
    const md = renderMarkdown(result({ degraded: true, degradedReason: 'no base ref available' }));
    expect(md).toContain('Degraded run');
  });

  it('links to the file when a repo and sha are supplied', () => {
    const md = renderMarkdown(result(), {
      repoUrl: 'https://github.com/o/r',
      sha: 'abc123',
    });
    expect(md).toContain('https://github.com/o/r/blob/abc123/spec/payments_spec.rb#L12');
  });
});

describe('sarif reporter', () => {
  it('renders valid SARIF 2.1.0', () => {
    expect(renderSarif(result(), '1.0.0')).toMatchSnapshot();
  });

  it('maps severities onto the three levels GitHub understands', () => {
    const sarif = JSON.parse(
      renderSarif(
        result({
          findings: [
            finding({ ruleId: 'NOB-402', severity: 'critical' }),
            finding({ ruleId: 'NOB-104', severity: 'high' }),
            finding({ ruleId: 'NOB-301', severity: 'medium' }),
            finding({ ruleId: 'NOB-303', severity: 'low' }),
          ],
          totalFindings: 4,
        }),
      ),
    );
    expect(sarif.runs[0].results.map((r: { level: string }) => r.level)).toEqual([
      'error',
      'error',
      'warning',
      'note',
    ]);
    // The critical/high distinction survives in properties even though the level collapses.
    expect(sarif.runs[0].results[0].properties.severity).toBe('critical');
  });

  it('gives every result a fingerprint that ignores the line number', () => {
    const a = JSON.parse(
      renderSarif(result({ findings: [finding({ line: 12 })], totalFindings: 1 })),
    );
    const b = JSON.parse(
      renderSarif(result({ findings: [finding({ line: 99 })], totalFindings: 1 })),
    );
    expect(a.runs[0].results[0].partialFingerprints.nobbleFingerprint).toBe(
      b.runs[0].results[0].partialFingerprints.nobbleFingerprint,
    );
  });

  it('only declares rules it actually reported', () => {
    const sarif = JSON.parse(renderSarif(result({ findings: [finding()], totalFindings: 1 })));
    expect(sarif.runs[0].tool.driver.rules.map((r: { id: string }) => r.id)).toEqual(['NOB-104']);
  });

  it('emits a well-formed empty run when there is nothing to report', () => {
    const sarif = JSON.parse(
      renderSarif(result({ findings: [], totalFindings: 0, score: 0, verdict: 'pass' })),
    );
    expect(sarif.version).toBe('2.1.0');
    expect(sarif.runs[0].results).toEqual([]);
  });
});

describe('json reporter', () => {
  it('is parseable and carries the verdict', () => {
    const parsed = JSON.parse(renderJson(result()));
    expect(parsed.score).toBe(65);
    expect(parsed.verdict).toBe('block');
    expect(parsed.findings).toHaveLength(2);
  });
});

describe('terminal reporter', () => {
  it('prints a verdict line', () => {
    const out = renderTerminal(result());
    expect(out).toContain('verdict:');
    expect(out).toContain('NOB-402');
  });

  it('says so plainly when there is nothing to report', () => {
    expect(
      renderTerminal(result({ findings: [], totalFindings: 0, score: 0, verdict: 'pass' })),
    ).toContain('No findings.');
  });

  it('prints only findings in quiet mode', () => {
    const out = renderTerminal(result(), { quiet: true });
    expect(out).not.toContain('verdict:');
    expect(out).toContain('NOB-402');
  });
});
