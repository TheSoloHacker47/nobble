jest.mock('../auth/current_user');
it('charges', () => {
  expect(charge()).toBe(1000);
});
