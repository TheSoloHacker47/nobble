it "charges the card" do
  expect(charge).to eq(1000)
end
it "rejects an expired card" do
  expect { charge(expired) }.to raise_error(CardError)
end
