it('settles', async () => {
  await settle();
  await new Promise(r => setTimeout(r, 500));
  expect(done()).toBe(true);
});
