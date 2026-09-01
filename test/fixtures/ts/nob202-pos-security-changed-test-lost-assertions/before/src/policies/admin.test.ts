it('checks roles', () => {
  expect(canAdmin(admin)).toBe(true);
  expect(canAdmin(guest)).toBe(false);
  expect(canAdmin(null)).toBe(false);
});
