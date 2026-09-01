it('refunds', () => {
  expect(refund()).toBe(500);
  expect(balance()).toBe(0);
});
