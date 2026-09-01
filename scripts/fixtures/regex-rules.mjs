/**
 * Fixtures for the rules that need no AST (M2).
 *
 * Each case is deliberately small. A fixture that needs scrolling is a fixture nobody
 * re-reads when it starts failing.
 */

// --- NOB-104 test skipped ----------------------------------------------------
const nob104 = [
  {
    name: 'nob104-pos-jest-it-skip',
    note: 'Jest test switched to it.skip',
    before: {
      'src/pay.test.ts': "it('charges the card', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    after: {
      'src/pay.test.ts':
        "it.skip('charges the card', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [{ ruleId: 'NOB-104', file: 'src/pay.test.ts', messageContains: 'skipped block' }],
  },
  {
    name: 'nob104-pos-pytest-skip-marker',
    note: 'pytest skip marker added above a test',
    before: { 'tests/test_pay.py': 'def test_charges():\n    assert charge() is True\n' },
    after: {
      'tests/test_pay.py':
        '@pytest.mark.skip(reason="flaky")\ndef test_charges():\n    assert charge() is True\n',
    },
    findings: [
      { ruleId: 'NOB-104', file: 'tests/test_pay.py', messageContains: 'pytest skip marker' },
    ],
  },
  {
    name: 'nob104-pos-rspec-pending',
    note: 'RSpec example turned into a pending stub',
    before: { 'spec/pay_spec.rb': 'it "charges the card" do\n  expect(charge).to eq(true)\nend\n' },
    after: {
      'spec/pay_spec.rb':
        'it "charges the card" do\n  pending\n  expect(charge).to eq(true)\nend\n',
    },
    findings: [
      { ruleId: 'NOB-104', file: 'spec/pay_spec.rb', messageContains: 'RSpec skip/pending' },
    ],
  },
  {
    name: 'nob104-neg-word-skip-in-string',
    note: 'The word "skip" appears in test data, not as a skip directive',
    before: {
      'src/pay.test.ts': "it('handles skip links', () => {\n  expect(nav()).toBe(1);\n});\n",
    },
    after: {
      'src/pay.test.ts':
        "it('handles skip links', () => {\n  expect(nav()).toBe(1);\n  expect(nav().skip).toBe(false);\n});\n",
    },
    findings: [],
  },
  {
    name: 'nob104-neg-skip-removed',
    note: 'A skip being REMOVED is the good direction and must not fire',
    before: {
      'src/pay.test.ts': "it.skip('charges', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    after: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    findings: [],
  },
  {
    name: 'nob104-neg-commented-out-skip',
    note: 'A skip mentioned inside a comment is not a skip',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "it('charges', () => {\n  // do not use it.skip here, fix the code instead\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [],
  },
];

// --- NOB-301 suppression added ----------------------------------------------
const nob301 = [
  {
    name: 'nob301-pos-ts-expect-error',
    note: '@ts-expect-error added to silence the type checker',
    before: { 'src/pay.ts': 'export function charge(n: number) {\n  return n;\n}\n' },
    after: {
      'src/pay.ts':
        'export function charge(n: number) {\n  // @ts-expect-error shape changed\n  return n.total;\n}\n',
    },
    findings: [{ ruleId: 'NOB-301', file: 'src/pay.ts', messageContains: '@ts-expect-error' }],
  },
  {
    name: 'nob301-pos-as-any',
    note: 'as any cast added',
    before: { 'src/pay.ts': 'export const user = getUser();\n' },
    after: { 'src/pay.ts': 'export const user = getUser() as any;\n' },
    findings: [{ ruleId: 'NOB-301', file: 'src/pay.ts', messageContains: 'as any' }],
  },
  {
    name: 'nob301-pos-noqa-fires-once',
    note: 'Three # noqa on one file yields exactly one finding, not three',
    before: { 'src/pay.py': 'import os\nimport sys\nimport json\n' },
    after: { 'src/pay.py': 'import os  # noqa\nimport sys  # noqa\nimport json  # noqa\n' },
    findings: [{ ruleId: 'NOB-301', file: 'src/pay.py', messageContains: 'noqa' }],
  },
  {
    name: 'nob301-neg-targeted-type-ignore',
    note: 'A coded `# type: ignore[return-value]` silences one identified error, not everything',
    before: { 'src/pay.py': 'def name(self) -> str:\n    return self._name\n' },
    after: {
      'src/pay.py': 'def name(self) -> str:\n    return self._name  # type: ignore[return-value]\n',
    },
    findings: [],
  },
  {
    name: 'nob301-neg-targeted-noqa-and-eslint',
    note: 'Coded `# noqa: F821` and a rule-named eslint-disable are narrow, reviewable decisions',
    before: {
      'src/pay.py': 'raise SomeError(message)\n',
      'src/pay.ts': 'import { a } from "./a";\n',
    },
    after: {
      'src/pay.py': 'raise BaseExceptionGroup(message, errors)  # noqa: F821\n',
      'src/pay.ts':
        '// eslint-disable-next-line import-x/no-duplicates\nimport { a } from "./a";\n',
    },
    findings: [],
  },
  {
    name: 'nob301-pos-blanket-type-ignore',
    note: 'A bare `# type: ignore` silences every present and future error on the line',
    before: { 'src/pay.py': 'def name(self) -> str:\n    return self._name\n' },
    after: { 'src/pay.py': 'def name(self) -> str:  # type: ignore\n    return self._name\n' },
    findings: [{ ruleId: 'NOB-301', file: 'src/pay.py', messageContains: 'Blanket' }],
  },
  {
    name: 'nob301-neg-suppression-removed',
    note: 'Removing a suppression is the good direction',
    before: { 'src/pay.ts': '// @ts-ignore\nexport const a = f();\n' },
    after: { 'src/pay.ts': 'export const a: Total = f();\n' },
    findings: [],
  },
  {
    name: 'nob301-neg-any-in-prose',
    note: 'The words "as any" inside a comment are not a cast',
    before: { 'src/pay.ts': 'export const a = 1;\n' },
    after: {
      'src/pay.ts': 'export const a = 1;\n// This works for as many rows as any caller needs.\n',
    },
    findings: [],
  },
  {
    name: 'nob301-neg-typed-generic',
    note: 'A real generic annotation is not a suppression',
    before: { 'src/pay.ts': 'export const rows = [];\n' },
    after: { 'src/pay.ts': 'export const rows: Array<Row> = [];\n' },
    findings: [],
  },
];

// --- NOB-303 timing band-aid -------------------------------------------------
const nob303 = [
  {
    name: 'nob303-pos-settimeout-in-test',
    note: 'A raw sleep added to a test to paper over a race',
    before: {
      'src/pay.test.ts':
        "it('settles', async () => {\n  await settle();\n  expect(done()).toBe(true);\n});\n",
    },
    after: {
      'src/pay.test.ts':
        "it('settles', async () => {\n  await settle();\n  await new Promise(r => setTimeout(r, 500));\n  expect(done()).toBe(true);\n});\n",
    },
    findings: [{ ruleId: 'NOB-303', file: 'src/pay.test.ts' }],
  },
  {
    name: 'nob303-pos-time-sleep-python',
    note: 'time.sleep added to a python test',
    before: { 'tests/test_pay.py': 'def test_settles():\n    settle()\n    assert done()\n' },
    after: {
      'tests/test_pay.py':
        'def test_settles():\n    settle()\n    time.sleep(2)\n    assert done()\n',
    },
    findings: [{ ruleId: 'NOB-303', file: 'tests/test_pay.py' }],
  },
  {
    name: 'nob303-pos-sleep-in-ruby-spec',
    note: 'sleep added to an RSpec example',
    before: { 'spec/pay_spec.rb': 'it "settles" do\n  settle\n  expect(done).to eq(true)\nend\n' },
    after: {
      'spec/pay_spec.rb': 'it "settles" do\n  settle\n  sleep 1\n  expect(done).to eq(true)\nend\n',
    },
    findings: [{ ruleId: 'NOB-303', file: 'spec/pay_spec.rb' }],
  },
  {
    name: 'nob303-neg-sleep-replaced-by-proper-wait',
    note: 'MANDATORY NEGATIVE: a flaky test correctly fixed by replacing a sleep with a real wait',
    before: {
      'src/pay.test.ts':
        "it('settles', async () => {\n  await new Promise(r => setTimeout(r, 500));\n  expect(done()).toBe(true);\n});\n",
    },
    after: {
      'src/pay.test.ts':
        "it('settles', async () => {\n  await waitFor(() => expect(done()).toBe(true));\n});\n",
    },
    findings: [],
  },
  {
    name: 'nob303-neg-waitfor-added',
    note: 'A proper wait helper is the correct fix, not a band-aid',
    before: {
      'src/pay.test.ts': "it('settles', async () => {\n  expect(done()).toBe(true);\n});\n",
    },
    after: {
      'src/pay.test.ts':
        "it('settles', async () => {\n  await waitUntil(() => done());\n  expect(done()).toBe(true);\n});\n",
    },
    findings: [],
  },
  {
    name: 'nob303-neg-settimeout-in-plain-source',
    note: 'A setTimeout in ordinary source code with no retry context is normal application code',
    before: { 'src/debounce.ts': 'export function debounce(fn: () => void) {\n  return fn;\n}\n' },
    after: {
      'src/debounce.ts':
        'export function debounce(fn: () => void) {\n  return () => setTimeout(fn, 100);\n}\n',
    },
    findings: [],
  },
];

// --- NOB-401 coverage threshold lowered --------------------------------------
const nob401 = [
  {
    name: 'nob401-pos-jest-threshold',
    note: 'Jest global coverage threshold dropped',
    before: {
      'jest.config.js': 'module.exports = {\n  coverageThreshold: { global: { lines: 90 } },\n};\n',
    },
    after: {
      'jest.config.js': 'module.exports = {\n  coverageThreshold: { global: { lines: 45 } },\n};\n',
    },
    findings: [
      { ruleId: 'NOB-401', file: 'jest.config.js', messageContains: 'lowered from 90 to 45' },
    ],
  },
  {
    name: 'nob401-pos-pyproject-fail-under',
    note: 'pyproject fail_under lowered',
    before: { 'pyproject.toml': '[tool.coverage.report]\nfail_under = 85\n' },
    after: { 'pyproject.toml': '[tool.coverage.report]\nfail_under = 50\n' },
    findings: [
      { ruleId: 'NOB-401', file: 'pyproject.toml', messageContains: 'lowered from 85 to 50' },
    ],
  },
  {
    name: 'nob401-pos-coveragerc',
    note: 'coveragerc fail_under lowered',
    before: { '.coveragerc': '[report]\nfail_under = 80\n' },
    after: { '.coveragerc': '[report]\nfail_under = 60\n' },
    findings: [
      { ruleId: 'NOB-401', file: '.coveragerc', messageContains: 'lowered from 80 to 60' },
    ],
  },
  {
    name: 'nob401-neg-threshold-raised',
    note: 'Raising the bar must never fire',
    before: {
      'jest.config.js': 'module.exports = {\n  coverageThreshold: { global: { lines: 70 } },\n};\n',
    },
    after: {
      'jest.config.js': 'module.exports = {\n  coverageThreshold: { global: { lines: 95 } },\n};\n',
    },
    findings: [],
  },
  {
    name: 'nob401-neg-unrelated-number',
    note: 'A version or timeout number changing is not a coverage threshold',
    before: {
      'jest.config.js': 'module.exports = {\n  testTimeout: 30000,\n  maxWorkers: 4,\n};\n',
    },
    after: { 'jest.config.js': 'module.exports = {\n  testTimeout: 5000,\n  maxWorkers: 2,\n};\n' },
    findings: [],
  },
  {
    name: 'nob401-neg-reformatted-only',
    note: 'Reformatting the same threshold must not look like a change',
    before: {
      'jest.config.js': 'module.exports = { coverageThreshold: { global: { lines: 90 } } };\n',
    },
    after: {
      'jest.config.js':
        'module.exports = {\n  coverageThreshold: {\n    global: { lines: 90 },\n  },\n};\n',
    },
    findings: [],
  },
];

// --- NOB-402 CI neutralized ---------------------------------------------------
const nob402 = [
  {
    name: 'nob402-pos-continue-on-error',
    note: 'continue-on-error added to the test step',
    before: {
      '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: npm test\n',
    },
    after: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: npm test\n        continue-on-error: true\n',
    },
    findings: [
      { ruleId: 'NOB-402', file: '.github/workflows/ci.yml', messageContains: 'continue-on-error' },
    ],
  },
  {
    name: 'nob402-pos-or-true',
    note: '|| true appended to a test command',
    before: { '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: pytest\n' },
    after: {
      '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: pytest || true\n',
    },
    findings: [{ ruleId: 'NOB-402', file: '.github/workflows/ci.yml', messageContains: '|| true' }],
  },
  {
    name: 'nob402-pos-step-removed',
    note: 'The lint step was deleted outright',
    before: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: npm run lint\n      - run: npm test\n',
    },
    after: { '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: npm test\n' },
    findings: [
      { ruleId: 'NOB-402', file: '.github/workflows/ci.yml', messageContains: 'was removed' },
    ],
  },
  {
    name: 'nob402-neg-continue-on-error-false',
    note: 'Setting continue-on-error to false is the good direction',
    before: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: npm test\n        continue-on-error: true\n',
    },
    after: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: npm test\n        continue-on-error: false\n',
    },
    findings: [],
  },
  {
    name: 'nob402-neg-step-reordered',
    note: 'Reordering steps is not removing them',
    before: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: npm run lint\n      - run: npm test\n',
    },
    after: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: npm test\n      - run: npm run lint\n',
    },
    findings: [],
  },
  {
    name: 'nob402-neg-unrelated-or-true',
    note: '|| true on a cleanup command that checks nothing is normal shell hygiene',
    before: { '.github/workflows/ci.yml': 'jobs:\n  test:\n    steps:\n      - run: npm test\n' },
    after: {
      '.github/workflows/ci.yml':
        'jobs:\n  test:\n    steps:\n      - run: rm -rf tmp || true\n      - run: npm test\n',
    },
    findings: [],
  },
];

