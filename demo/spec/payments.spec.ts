describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).toBeTruthy();
  });
});
