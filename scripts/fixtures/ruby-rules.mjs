/**
 * Ruby fixtures for the AST rules (M4).
 *
 * Deliberately the same seven rules and the same seven scenarios as the TypeScript set.
 * If a rule needed Ruby-specific handling to pass these, the abstraction would be wrong --
 * that is what this milestone is testing, not just that Ruby parses.
 */

const nob101 = [
  {
    name: 'nob101-pos-rspec-assertions-dropped',
    note: 'Three of four assertions deleted from an RSpec example',
    before: {
      'spec/pay_spec.rb': `describe "PaymentAuthorizer" do
  it "charges the card" do
    expect(charge).to eq(1000)
    expect(fee).to eq(30)
    expect(currency).to eq("usd")
    expect(receipt).to eq({ id: 1 })
  end
end
`,
    },
    after: {
      'spec/pay_spec.rb': `describe "PaymentAuthorizer" do
  it "charges the card" do
    expect(charge).to eq(1000)
  end
end
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'spec/pay_spec.rb', messageContains: '3 assertions removed' },
    ],
  },
  {
    name: 'nob101-pos-minitest-assertions-dropped',
    note: 'Minitest assertions removed from a test method',
    before: {
      'test/pay_test.rb': `class PayTest < Minitest::Test
  def test_charges
    assert_equal 1000, charge
    assert_equal 30, fee
    refute_nil receipt
  end
end
`,
    },
    after: {
      'test/pay_test.rb': `class PayTest < Minitest::Test
  def test_charges
    assert_equal 1000, charge
  end
end
`,
    },
    findings: [{ ruleId: 'NOB-101', file: 'test/pay_test.rb' }],
  },
  {
    name: 'nob101-pos-two-examples-lose-assertions',
    note: 'Two examples each lose an assertion',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(a).to eq(1)
  expect(b).to eq(2)
end
it "refunds" do
  expect(c).to eq(3)
  expect(d).to eq(4)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(a).to eq(1)
end
it "refunds" do
  expect(c).to eq(3)
end
`,
    },
    findings: [
      { ruleId: 'NOB-101', file: 'spec/pay_spec.rb', messageContains: 'charges' },
      { ruleId: 'NOB-101', file: 'spec/pay_spec.rb', messageContains: 'refunds' },
    ],
  },
  {
    name: 'nob101-neg-example-split-in-two',
    note: 'MANDATORY NEGATIVE: an example split in two, assertion count unchanged',
    before: {
      'spec/pay_spec.rb': `it "charges and refunds" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
  expect(refund).to eq(500)
  expect(balance).to eq(0)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
it "refunds" do
  expect(refund).to eq(500)
  expect(balance).to eq(0)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-minitest-to-rspec-port',
    note: 'MANDATORY NEGATIVE: a suite ported from Minitest to RSpec with every assertion intact',
    before: {
      'spec/pay_spec.rb': `def test_charges
  assert_equal 1000, charge
  assert_equal 30, fee
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "test charges" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob101-neg-assertions-added',
    note: 'Adding assertions is the good direction',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    findings: [],
  },
];

const nob102 = [
  {
    name: 'nob102-pos-eq-to-be-truthy',
    note: 'eq downgraded to be_truthy',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to be_truthy
end
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'spec/pay_spec.rb', messageContains: 'eq' }],
  },
  {
    name: 'nob102-pos-eq-to-be-a',
    note: 'Exact comparison downgraded to a type check',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to be_a(Integer)
end
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'spec/pay_spec.rb', messageContains: 'be_a' }],
  },
  {
    name: 'nob102-pos-minitest-equal-to-assert',
    note: 'assert_equal downgraded to a bare assert',
    before: {
      'test/pay_test.rb': `def test_charges
  assert_equal 1000, charge
end
`,
    },
    after: {
      'test/pay_test.rb': `def test_charges
  assert charge
end
`,
    },
    findings: [{ ruleId: 'NOB-102', file: 'test/pay_test.rb' }],
  },
  {
    name: 'nob102-neg-strengthened',
    note: 'be_truthy upgraded to eq is the good direction',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to be_truthy
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob102-neg-lateral-matcher-change',
    note: 'eq to eql is a lateral move, not a weakening',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eql(1000)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob102-neg-argument-changed-only',
    note: 'Changing the expected value is a normal test update',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1200)
