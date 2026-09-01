describe('refunds', () => {
  it('refunds in full', () => { expect(refund()).toBe(500); });
});
describe('charges', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
});