// --- NOB-403 test excluded ----------------------------------------------------
const nob403 = [
  {
    name: 'nob403-pos-jest-ignore-pattern',
    note: 'A test directory added to testPathIgnorePatterns',
    before: { 'jest.config.js': 'module.exports = {\n  testPathIgnorePatterns: [],\n};\n' },
    after: {
      'jest.config.js':
        "module.exports = {\n  testPathIgnorePatterns: ['<rootDir>/tests/payments/'],\n};\n",
    },
    findings: [{ ruleId: 'NOB-403', file: 'jest.config.js' }],
  },
  {
    name: 'nob403-pos-eslintignore',
    note: 'Test glob added to .eslintignore',
    before: { '.eslintignore': 'dist/\n' },
    after: { '.eslintignore': 'dist/\nsrc/**/*.test.ts\n' },
    findings: [{ ruleId: 'NOB-403', file: '.eslintignore' }],
  },
  {
    name: 'nob403-pos-pytest-norecursedirs',
    note: 'Test dir added to norecursedirs',
    before: { 'setup.cfg': '[tool:pytest]\nnorecursedirs = build\n' },
    after: { 'setup.cfg': '[tool:pytest]\nnorecursedirs = build tests/integration\n' },
    findings: [{ ruleId: 'NOB-403', file: 'setup.cfg' }],
  },
  {
    name: 'nob403-neg-non-test-exclusion',
    note: 'Excluding build output is routine and has nothing to do with tests',
    before: { 'jest.config.js': 'module.exports = {\n  testPathIgnorePatterns: [],\n};\n' },
    after: {
      'jest.config.js':
        "module.exports = {\n  testPathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/node_modules/'],\n};\n",
    },
    findings: [],
  },
  {
    name: 'nob403-neg-exclusion-removed',
    note: 'Removing an exclusion is the good direction',
    before: { '.eslintignore': 'dist/\nsrc/**/*.test.ts\n' },
    after: { '.eslintignore': 'dist/\n' },
    findings: [],
  },
  {
    name: 'nob403-neg-test-glob-added-to-inclusion',
    note: 'Adding a test glob to an INCLUSION list is the opposite of excluding it',
    before: { 'jest.config.js': "module.exports = {\n  testMatch: ['**/*.test.ts'],\n};\n" },
    after: {
      'jest.config.js': "module.exports = {\n  testMatch: ['**/*.test.ts', '**/*.spec.ts'],\n};\n",
    },
    findings: [],
  },
];

