import { registerRule } from './index.js';
import { nob001 } from './nob001-unexplained-suppression.js';
import { nob101 } from './nob101-assertions-removed.js';
import { nob102 } from './nob102-assertion-weakened.js';
import { nob103 } from './nob103-test-deleted.js';
import { nob104 } from './nob104-test-skipped.js';
import { nob105 } from './nob105-expectation-inverted.js';
import { nob201 } from './nob201-sensitive-mock.js';
import { nob202 } from './nob202-security-untested.js';
import { nob203 } from './nob203-security-bypass.js';
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
  const rules = [
    nob001,
    nob101,
    nob102,
    nob103,
    nob104,
    nob105,
    nob201,
    nob202,
    nob203,
    nob301,
    nob302,
    nob303,
    nob401,
    nob402,
    nob403,
    nob404,
  ];
  for (const rule of rules) registerRule(rule);
}
