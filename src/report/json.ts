import type { AnalysisResult } from '../types.js';

export function renderJson(result: AnalysisResult): string {
  return (
    JSON.stringify(
      {
        version: 1,
        score: result.score,
        verdict: result.verdict,
        totalFindings: result.totalFindings,
        filesAnalyzed: result.filesAnalyzed,
        degraded: result.degraded,
        ...(result.degradedReason ? { degradedReason: result.degradedReason } : {}),
        findings: result.findings,
      },
      null,
      2,
    ) + '\n'
  );
}