// --- NOB-404 dependency weakened ---------------------------------------------
const nob404 = [
  {
    name: 'nob404-pos-integrity-removed',
    note: 'Lockfile integrity hashes removed with nothing put back',
    before: {
      'package-lock.json':
        '{\n  "packages": {\n    "node_modules/left-pad": {\n      "version": "1.3.0",\n      "resolved": "https://registry.npmjs.org/left-pad/-/left-pad-1.3.0.tgz",\n      "integrity": "sha512-AAA"\n    }\n  }\n}\n',
    },
    after: {
      'package-lock.json':
        '{\n  "packages": {\n    "node_modules/left-pad": {\n      "version": "1.3.0"\n    }\n  }\n}\n',
    },
    findings: [{ ruleId: 'NOB-404', file: 'package-lock.json', messageContains: 'integrity' }],
  },
  {
    name: 'nob404-pos-major-downgrade',
    note: 'A dependency walked back a major version',
    before: { 'package.json': '{\n  "dependencies": {\n    "vitest": "^4.1.0"\n  }\n}\n' },
    after: { 'package.json': '{\n  "dependencies": {\n    "vitest": "^2.0.0"\n  }\n}\n' },
    findings: [
      { ruleId: 'NOB-404', file: 'package.json', messageContains: 'downgraded from major 4 to 2' },
    ],
  },
  {
    name: 'nob404-pos-two-major-downgrades',
    note: 'Two dependencies downgraded gives two findings',
    before: {
      'package.json':
        '{\n  "dependencies": {\n    "vitest": "^4.1.0",\n    "eslint": "^9.0.0"\n  }\n}\n',
    },
    after: {
      'package.json':
        '{\n  "dependencies": {\n    "vitest": "^2.0.0",\n    "eslint": "^7.0.0"\n  }\n}\n',
    },
    findings: [
      { ruleId: 'NOB-404', file: 'package.json', messageContains: 'vitest' },
      { ruleId: 'NOB-404', file: 'package.json', messageContains: 'eslint' },
    ],
  },
  {
    name: 'nob404-neg-major-upgrade',
    note: 'MANDATORY NEGATIVE: an ordinary dependency upgrade',
    before: { 'package.json': '{\n  "dependencies": {\n    "vitest": "^3.0.0"\n  }\n}\n' },
    after: { 'package.json': '{\n  "dependencies": {\n    "vitest": "^4.1.0"\n  }\n}\n' },
    findings: [],
  },
  {
    name: 'nob404-neg-integrity-changed-not-removed',
    note: 'A normal lockfile bump swaps integrity hashes rather than dropping them',
    before: {
      'package-lock.json':
        '{\n  "packages": {\n    "node_modules/left-pad": {\n      "version": "1.3.0",\n      "integrity": "sha512-AAA"\n    }\n  }\n}\n',
    },
    after: {
      'package-lock.json':
        '{\n  "packages": {\n    "node_modules/left-pad": {\n      "version": "1.4.0",\n      "integrity": "sha512-BBB"\n    }\n  }\n}\n',
    },
    findings: [],
  },
  {
    name: 'nob404-neg-patch-downgrade',
    note: 'A patch-level rollback is not a major downgrade',
    before: { 'package.json': '{\n  "dependencies": {\n    "vitest": "^4.1.5"\n  }\n}\n' },
    after: { 'package.json': '{\n  "dependencies": {\n    "vitest": "^4.1.2"\n  }\n}\n' },
    findings: [],
  },
];

