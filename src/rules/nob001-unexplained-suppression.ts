import type { Rule } from './types.js';

/**
 * NOB-001 Unexplained suppression.
 *
 * Emitted by the engine after suppression parsing rather than by scanning a file here,
 * because it is derived from the suppression pass that runs once every other rule has
 * finished. The object exists so NOB-001 flows through config, scoring, and reporting
 * exactly like every other rule.
 *
 * Note that an unexplained suppression does NOT silence its target -- see DECISIONS.md A2.
 */
export const nob001: Rule = {
  id: 'NOB-001',
  title: 'Unexplained suppression',
  defaultSeverity: 'low',
  weight: 5,
  requiresAst: false,
  appliesTo: [],
  rationale:
    'A suppression without a reason is unreviewable. Requiring one keeps the escape hatch honest.',
  run: () => [],
};
