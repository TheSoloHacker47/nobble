describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).toBe(1000);
    expect(fee()).toBe(30);
    expect(currency()).toBe('usd');
    expect(receipt()).toEqual({ id: 1 });
  });
});
