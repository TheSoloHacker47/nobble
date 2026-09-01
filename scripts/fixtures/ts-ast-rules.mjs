/**
 * Fixtures for the AST rules, TypeScript/JavaScript flavour (M3).
 *
 * The negatives matter more than the positives here. Every one of these rules compares a
 * before and after tree, and the ways ordinary refactoring can look like tampering are
 * exactly what the <10% finding-rate gate in the spec is measuring.
 */

// --- NOB-101 assertions removed ----------------------------------------------
const nob101 = [
  {
    name: 'nob101-pos-three-assertions-dropped',
    note: 'Three of four assertions deleted while the test keeps its name',
    before: {
      'src/pay.test.ts': `describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).toBe(1000);
    expect(fee()).toBe(30);
    expect(currency()).toBe('usd');
    expect(receipt()).toEqual({ id: 1 });
  });
});
`,
    },
    after: {
      'src/pay.test.ts': `describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).toBe(1000);
  });
});
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'src/pay.test.ts', messageContains: '3 assertions removed' },
    ],
  },
  {
    name: 'nob101-pos-single-assertion-dropped',
    note: 'One assertion removed from a two-assertion test',
    before: {
      'src/pay.test.ts': `it('refunds', () => {
  expect(refund()).toBe(500);
  expect(balance()).toBe(0);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('refunds', () => {
  expect(refund()).toBe(500);
});
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'src/pay.test.ts', messageContains: '1 assertion removed' },
    ],
  },
  {
    name: 'nob101-pos-two-blocks-each-lose-one',
    note: 'Assertions removed from two different tests gives two findings',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(a()).toBe(1);
  expect(b()).toBe(2);
});
it('refunds', () => {
  expect(c()).toBe(3);
  expect(d()).toBe(4);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(a()).toBe(1);
});
it('refunds', () => {
  expect(c()).toBe(3);
});
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'src/pay.test.ts', messageContains: 'charges' },
      { ruleId: 'NOB-101', file: 'src/pay.test.ts', messageContains: 'refunds' },
    ],
  },
  {
    name: 'nob101-neg-test-split-in-two',
    note: 'MANDATORY NEGATIVE: a test split into two smaller tests, assertion count unchanged',
    before: {
      'src/pay.test.ts': `it('charges and refunds', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
  expect(refund()).toBe(500);
  expect(balance()).toBe(0);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
it('refunds', () => {
  expect(refund()).toBe(500);
  expect(balance()).toBe(0);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-mocha-to-jest-refactor',
    note: 'MANDATORY NEGATIVE: a suite ported from Mocha/Chai to Jest with every assertion intact',
    before: {
      'src/pay.test.ts': `describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).to.equal(1000);
    expect(fee()).to.equal(30);
    expect(currency()).to.equal('usd');
  });
});
`,
    },
    after: {
      'src/pay.test.ts': `describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).toBe(1000);
    expect(fee()).toBe(30);
    expect(currency()).toBe('usd');
  });
});
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-assertions-added',
    note: 'Adding assertions is the good direction',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-feature-and-tests-deleted-together',
    note: 'MANDATORY NEGATIVE: a feature deleted along with its tests, source file also deleted',
    before: {
      'src/legacy.ts': 'export const legacy = () => 1;\n',
      'src/legacy.test.ts': `it('legacy works', () => {
  expect(legacy()).toBe(1);
  expect(legacy()).toBeDefined();
});
`,
      'src/keep.ts': 'export const keep = () => 2;\n',
    },
    after: {
      'src/keep.ts': 'export const keep = () => 2;\n',
    },
    findings: [],
  },
];

