it('settles', async () => {
  await settle();
  expect(done()).toBe(true);
});
