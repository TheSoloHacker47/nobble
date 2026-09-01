it "charges the card correctly" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