// --- NOB-102 assertion weakened ----------------------------------------------
const nob102 = [
  {
    name: 'nob102-pos-tobe-to-tobetruthy',
    note: 'Exact comparison replaced with a truthiness check',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBeTruthy();
});
`,
    },
    findings: [
      { ruleId: 'NOB-102', file: 'src/pay.test.ts', messageContains: '`toBe` → `toBeTruthy`' },
    ],
  },
  {
    name: 'nob102-pos-calledwith-to-called',
    note: 'toHaveBeenCalledWith downgraded to toHaveBeenCalled',
    before: {
      'src/pay.test.ts': `it('notifies', () => {
  expect(notify).toHaveBeenCalledWith('user-1', 1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('notifies', () => {
  expect(notify).toHaveBeenCalled();
});
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'src/pay.test.ts', messageContains: 'toHaveBeenCalled' }],
  },
  {
    name: 'nob102-pos-exact-value-to-wildcard',
    note: 'Exact argument replaced with expect.any, keeping the same matcher',
    before: {
      'src/pay.test.ts': `it('notifies', () => {
  expect(notify).toHaveBeenCalledWith(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('notifies', () => {
  expect(notify).toHaveBeenCalledWith(expect.any(Number));
});
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'src/pay.test.ts', messageContains: 'wildcard' }],
  },
  {
    name: 'nob102-neg-strengthened',
    note: 'Replacing a weak matcher with a strong one is the good direction',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBeTruthy();
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob102-neg-same-strength-different-matcher',
    note: 'toBe to toEqual is a lateral move, not a weakening',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(receipt()).toBe(expected);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(receipt()).toEqual(expected);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob102-neg-dependency-syntax-change',
    note: 'MANDATORY NEGATIVE: a dependency upgrade that changes assertion syntax mechanically',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).to.equal(1000);
  expect(fee()).to.equal(30);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toEqual(1000);
  expect(fee()).toEqual(30);
});
`,
    },
    findings: [],
  },
];

