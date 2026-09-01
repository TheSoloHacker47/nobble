import { initParsers } from './parsers/index.js';
import { registerAllRules } from './rules/register.js';

async function main(): Promise<void> {
  // M0/M2 placeholder: the real Action implementation lands in M5.
  registerAllRules();
  await initParsers();
}

void main();
