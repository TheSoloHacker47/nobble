import { createHash } from 'node:crypto';
import type { AnalysisResult, Finding, Severity } from '../types.js';
import { allRules } from '../rules/index.js';

/**
 * SARIF 2.1.0 for GitHub code scanning, so findings appear inline in Files Changed.
 *
 * GitHub only understands error / warning / note, so the four severities collapse:
 * critical and high both become `error`, since a reviewer needs to see them either way.
 * The distinction survives in `properties.severity` and in the rule's own metadata.
 */

const LEVEL: Record<Severity, 'error' | 'warning' | 'note'> = {
  critical: 'error',
  high: 'error',
  medium: 'warning',
  low: 'note',
};

const RANK: Record<Severity, number> = { critical: 100, high: 75, medium: 45, low: 20 };

/**
 * Stable across pushes so GitHub can tell "same finding, still there" from "new finding".
 * Deliberately excludes the line number: re-indenting a file must not resurrect a finding
 * the developer already dismissed.
 */
function fingerprint(f: Finding): string {
  return createHash('sha256')
    .update(`${f.ruleId} ${f.file} ${f.message}`)
    .digest('hex')
    .slice(0, 32);
}

export function renderSarif(result: AnalysisResult, toolVersion = '0.1.0'): string {
  const usedRuleIds = [...new Set(result.findings.map((f) => f.ruleId))];
  const rules = allRules()
    .filter((r) => usedRuleIds.includes(r.id))
    .map((r) => ({
      id: r.id,
      name: r.id.replace('-', ''),
      shortDescription: { text: r.title },
      fullDescription: { text: r.rationale },
      defaultConfiguration: { level: LEVEL[r.defaultSeverity] },
      properties: {
        tags: ['nobble', 'test-integrity'],
        'security-severity': String(RANK[r.defaultSeverity]),
        severity: r.defaultSeverity,
        weight: r.weight,
      },
    }));

  const sarif = {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'Nobble',
            informationUri: 'https://github.com/TheSoloHacker47/nobble',
            version: toolVersion,
            rules,
          },
        },
        results: result.findings.map((f) => ({
          ruleId: f.ruleId,
          level: LEVEL[f.severity],
          message: { text: f.message },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: f.file },
                region: {
                  startLine: Math.max(1, f.line),
                  ...(f.endLine && f.endLine > f.line ? { endLine: f.endLine } : {}),
                },
              },
            },
          ],
          partialFingerprints: { nobbleFingerprint: fingerprint(f) },
          properties: { severity: f.severity, weight: f.weight },
        })),
        columnKind: 'utf16CodeUnits',
      },
    ],
  };
  return JSON.stringify(sarif, null, 2) + '\n';
}