end
`,
    },
    findings: [],
  },
];

const nob103 = [
  {
    name: 'nob103-pos-example-deleted',
    note: 'A whole RSpec example removed',
    before: {
      'spec/pay_spec.rb': `it "charges the card" do
  expect(charge).to eq(1000)
end
it "rejects an expired card" do
  expect { charge(expired) }.to raise_error(CardError)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges the card" do
  expect(charge).to eq(1000)
end
`,
    },
    findings: [
      { ruleId: 'NOB-103', file: 'spec/pay_spec.rb', messageContains: 'rejects an expired card' },
    ],
  },
  {
    name: 'nob103-pos-two-examples-deleted',
    note: 'Two examples removed gives two findings',
    before: {
      'spec/pay_spec.rb': `it "alpha one" do
  expect(a).to eq(1)
end
it "beta two" do
  expect(b).to eq(2)
end
it "gamma three" do
  expect(c).to eq(3)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "alpha one" do
  expect(a).to eq(1)
end
`,
    },
    findings: [
      { ruleId: 'NOB-103', file: 'spec/pay_spec.rb', messageContains: 'beta two' },
      { ruleId: 'NOB-103', file: 'spec/pay_spec.rb', messageContains: 'gamma three' },
    ],
  },
  {
    name: 'nob103-pos-describe-deleted',
    note: 'An entire describe block removed',
    before: {
      'spec/pay_spec.rb': `describe "refunds" do
  it "refunds in full" do
    expect(refund).to eq(500)
  end
end
describe "charges" do
  it "charges" do
    expect(charge).to eq(1000)
  end
end
`,
    },
    after: {
      'spec/pay_spec.rb': `describe "charges" do
  it "charges" do
    expect(charge).to eq(1000)
  end
end
`,
    },
    findings: [{ ruleId: 'NOB-103', file: 'spec/pay_spec.rb', messageContains: 'refunds in full' }],
  },
  {
    name: 'nob103-neg-example-renamed',
    note: 'MANDATORY NEGATIVE: an example renamed with all assertions intact',
    before: {
      'spec/pay_spec.rb': `it "charges the card" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges the card correctly" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob103-neg-file-renamed',
    note: 'MANDATORY NEGATIVE: a spec file renamed with all assertions intact',
    before: {
      'spec/pay_spec.rb': `it "charges the card" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    after: {
      'spec/payments_spec.rb': `it "charges the card" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob103-neg-example-moved-between-describes',
    note: 'Reorganising examples between describes keeps every assertion',
    before: {
      'spec/pay_spec.rb': `describe "all" do
  it "charges" do
    expect(charge).to eq(1000)
  end
  it "refunds" do
    expect(refund).to eq(500)
  end
end
`,
    },
    after: {
      'spec/pay_spec.rb': `describe "charging" do
  it "charges" do
    expect(charge).to eq(1000)
  end
end
describe "refunding" do
  it "refunds" do
    expect(refund).to eq(500)
  end
end
`,
    },
    findings: [],
  },
];

