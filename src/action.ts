import { initParsers, GRAMMAR_NAMES } from './parsers/index.js';

async function main(): Promise<void> {
  // M0 placeholder: real implementation lands in M5.
  await initParsers();
  console.log(`nobble action: ${GRAMMAR_NAMES.length} grammars available`);
}

void main();
