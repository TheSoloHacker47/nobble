it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
});
