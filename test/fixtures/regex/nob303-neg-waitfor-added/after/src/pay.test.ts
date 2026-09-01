it('settles', async () => {
  await waitUntil(() => done());
  expect(done()).toBe(true);
});
