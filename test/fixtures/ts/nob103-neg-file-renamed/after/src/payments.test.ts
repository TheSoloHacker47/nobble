it('charges the card', () => {
  expect(charge()).toBe(1000);
  expect(fee()).toBe(30);
});
