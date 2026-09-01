import type { Rule } from './types.js';

/**
 * The rule registry. Adding a rule means writing one file and adding it to this list.
 * Rule IDs are permanent and must never be reused (spec §3).
 */
const registry: Rule[] = [];

export function registerRule(rule: Rule): void {
  if (registry.some((r) => r.id === rule.id)) {
    throw new Error(`duplicate rule id ${rule.id}`);
  }
  registry.push(rule);
}

export function allRules(): Rule[] {
  return [...registry];
}

export function ruleById(id: string): Rule | undefined {
  return registry.find((r) => r.id === id);
}
