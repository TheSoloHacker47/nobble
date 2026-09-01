it('requires a user', () => {
  expect(requireUser({})).toBe(false);
});
