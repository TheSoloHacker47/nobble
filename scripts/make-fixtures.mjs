#!/usr/bin/env node
/**
 * Writes fixture trees from a compact declaration.
 *
 * Fixtures are small files, but there are a lot of them (every rule needs >=3 positive and
 * >=3 negative cases per language). Declaring them here keeps each case readable as a
 * before/after pair instead of scattered across dozens of tiny directories that have to be
 * opened one at a time to understand. The generated trees are committed and are what the
 * harness actually reads.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

export function writeFixtures(group, cases) {
  const base = path.join(root, 'test', 'fixtures', group);
  for (const c of cases) {
    const dir = path.join(base, c.name);
    fs.rmSync(dir, { recursive: true, force: true });
    for (const [side, files] of [
      ['before', c.before ?? {}],
      ['after', c.after ?? {}],
    ]) {
      for (const [rel, content] of Object.entries(files)) {
        const target = path.join(dir, side, rel);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content);
      }
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'expected.json'),
      JSON.stringify(
        { note: c.note, findings: c.findings ?? [], ...(c.verdict ? { verdict: c.verdict } : {}) },
        null,
        2,
      ) + '\n',
    );
  }
  return cases.length;
}

if (import.meta.filename === process.argv[1]) {
  const { default: cases } = await import('./fixtures/index.mjs');
  let total = 0;
  for (const [group, list] of Object.entries(cases)) {
    total += writeFixtures(group, list);
    console.log(`${group}: ${list.length} fixtures`);
  }
  console.log(`${total} fixtures written`);
}