// --- NOB-103 test block deleted ----------------------------------------------
const nob103 = [
  {
    name: 'nob103-pos-block-deleted',
    note: 'A whole test case removed with nothing resembling it added back',
    before: {
      'src/pay.test.ts': `it('charges the card', () => {
  expect(charge()).toBe(1000);
});
it('rejects an expired card', () => {
  expect(() => charge(expired)).toThrow();
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges the card', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    findings: [
      { ruleId: 'NOB-103', file: 'src/pay.test.ts', messageContains: 'rejects an expired card' },
    ],
  },
  {
    name: 'nob103-pos-two-blocks-deleted',
    note: 'Two cases removed gives two findings',
    before: {
      'src/pay.test.ts': `it('a one', () => { expect(a()).toBe(1); });
it('b two', () => { expect(b()).toBe(2); });
it('c three', () => { expect(c()).toBe(3); });
`,
    },
    after: {
      'src/pay.test.ts': `it('a one', () => { expect(a()).toBe(1); });
`,
    },
    findings: [
      { ruleId: 'NOB-103', file: 'src/pay.test.ts', messageContains: 'b two' },
      { ruleId: 'NOB-103', file: 'src/pay.test.ts', messageContains: 'c three' },
    ],
  },
  {
    name: 'nob103-pos-suite-deleted',
    note: 'An entire describe block removed',
    before: {
      'src/pay.test.ts': `describe('refunds', () => {
  it('refunds in full', () => { expect(refund()).toBe(500); });
});
describe('charges', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
});
`,
    },
    after: {
      'src/pay.test.ts': `describe('charges', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
});
`,
    },
    findings: [{ ruleId: 'NOB-103', file: 'src/pay.test.ts', messageContains: 'refunds in full' }],
  },
  {
    name: 'nob103-neg-test-renamed',
    note: 'MANDATORY NEGATIVE: a test renamed with all assertions intact',
    before: {
      'src/pay.test.ts': `it('charges the card', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges the card correctly', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob103-neg-file-renamed',
    note: 'MANDATORY NEGATIVE: a test file renamed with all assertions intact',
    before: {
      'src/pay.test.ts': `it('charges the card', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
`,
    },
    after: {
      'src/payments.test.ts': `it('charges the card', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob103-neg-block-moved-to-another-describe',
    note: 'Reorganising blocks between suites keeps every assertion',
    before: {
      'src/pay.test.ts': `describe('all', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
  it('refunds', () => { expect(refund()).toBe(500); });
});
`,
    },
    after: {
      'src/pay.test.ts': `describe('charging', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
});
describe('refunding', () => {
  it('refunds', () => { expect(refund()).toBe(500); });
});
`,
    },
    findings: [],
  },
];

// --- NOB-105 expectation inverted --------------------------------------------
const nob105 = [
  {
    name: 'nob105-pos-not-added',
    note: 'toBe inverted with .not',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).not.toBe(1000);
});
`,
    },
    findings: [{ ruleId: 'NOB-105', file: 'src/pay.test.ts', messageContains: 'inverted' }],
  },
  {
    name: 'nob105-pos-toequal-inverted',
    note: 'toEqual inverted',
    before: {
      'src/pay.test.ts': `it('builds a receipt', () => {
  expect(receipt()).toEqual({ id: 1 });
});
`,
    },
    after: {
      'src/pay.test.ts': `it('builds a receipt', () => {
  expect(receipt()).not.toEqual({ id: 1 });
});
`,
    },
    findings: [{ ruleId: 'NOB-105', file: 'src/pay.test.ts' }],
  },
  {
    name: 'nob105-pos-two-inverted',
    note: 'Two assertions inverted in the same test',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(a()).toBe(1);
  expect(b()).toBe(2);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(a()).not.toBe(1);
  expect(b()).not.toBe(2);
});
`,
    },
    findings: [
      { ruleId: 'NOB-105', file: 'src/pay.test.ts' },
      { ruleId: 'NOB-105', file: 'src/pay.test.ts' },
    ],
  },
  {
    name: 'nob105-neg-negation-removed',
    note: 'Removing a negation is the good direction',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).not.toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob105-neg-already-negated',
    note: 'An assertion that was always negated is not an inversion',
    before: {
      'src/pay.test.ts': `it('rejects', () => {
  expect(charge(bad)).not.toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('rejects', () => {
  expect(charge(bad)).not.toBe(2000);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob105-neg-new-negated-assertion-added',
    note: 'Adding a new negated assertion alongside the old one is extra coverage',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
  expect(charge()).not.toBe(0);
});
`,
    },
    findings: [],
  },
];

// --- NOB-201 sensitive mock ---------------------------------------------------
const nob201 = [
  {
    name: 'nob201-pos-mock-current-user',
    note: 'jest.mock introduced around current_user',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `jest.mock('../auth/current_user');
it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'src/pay.test.ts', messageContains: 'current_user' }],
  },
  {
    name: 'nob201-pos-spyon-authorize',
    note: 'spyOn used to stub an authorization check',
    before: {
      'src/pay.test.ts': `it('charges', () => {
  expect(charge()).toBe(1000);
});
`,
    },
    after: {
      'src/pay.test.ts': `it('charges', () => {
  jest.spyOn(policy, 'authorize').mockReturnValue(true);
  expect(charge()).toBe(1000);
});
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'src/pay.test.ts', messageContains: 'authorize' }],
  },
  {
    name: 'nob201-pos-vi-mock-session',
    note: 'vi.mock introduced around the session module',
    before: { 'src/pay.test.ts': `it('a', () => { expect(x()).toBe(1); });\n` },
    after: {
      'src/pay.test.ts': `vi.mock('./session', () => ({ currentSession: () => ({ id: 1 }) }));
it('a', () => { expect(x()).toBe(1); });
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'src/pay.test.ts', messageContains: 'session' }],
  },
  {
    name: 'nob201-neg-mock-of-innocuous-module',
    note: 'Mocking a formatter has nothing to do with security',
    before: { 'src/pay.test.ts': `it('a', () => { expect(x()).toBe(1); });\n` },
    after: {
      'src/pay.test.ts': `jest.mock('../utils/date-formatter');
it('a', () => { expect(x()).toBe(1); });
`,
    },
    findings: [],
  },
  {
    name: 'nob201-neg-mock-already-present',
    note: 'A mock that existed before this change is not this PR introducing it',
    before: {
      'src/pay.test.ts': `jest.mock('../auth/current_user');
it('a', () => { expect(x()).toBe(1); });
`,
    },
    after: {
      'src/pay.test.ts': `jest.mock('../auth/current_user');
it('a', () => { expect(x()).toBe(1); });
it('b', () => { expect(y()).toBe(2); });
`,
    },
    findings: [],
  },
  {
    name: 'nob201-neg-mock-removed',
    note: 'Removing a sensitive mock is the good direction',
    before: {
      'src/pay.test.ts': `jest.mock('../auth/current_user');
it('a', () => { expect(x()).toBe(1); });
`,
    },
    after: { 'src/pay.test.ts': `it('a', () => { expect(x()).toBe(1); });\n` },
    findings: [],
  },
];

