it('charges', () => {
  expect(charge()).toBe(1000);
  expect(charge()).not.toBe(0);
});
