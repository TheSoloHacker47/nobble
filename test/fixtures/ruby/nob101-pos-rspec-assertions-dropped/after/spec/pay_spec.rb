describe "PaymentAuthorizer" do
  it "charges the card" do
    expect(charge).to eq(1000)
  end
end