const nob105 = [
  {
    name: 'nob105-pos-to-becomes-not-to',
    note: 'RSpec `to` inverted to `not_to`',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).not_to eq(1000)
end
`,
    },
    findings: [{ ruleId: 'NOB-105', file: 'spec/pay_spec.rb', messageContains: 'inverted' }],
  },
  {
    name: 'nob105-pos-to-not-variant',
    note: 'The `to_not` spelling counts as the same inversion',
    before: {
      'spec/pay_spec.rb': `it "builds a receipt" do
  expect(receipt).to eq({ id: 1 })
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "builds a receipt" do
  expect(receipt).to_not eq({ id: 1 })
end
`,
    },
    findings: [{ ruleId: 'NOB-105', file: 'spec/pay_spec.rb' }],
  },
  {
    name: 'nob105-pos-two-inverted',
    note: 'Two expectations inverted in one example',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(a).to eq(1)
  expect(b).to eq(2)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(a).not_to eq(1)
  expect(b).not_to eq(2)
end
`,
    },
    findings: [
      { ruleId: 'NOB-105', file: 'spec/pay_spec.rb' },
      { ruleId: 'NOB-105', file: 'spec/pay_spec.rb' },
    ],
  },
  {
    name: 'nob105-neg-negation-removed',
    note: 'Removing a negation is the good direction',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).not_to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob105-neg-already-negated',
    note: 'An expectation that was always negated is not an inversion',
    before: {
      'spec/pay_spec.rb': `it "rejects" do
  expect(charge_bad).not_to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "rejects" do
  expect(charge_bad).not_to eq(2000)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob105-neg-new-negated-assertion',
    note: 'Adding a negated expectation alongside the old one is extra coverage',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
  expect(charge).not_to eq(0)
end
`,
    },
    findings: [],
  },
];

