/**
 * Python fixtures for the AST rules (M4).
 *
 * Same seven rules, same scenarios as the TypeScript and Ruby sets. Covers both pytest
 * (bare `assert`, module-level `def test_*`) and unittest (`class Test*`, `self.assert*`).
 */

const nob101 = [
  {
    name: 'nob101-pos-pytest-assertions-dropped',
    note: 'Three of four asserts deleted from a pytest function',
    before: {
      'tests/test_pay.py': `def test_charges_the_card():
    assert charge() == 1000
    assert fee() == 30
    assert currency() == "usd"
    assert receipt() == {"id": 1}
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges_the_card():
    assert charge() == 1000
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'tests/test_pay.py', messageContains: '3 assertions removed' },
    ],
  },
  {
    name: 'nob101-pos-unittest-assertions-dropped',
    note: 'unittest assertions removed from a TestCase method',
    before: {
      'tests/test_pay.py': `class TestPayments(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
        self.assertEqual(fee(), 30)
        self.assertIsNotNone(receipt())
`,
    },
    after: {
      'tests/test_pay.py': `class TestPayments(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
`,
    },
    findings: [{ ruleId: 'NOB-101', file: 'tests/test_pay.py' }],
  },
  {
    name: 'nob101-pos-two-functions-lose-assertions',
    note: 'Two test functions each lose an assert',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert a() == 1
    assert b() == 2

def test_refunds():
    assert c() == 3
    assert d() == 4
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert a() == 1

def test_refunds():
    assert c() == 3
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'tests/test_pay.py', messageContains: 'test_charges' },
      { ruleId: 'NOB-101', file: 'tests/test_pay.py', messageContains: 'test_refunds' },
    ],
  },
  {
    name: 'nob101-neg-test-split-in-two',
    note: 'MANDATORY NEGATIVE: a test split in two, assert count unchanged',
    before: {
      'tests/test_pay.py': `def test_charges_and_refunds():
    assert charge() == 1000
    assert fee() == 30
    assert refund() == 500
    assert balance() == 0
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
    assert fee() == 30

def test_refunds():
    assert refund() == 500
    assert balance() == 0
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-unittest-to-pytest-port',
    note: 'MANDATORY NEGATIVE: a suite ported from unittest to pytest with every assertion intact',
    before: {
      'tests/test_pay.py': `class TestPayments(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
        self.assertEqual(fee(), 30)
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
    assert fee() == 30
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-assertions-added',
    note: 'Adding assertions is the good direction',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
    assert fee() == 30
`,
    },
    findings: [],
  },
];

const nob102 = [
  {
    name: 'nob102-pos-assertequal-to-asserttrue',
    note: 'assertEqual downgraded to assertTrue',
    before: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
`,
    },
    after: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertTrue(charge())
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'tests/test_pay.py', messageContains: 'assertEqual' }],
  },
  {
    name: 'nob102-pos-assertequal-to-assertisnotnone',
    note: 'assertEqual downgraded to an existence check',
    before: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(receipt(), {"id": 1})
`,
    },
    after: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertIsNotNone(receipt())
`,
    },
    findings: [
      { ruleId: 'NOB-102', file: 'tests/test_pay.py', messageContains: 'assertIsNotNone' },
    ],
  },
  {
    name: 'nob102-pos-bare-assert-comparison-dropped',
    note: 'A comparing assert downgraded to a bare truthiness check',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge()
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'tests/test_pay.py' }],
  },
  {
    name: 'nob102-neg-strengthened',
    note: 'assertTrue upgraded to assertEqual is the good direction',
    before: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertTrue(charge())
`,
    },
    after: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
`,
    },
    findings: [],
  },
  {
    name: 'nob102-neg-lateral-matcher-change',
    note: 'assertEqual to assertDictEqual is a lateral move',
    before: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(receipt(), expected)
`,
    },
    after: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertDictEqual(receipt(), expected)
`,
    },
    findings: [],
  },
  {
    name: 'nob102-neg-expected-value-changed',
    note: 'Changing the expected value is a normal test update',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1200
`,
    },
    findings: [],
  },
];

