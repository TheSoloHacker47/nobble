/** Shared vocabulary. Kept dependency-free so every layer can import it. */

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

/** How `diff/classify.ts` labels each changed file. Drives which rules run. */
export type FileKind = 'test' | 'source' | 'coverage_config' | 'ci_config' | 'other';

export type Verdict = 'pass' | 'warn' | 'block';

export interface Finding {
  ruleId: string; // "NOB-101"
  title: string;
  severity: Severity;
  weight: number;
  file: string;
  line: number;
  endLine?: number;
  /** One sentence, specific, names the symbol. This is what a reviewer actually reads. */
  message: string;
  evidence: { before?: string; after?: string };
  /** The exact comment to paste to silence this finding. */
  suppressWith: string;
}

export interface Line {
  /** 1-based line number in the file this line belongs to (after-file for adds). */
  line: number;
  text: string;
}

export interface AnalysisResult {
  findings: Finding[];
  /** All findings before the display cap; score is computed over these. */
  totalFindings: number;
  score: number;
  verdict: Verdict;
  /** True when before-blobs could not be retrieved and only diff-only rules ran. */
  degraded: boolean;
  degradedReason?: string;
  filesAnalyzed: number;
}
