it('charges', () => {
  expect(charge()).toEqual(1000);
  expect(fee()).toEqual(30);
});
