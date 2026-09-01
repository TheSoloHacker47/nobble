describe "PaymentAuthorizer" do
  it "charges the card" do
    expect(charge).to eq(1000)
    expect(fee).to eq(30)
    expect(currency).to eq("usd")
    expect(receipt).to eq({ id: 1 })
  end
end
