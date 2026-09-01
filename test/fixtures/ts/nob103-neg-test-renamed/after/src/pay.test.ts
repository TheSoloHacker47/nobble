it('charges the card correctly', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
