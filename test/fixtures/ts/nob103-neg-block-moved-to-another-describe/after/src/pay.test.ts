describe('charging', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
});
describe('refunding', () => {
  it('refunds', () => { expect(refund()).toBe(500); });
});