// --- NOB-202 security change without test coverage ----------------------------
const nob202 = [
  {
    name: 'nob202-pos-policy-changed-test-untouched',
    note: 'A policy file changed while its paired test was not touched',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
});
`,
    },
    after: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin" || u.role === "staff";\n}\n',
      'src/policies/admin.test.ts': `it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
});
`,
    },
    findings: [
      { ruleId: 'NOB-202', file: 'src/policies/admin.ts', messageContains: 'was not touched' },
    ],
  },
  {
    name: 'nob202-pos-middleware-changed-test-untouched',
    note: 'Auth middleware changed with its test left alone',
    before: {
      'src/middleware/auth.ts':
        'export function requireUser(req: Req) {\n  return Boolean(req.user);\n}\n',
      'src/middleware/auth.test.ts': `it('requires a user', () => {
  expect(requireUser({})).toBe(false);
});
`,
    },
    after: {
      'src/middleware/auth.ts':
        'export function requireUser(req: Req) {\n  return Boolean(req.user) || req.headers.bypass === "1";\n}\n',
      'src/middleware/auth.test.ts': `it('requires a user', () => {
  expect(requireUser({})).toBe(false);
});
`,
    },
    findings: [{ ruleId: 'NOB-202', file: 'src/middleware/auth.ts' }],
  },
  {
    name: 'nob202-pos-security-changed-test-lost-assertions',
    note: 'Security code changed AND its test lost assertions in the same diff',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('checks roles', () => {
  expect(canAdmin(admin)).toBe(true);
  expect(canAdmin(guest)).toBe(false);
  expect(canAdmin(null)).toBe(false);
});
`,
    },
    after: {
      'src/policies/admin.ts': 'export function canAdmin(u: User) {\n  return true;\n}\n',
      'src/policies/admin.test.ts': `it('checks roles', () => {
  expect(canAdmin(admin)).toBe(true);
});
`,
    },
    findings: [
      { ruleId: 'NOB-202', file: 'src/policies/admin.ts', messageContains: 'lost' },
      { ruleId: 'NOB-101', file: 'src/policies/admin.test.ts' },
      { ruleId: 'NOB-203', file: 'src/policies/admin.ts' },
    ],
  },
  {
    name: 'nob202-neg-security-changed-with-new-tests',
    note: 'Security code changed and the test updated alongside it: exactly right',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
});
`,
    },
    after: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin" || u.role === "staff";\n}\n',
      'src/policies/admin.test.ts': `it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
  expect(canAdmin(staff)).toBe(true);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob202-neg-comment-only-change',
    note: 'A comment-only edit to a security file changes no behaviour',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
});
`,
    },
    after: {
      'src/policies/admin.ts':
        '// Only the admin role passes this check.\nexport function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
});
`,
    },
    findings: [],
  },
  {
    name: 'nob202-neg-no-paired-test-exists',
    note: 'With no confident pairing the rule stays silent rather than guessing',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
    },
    after: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin" || u.role === "staff";\n}\n',
    },
    findings: [],
  },
];

