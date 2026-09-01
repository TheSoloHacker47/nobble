it('allows admins', () => {
  expect(canAdmin(admin)).toBe(true);
  expect(canAdmin(staff)).toBe(true);
});
