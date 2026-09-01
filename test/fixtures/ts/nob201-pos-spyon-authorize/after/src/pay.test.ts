it('charges', () => {
  jest.spyOn(policy, 'authorize').mockReturnValue(true);
  expect(charge()).toBe(1000);
});