const nob103 = [
  {
    name: 'nob103-pos-function-deleted',
    note: 'A whole test function removed',
    before: {
      'tests/test_pay.py': `def test_charges_the_card():
    assert charge() == 1000

def test_rejects_an_expired_card():
    with pytest.raises(CardError):
        charge(expired)
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges_the_card():
    assert charge() == 1000
`,
    },
    findings: [
      {
        ruleId: 'NOB-103',
        file: 'tests/test_pay.py',
        messageContains: 'test_rejects_an_expired_card',
      },
    ],
  },
  {
    name: 'nob103-pos-two-functions-deleted',
    note: 'Two test functions removed gives two findings',
    before: {
      'tests/test_pay.py': `def test_alpha_one():
    assert a() == 1

def test_beta_two():
    assert b() == 2

def test_gamma_three():
    assert c() == 3
`,
    },
    after: {
      'tests/test_pay.py': `def test_alpha_one():
    assert a() == 1
`,
    },
    findings: [
      { ruleId: 'NOB-103', file: 'tests/test_pay.py', messageContains: 'test_beta_two' },
      { ruleId: 'NOB-103', file: 'tests/test_pay.py', messageContains: 'test_gamma_three' },
    ],
  },
  {
    name: 'nob103-pos-testcase-class-deleted',
    note: 'An entire TestCase class removed',
    before: {
      'tests/test_pay.py': `class TestRefunds(unittest.TestCase):
    def test_refunds_in_full(self):
        self.assertEqual(refund(), 500)

class TestCharges(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
`,
    },
    after: {
      'tests/test_pay.py': `class TestCharges(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
`,
    },
    findings: [
      { ruleId: 'NOB-103', file: 'tests/test_pay.py', messageContains: 'test_refunds_in_full' },
    ],
  },
  {
    name: 'nob103-neg-function-renamed',
    note: 'MANDATORY NEGATIVE: a test renamed with all assertions intact',
    before: {
      'tests/test_pay.py': `def test_charges_the_card():
    assert charge() == 1000
    assert fee() == 30
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges_the_card_correctly():
    assert charge() == 1000
    assert fee() == 30
`,
    },
    findings: [],
  },
  {
    name: 'nob103-neg-file-renamed',
    note: 'MANDATORY NEGATIVE: a test file renamed with all assertions intact',
    before: {
      'tests/test_pay.py': `def test_charges_the_card():
    assert charge() == 1000
    assert fee() == 30
`,
    },
    after: {
      'tests/test_payments.py': `def test_charges_the_card():
    assert charge() == 1000
    assert fee() == 30
`,
    },
    findings: [],
  },
  {
    name: 'nob103-neg-function-moved-out-of-class',
    note: 'Moving a test from a TestCase to module level keeps every assertion',
    before: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        assert charge() == 1000

    def test_refunds(self):
        assert refund() == 500
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000

def test_refunds():
    assert refund() == 500
`,
    },
    findings: [],
  },
];

const nob105 = [
  {
    name: 'nob105-pos-assertequal-to-assertnotequal',
    note: 'assertEqual inverted to assertNotEqual',
    before: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
`,
    },
    after: {
      'tests/test_pay.py': `class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertNotEqual(charge(), 1000)
`,
    },
    findings: [{ ruleId: 'NOB-105', file: 'tests/test_pay.py' }],
  },
  {
    name: 'nob105-pos-bare-assert-inverted',
    note: 'A bare assert flipped from == to !=',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() != 1000
`,
    },
    findings: [{ ruleId: 'NOB-105', file: 'tests/test_pay.py', messageContains: 'inverted' }],
  },
  {
    name: 'nob105-pos-two-inverted',
    note: 'Two asserts inverted in one test',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert a() == 1
    assert b() == 2
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert a() != 1
    assert b() != 2
`,
    },
    findings: [
      { ruleId: 'NOB-105', file: 'tests/test_pay.py' },
      { ruleId: 'NOB-105', file: 'tests/test_pay.py' },
    ],
  },
  {
    name: 'nob105-neg-inversion-removed',
    note: 'Removing an inversion is the good direction',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() != 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    findings: [],
  },
  {
    name: 'nob105-neg-already-negated',
    note: 'An assert that was always negated is not an inversion',
    before: {
      'tests/test_pay.py': `def test_rejects():
    assert charge(bad) != 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_rejects():
    assert charge(bad) != 2000
`,
    },
    findings: [],
  },
  {
    name: 'nob105-neg-new-negated-assert-added',
    note: 'Adding a negated assert alongside the old one is extra coverage',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
    assert charge() != 0
`,
    },
    findings: [],
  },
];

const nob201 = [
  {
    name: 'nob201-pos-patch-current-user',
    note: 'mock.patch introduced around current_user',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    mock.patch("app.auth.current_user")
    assert charge() == 1000
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'tests/test_pay.py', messageContains: 'current_user' }],
  },
  {
    name: 'nob201-pos-monkeypatch-verify',
    note: 'monkeypatch.setattr used to stub a signature check',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges(monkeypatch):
    monkeypatch.setattr(auth, "verify", lambda *a: True)
    assert charge() == 1000
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'tests/test_pay.py', messageContains: 'verify' }],
  },
  {
    name: 'nob201-pos-patch-decorator-session',
    note: 'The @patch decorator form around the session module',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `@patch("app.session.token")
def test_charges(_token):
    assert charge() == 1000
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'tests/test_pay.py', messageContains: 'session' }],
  },
  {
    name: 'nob201-neg-patch-innocuous-module',
    note: 'Patching a date formatter has nothing to do with security',
    before: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    mock.patch("app.utils.date_formatter")
    assert charge() == 1000
`,
    },
    findings: [],
  },
  {
    name: 'nob201-neg-patch-already-present',
    note: 'A patch that existed before this change is not this PR introducing it',
    before: {
      'tests/test_pay.py': `def test_charges():
    mock.patch("app.auth.current_user")
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    mock.patch("app.auth.current_user")
    assert charge() == 1000
    assert fee() == 30
`,
    },
    findings: [],
  },
  {
    name: 'nob201-neg-patch-removed',
    note: 'Removing a sensitive patch is the good direction',
    before: {
      'tests/test_pay.py': `def test_charges():
    mock.patch("app.auth.current_user")
    assert charge() == 1000
`,
    },
    after: {
      'tests/test_pay.py': `def test_charges():
    assert charge() == 1000
`,
    },
    findings: [],
  },
];

const nob203 = [
  {
    name: 'nob203-pos-return-true-at-top',
    note: 'return True added as the first statement of an authorization function',
    before: {
      'app/permissions/check.py': `def can_admin(user):
    return user.role == "admin"
`,
      'tests/test_check.py': `def test_a():\n    assert can_admin(u) is True\n`,
    },
    after: {
      'app/permissions/check.py': `def can_admin(user):
    return True
    return user.role == "admin"
`,
      'tests/test_check.py': `def test_a():
    assert can_admin(u) is True

def test_b():
    assert can_admin(g) is False
`,
    },
    findings: [
      { ruleId: 'NOB-203', file: 'app/permissions/check.py', messageContains: 'can_admin' },
    ],
  },
  {
    name: 'nob203-pos-pass-at-top',
    note: 'A bare pass short-circuits a verification function',
    before: {
      'app/security/verify.py': `def verify_token(token):
    if not token.valid:
        raise Unauthorized()
`,
      'tests/test_verify.py': `def test_a():\n    assert verify_token(t) is None\n`,
    },
    after: {
      'app/security/verify.py': `def verify_token(token):
    pass
    if not token.valid:
        raise Unauthorized()
`,
      'tests/test_verify.py': `def test_a():
    assert verify_token(t) is None

def test_b():
    assert verify_token(bad) is None
`,
    },
    findings: [{ ruleId: 'NOB-203', file: 'app/security/verify.py' }],
  },
  {
    name: 'nob203-pos-if-false-guard',
    note: 'A permission check disabled by wrapping it in if False',
    before: {
      'app/permissions/check.py': `def run(user):
    if user.blocked:
        raise Forbidden()
    return True
`,
      'tests/test_check.py': `def test_a():\n    assert run(u) is True\n`,
    },
    after: {
      'app/permissions/check.py': `def run(user):
    if False:
        raise Forbidden()
    return True
`,
      'tests/test_check.py': `def test_a():
    assert run(u) is True

def test_b():
    assert run(b) is False
`,
    },
    findings: [
      { ruleId: 'NOB-203', file: 'app/permissions/check.py', messageContains: 'if False' },
    ],
  },
  {
    name: 'nob203-neg-return-true-at-end',
    note: 'return True as the LAST statement is how you write a predicate',
    before: {
      'app/permissions/check.py': `def can_admin(user):
    return user.role == "admin"
`,
      'tests/test_check.py': `def test_a():\n    assert can_admin(u) is True\n`,
    },
    after: {
      'app/permissions/check.py': `def can_admin(user):
    if user is None:
        return False
    if user.role != "admin":
        return False
    return True
`,
      'tests/test_check.py': `def test_a():
    assert can_admin(u) is True

def test_b():
    assert can_admin(None) is False
`,
    },
    findings: [],
  },
  {
    name: 'nob203-neg-guard-clause-added',
    note: 'A guard clause that REJECTS early is the opposite of a bypass',
    before: {
      'app/permissions/check.py': `def can_admin(user):
    return user.role == "admin"
`,
      'tests/test_check.py': `def test_a():\n    assert can_admin(u) is True\n`,
    },
    after: {
      'app/permissions/check.py': `def can_admin(user):
    if user is None:
        return False
    return user.role == "admin"
`,
      'tests/test_check.py': `def test_a():
    assert can_admin(u) is True

def test_b():
    assert can_admin(None) is False
`,
    },
    findings: [],
  },
  {
    name: 'nob203-neg-non-security-path',
    note: 'The same early return outside a security path is not this rule’s business',
    before: {
      'app/formatters/money.py': `def format_money(n):
    return round(n, 2)
`,
    },
    after: {
      'app/formatters/money.py': `def format_money(n):
    return n
    return round(n, 2)
`,
    },
    findings: [],
  },
];

export default [...nob101, ...nob102, ...nob103, ...nob105, ...nob201, ...nob203];
