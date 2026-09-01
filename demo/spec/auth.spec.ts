describe('requireUser', () => {
  it('rejects an anonymous request', () => {
    expect(requireUser({})).toBe(false);
  });
});