// --- NOB-203 security bypass --------------------------------------------------
// Each of these also changes a security-path file, which is NOB-202's trigger. The paired
// test is updated on the `after` side so these fixtures isolate NOB-203.
const nob203 = [
  {
    name: 'nob203-pos-return-true-at-top',
    note: 'return true added as the first statement of an authorization function',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('a', () => { expect(canAdmin(x)).toBe(true); });\n`,
    },
    after: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return true;\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('a', () => { expect(canAdmin(x)).toBe(true); });
it('b', () => { expect(canAdmin(y)).toBe(false); });
`,
    },
    findings: [{ ruleId: 'NOB-203', file: 'src/policies/admin.ts', messageContains: 'canAdmin' }],
  },
  {
    name: 'nob203-pos-return-next-in-middleware',
    note: 'return next() added at the top, short-circuiting the auth check below it',
    before: {
      'src/middleware/auth.ts':
        'export function requireUser(req, res, next) {\n  if (!req.user) {\n    return res.status(401).end();\n  }\n  next();\n}\n',
      'src/middleware/auth.test.ts': `it('a', () => { expect(requireUser(r)).toBe(1); });\n`,
    },
    after: {
      'src/middleware/auth.ts':
        'export function requireUser(req, res, next) {\n  return next();\n  if (!req.user) {\n    return res.status(401).end();\n  }\n  next();\n}\n',
      'src/middleware/auth.test.ts': `it('a', () => { expect(requireUser(r)).toBe(1); });
it('b', () => { expect(requireUser(r2)).toBe(0); });
`,
    },
    findings: [
      { ruleId: 'NOB-203', file: 'src/middleware/auth.ts', messageContains: 'requireUser' },
    ],
  },
  {
    name: 'nob203-pos-if-false-guard',
    note: 'A check disabled by wrapping it in if (false)',
    before: {
      'src/middleware/auth.ts':
        'export function verify(req) {\n  if (!req.token) {\n    throw new Error("no token");\n  }\n  return true;\n}\n',
      'src/middleware/auth.test.ts': `it('a', () => { expect(verify(r)).toBe(true); });\n`,
    },
    after: {
      'src/middleware/auth.ts':
        'export function verify(req) {\n  if (false) {\n    throw new Error("no token");\n  }\n  return true;\n}\n',
      'src/middleware/auth.test.ts': `it('a', () => { expect(verify(r)).toBe(true); });
it('b', () => { expect(verify(r2)).toBe(false); });
`,
    },
    findings: [
      { ruleId: 'NOB-203', file: 'src/middleware/auth.ts', messageContains: 'if (false)' },
    ],
  },
  {
    name: 'nob203-neg-return-true-at-end',
    note: 'return true as the LAST statement is how you write a predicate, not a bypass',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  if (!u) return false;\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('a', () => { expect(canAdmin(x)).toBe(true); });\n`,
    },
    after: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  if (!u) return false;\n  if (u.role !== "admin") return false;\n  return true;\n}\n',
      'src/policies/admin.test.ts': `it('a', () => { expect(canAdmin(x)).toBe(true); });
it('b', () => { expect(canAdmin(y)).toBe(false); });
`,
    },
    findings: [],
  },
  {
    name: 'nob203-neg-guard-clause-added',
    note: 'A guard clause that REJECTS early is the opposite of a bypass',
    before: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('a', () => { expect(canAdmin(x)).toBe(true); });\n`,
    },
    after: {
      'src/policies/admin.ts':
        'export function canAdmin(u: User) {\n  if (!u) return false;\n  return u.role === "admin";\n}\n',
      'src/policies/admin.test.ts': `it('a', () => { expect(canAdmin(x)).toBe(true); });
it('b', () => { expect(canAdmin(y)).toBe(false); });
`,
    },
    findings: [],
  },
  {
    name: 'nob203-neg-non-security-path',
    note: "The same early return outside a security path is not this rule's business",
    before: {
      'src/utils/format.ts': 'export function format(s: string) {\n  return s.trim();\n}\n',
    },
    after: {
      'src/utils/format.ts':
        'export function format(s: string) {\n  return s;\n  return s.trim();\n}\n',
    },
    findings: [],
  },
];

export default [...nob101, ...nob102, ...nob103, ...nob105, ...nob201, ...nob202, ...nob203];
