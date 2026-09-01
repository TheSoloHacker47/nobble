import { registerRule } from './index.js';
import { nob001 } from './nob001-unexplained-suppression.js';
import { nob104 } from './nob104-test-skipped.js';
import { nob301 } from './nob301-suppression-added.js';
import { nob302 } from './nob302-exception-swallowed.js';
import { nob303 } from './nob303-timing-bandaid.js';
import { nob401 } from './nob401-coverage-lowered.js';
import { nob402 } from './nob402-ci-neutralized.js';
import { nob403 } from './nob403-test-excluded.js';
import { nob404 } from './nob404-dependency-weakened.js';

/**
 * Single registration point. Importing this module is what makes rules exist; entry points
 * import it once and the registry is populated for the whole process.
 */
let done = false;

export function registerAllRules(): void {
  if (done) return;
  done = true;
  for (const rule of [nob001, nob104, nob301, nob302, nob303, nob401, nob402, nob403, nob404]) {
    registerRule(rule);
  }
}
