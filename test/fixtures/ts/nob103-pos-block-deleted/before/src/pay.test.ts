it('charges the card', () => {
  expect(charge()).toBe(1000);
});
it('rejects an expired card', () => {
  expect(() => charge(expired)).toThrow();
});
