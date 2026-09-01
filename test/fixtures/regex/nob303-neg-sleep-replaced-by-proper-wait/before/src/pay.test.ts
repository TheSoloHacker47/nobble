it('settles', async () => {
  await new Promise(r => setTimeout(r, 500));
  expect(done()).toBe(true);
});
