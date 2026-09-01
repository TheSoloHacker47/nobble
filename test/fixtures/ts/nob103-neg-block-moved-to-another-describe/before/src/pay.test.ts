describe('all', () => {
  it('charges', () => { expect(charge()).toBe(1000); });
  it('refunds', () => { expect(refund()).toBe(500); });
});
