it('charges and refunds', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
  expect(refund()).toBe(500);
  expect(balance()).toBe(0);
});
