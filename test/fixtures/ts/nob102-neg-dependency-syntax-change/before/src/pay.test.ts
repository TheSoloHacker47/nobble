it('charges', () => {
  expect(charge()).to.equal(1000);
  expect(fee()).to.equal(30);
});
