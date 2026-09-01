#!/usr/bin/env node
import { initParsers, getParser, GRAMMAR_NAMES } from './parsers/index.js';

async function main(): Promise<number> {
  // M0 placeholder: proves the bundle can boot tree-sitter and every grammar.
  await initParsers();
  for (const g of GRAMMAR_NAMES) {
    const parser = await getParser(g);
    const tree = parser.parse('x');
    if (!tree) throw new Error(`grammar ${g} failed to parse`);
  }
  console.log(`nobble: ${GRAMMAR_NAMES.length} grammars loaded`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err: unknown) => {
    console.error(`nobble: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(2);
  },
);
