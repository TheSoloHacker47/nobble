it('handles skip links', () => {
  expect(nav()).toBe(1);
  expect(nav().skip).toBe(false);
});
