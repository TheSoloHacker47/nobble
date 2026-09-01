describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).to.equal(1000);
    expect(fee()).to.equal(30);
    expect(currency()).to.equal('usd');
  });
});