// --- NOB-302 exception swallowed ---------------------------------------------
const nob302 = [
  {
    name: 'nob302-pos-empty-catch',
    note: 'An empty catch added around code that used to propagate',
    before: { 'src/pay.ts': 'export function charge() {\n  return doCharge();\n}\n' },
    after: {
      'src/pay.ts':
        'export function charge() {\n  try {\n    return doCharge();\n  } catch (e) {\n  }\n}\n',
    },
    findings: [{ ruleId: 'NOB-302', file: 'src/pay.ts', messageContains: 'Empty' }],
  },
  {
    name: 'nob302-pos-except-pass',
    note: 'except Exception: pass added',
    before: { 'src/pay.py': 'def charge():\n    return do_charge()\n' },
    after: {
      'src/pay.py':
        'def charge():\n    try:\n        return do_charge()\n    except Exception:\n        pass\n',
    },
    findings: [{ ruleId: 'NOB-302', file: 'src/pay.py' }],
  },
  {
    name: 'nob302-pos-log-only-catch',
    note: 'A catch that only logs still swallows the failure',
    before: { 'src/pay.ts': 'export function charge() {\n  return doCharge();\n}\n' },
    after: {
      'src/pay.ts':
        'export function charge() {\n  try {\n    return doCharge();\n  } catch (e) {\n    console.error(e);\n  }\n}\n',
    },
    findings: [{ ruleId: 'NOB-302', file: 'src/pay.ts', messageContains: 'only logs' }],
  },
  {
    name: 'nob302-neg-catch-rethrows',
    note: 'A catch that rethrows is real handling',
    before: { 'src/pay.ts': 'export function charge() {\n  return doCharge();\n}\n' },
    after: {
      'src/pay.ts':
        'export function charge() {\n  try {\n    return doCharge();\n  } catch (e) {\n    throw new ChargeError(e);\n  }\n}\n',
    },
    findings: [],
  },
  {
    name: 'nob302-neg-catch-reports',
    note: 'A catch that reports to an error tracker and returns a fallback is handling',
    before: { 'src/pay.ts': 'export function charge() {\n  return doCharge();\n}\n' },
    after: {
      'src/pay.ts':
        'export function charge() {\n  try {\n    return doCharge();\n  } catch (e) {\n    captureException(e);\n    return null;\n  }\n}\n',
    },
    findings: [],
  },
  {
    name: 'nob302-neg-except-raises',
    note: 'A python except that re-raises is handling',
    before: { 'src/pay.py': 'def charge():\n    return do_charge()\n' },
    after: {
      'src/pay.py':
        'def charge():\n    try:\n        return do_charge()\n    except ValueError as e:\n        raise ChargeError from e\n',
    },
    findings: [],
  },
];

