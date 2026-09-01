it('charges', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
it('refunds', () => {
  expect(refund()).toBe(500);
  expect(balance()).toBe(0);
});
