jest.mock('../src/middleware/current_user');

describe('requireUser', () => {
  it.skip('rejects an anonymous request', () => {
    expect(requireUser({})).toBe(false);
  });
});