const nob201 = [
  {
    name: 'nob201-pos-stub-current-user',
    note: 'allow(...).to receive(:current_user) introduced',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  allow(controller).to receive(:current_user).and_return(admin)
  expect(charge).to eq(1000)
end
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'spec/pay_spec.rb', messageContains: 'current_user' }],
  },
  {
    name: 'nob201-pos-stub-authorize',
    note: 'An authorization check stubbed out',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  allow(policy).to receive(:authorize).and_return(true)
  expect(charge).to eq(1000)
end
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'spec/pay_spec.rb', messageContains: 'authorize' }],
  },
  {
    name: 'nob201-pos-instance-double-session',
    note: 'An instance_double standing in for the session store',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  store = instance_double("SessionStore")
  expect(charge).to eq(1000)
end
`,
    },
    findings: [{ ruleId: 'NOB-201', file: 'spec/pay_spec.rb', messageContains: 'session' }],
  },
  {
    name: 'nob201-neg-innocuous-stub',
    note: 'Stubbing a date formatter has nothing to do with security',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  allow(formatter).to receive(:format_date).and_return("2026-01-01")
  expect(charge).to eq(1000)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob201-neg-stub-already-present',
    note: 'A stub that existed before this change is not this PR introducing it',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  allow(controller).to receive(:current_user).and_return(admin)
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  allow(controller).to receive(:current_user).and_return(admin)
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob201-neg-stub-removed',
    note: 'Removing a sensitive stub is the good direction',
    before: {
      'spec/pay_spec.rb': `it "charges" do
  allow(controller).to receive(:current_user).and_return(admin)
  expect(charge).to eq(1000)
end
`,
    },
    after: {
      'spec/pay_spec.rb': `it "charges" do
  expect(charge).to eq(1000)
end
`,
    },
    findings: [],
  },
];

const nob203 = [
  {
    name: 'nob203-pos-return-true-at-top',
    note: 'return true added as the first statement of a policy method',
    before: {
      'app/policies/admin_policy.rb': `class AdminPolicy
  def allow?(user)
    user.role == "admin"
  end
end
`,
      'spec/admin_policy_spec.rb': `it "a" do\n  expect(policy.allow?(u)).to eq(true)\nend\n`,
    },
    after: {
      'app/policies/admin_policy.rb': `class AdminPolicy
  def allow?(user)
    return true
    user.role == "admin"
  end
end
`,
      'spec/admin_policy_spec.rb': `it "a" do
  expect(policy.allow?(u)).to eq(true)
end
it "b" do
  expect(policy.allow?(g)).to eq(false)
end
`,
    },
    findings: [
      { ruleId: 'NOB-203', file: 'app/policies/admin_policy.rb', messageContains: 'allow?' },
    ],
  },
  {
    name: 'nob203-pos-head-ok-at-top',
    note: 'head :ok short-circuits a controller authorization filter',
    before: {
      'app/middleware/auth_filter.rb': `class AuthFilter
  def verify
    raise Unauthorized unless token_valid?
  end
end
`,
      'spec/auth_filter_spec.rb': `it "a" do\n  expect(filter.verify).to eq(true)\nend\n`,
    },
    after: {
      'app/middleware/auth_filter.rb': `class AuthFilter
  def verify
    head :ok
    raise Unauthorized unless token_valid?
  end
end
`,
      'spec/auth_filter_spec.rb': `it "a" do
  expect(filter.verify).to eq(true)
end
it "b" do
  expect(filter.verify).to eq(false)
end
`,
    },
    findings: [{ ruleId: 'NOB-203', file: 'app/middleware/auth_filter.rb' }],
  },
  {
    name: 'nob203-pos-if-false-guard',
    note: 'A permission check disabled by wrapping it in if false',
    before: {
      'app/permissions/check.rb': `class Check
  def run(user)
    if user.blocked?
      raise Forbidden
    end
    true
  end
end
`,
      'spec/check_spec.rb': `it "a" do\n  expect(check.run(u)).to eq(true)\nend\n`,
    },
    after: {
      'app/permissions/check.rb': `class Check
  def run(user)
    if false
      raise Forbidden
    end
    true
  end
end
`,
      'spec/check_spec.rb': `it "a" do
  expect(check.run(u)).to eq(true)
end
it "b" do
  expect(check.run(b)).to eq(false)
end
`,
    },
    findings: [
      { ruleId: 'NOB-203', file: 'app/permissions/check.rb', messageContains: 'if false' },
    ],
  },
  {
    name: 'nob203-neg-guard-clause-added',
    note: 'A guard clause that REJECTS early is the opposite of a bypass',
    before: {
      'app/policies/admin_policy.rb': `class AdminPolicy
  def allow?(user)
    user.role == "admin"
  end
end
`,
      'spec/admin_policy_spec.rb': `it "a" do\n  expect(policy.allow?(u)).to eq(true)\nend\n`,
    },
    after: {
      'app/policies/admin_policy.rb': `class AdminPolicy
  def allow?(user)
    return false if user.nil?
    user.role == "admin"
  end
end
`,
      'spec/admin_policy_spec.rb': `it "a" do
  expect(policy.allow?(u)).to eq(true)
end
it "b" do
  expect(policy.allow?(nil)).to eq(false)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob203-neg-implicit-true-at-end',
    note: 'A method ending in true is a normal predicate, not a bypass',
    before: {
      'app/policies/admin_policy.rb': `class AdminPolicy
  def allow?(user)
    user.role == "admin"
  end
end
`,
      'spec/admin_policy_spec.rb': `it "a" do\n  expect(policy.allow?(u)).to eq(true)\nend\n`,
    },
    after: {
      'app/policies/admin_policy.rb': `class AdminPolicy
  def allow?(user)
    return false if user.nil?
    return false unless user.role == "admin"
    true
  end
end
`,
      'spec/admin_policy_spec.rb': `it "a" do
  expect(policy.allow?(u)).to eq(true)
end
it "b" do
  expect(policy.allow?(nil)).to eq(false)
end
`,
    },
    findings: [],
  },
  {
    name: 'nob203-neg-non-security-path',
    note: 'The same early return outside a security path is not this rule’s business',
    before: {
      'app/formatters/money.rb': `class Money
  def format(n)
    n.round(2)
  end
end
`,
    },
    after: {
      'app/formatters/money.rb': `class Money
  def format(n)
    return n
    n.round(2)
  end
end
`,
    },
    findings: [],
  },
];

export default [...nob101, ...nob102, ...nob103, ...nob105, ...nob201, ...nob203];
