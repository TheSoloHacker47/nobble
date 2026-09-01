describe('PaymentAuthorizer', () => {
  it('charges the card', () => {
    expect(charge()).toBe(1000);
    expect(fee()).toBe(30);
    expect(receipt()).toEqual({ id: 1, total: 1030 });
  });

  it('rejects an expired card', () => {
    expect(() => charge(expired)).toThrow(CardError);
  });
});