// --- NOB-001 unexplained suppression -----------------------------------------
const nob001 = [
  {
    name: 'nob001-pos-empty-reason',
    note: 'A suppression with nothing after the colon: the original finding survives AND NOB-001 fires',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "// nobble-ignore NOB-104:\nit.skip('charges', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [
      { ruleId: 'NOB-104', file: 'src/pay.test.ts' },
      { ruleId: 'NOB-001', file: 'src/pay.test.ts', messageContains: 'no reason' },
    ],
  },
  {
    name: 'nob001-pos-no-colon',
    note: 'A suppression with no colon at all is also unexplained',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "// nobble-ignore NOB-104\nit.skip('charges', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [
      { ruleId: 'NOB-104', file: 'src/pay.test.ts' },
      { ruleId: 'NOB-001', file: 'src/pay.test.ts' },
    ],
  },
  {
    name: 'nob001-pos-stray-suppression',
    note: 'A reasonless suppression is reported even when it matched no finding',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "// nobble-ignore NOB-102:\nit('charges', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [{ ruleId: 'NOB-001', file: 'src/pay.test.ts' }],
  },
  {
    name: 'nob001-neg-good-suppression',
    note: 'A suppression with a real reason silences the finding and reports nothing itself',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "// nobble-ignore NOB-104: provider sandbox is down until 2026-10-01, see #482\nit.skip('charges', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [],
  },
  {
    name: 'nob001-neg-no-suppressions',
    note: 'A file with no suppression comments produces no NOB-001',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "it('charges', () => {\n  expect(charge()).toBe(true);\n  expect(fee()).toBe(2);\n});\n",
    },
    findings: [],
  },
  {
    name: 'nob001-neg-suppression-for-other-rule',
    note: 'A well-formed suppression naming a different rule leaves this finding alone',
    before: { 'src/pay.test.ts': "it('charges', () => {\n  expect(charge()).toBe(true);\n});\n" },
    after: {
      'src/pay.test.ts':
        "// nobble-ignore NOB-999: unrelated but well formed\nit.skip('charges', () => {\n  expect(charge()).toBe(true);\n});\n",
    },
    findings: [{ ruleId: 'NOB-104', file: 'src/pay.test.ts' }],
  },
];

export default [
  ...nob104,
  ...nob301,
  ...nob302,
  ...nob303,
  ...nob401,
  ...nob402,
  ...nob403,
  ...nob404,
  ...nob001,
];
