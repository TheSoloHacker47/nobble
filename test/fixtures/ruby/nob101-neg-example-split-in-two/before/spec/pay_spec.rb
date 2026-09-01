it "charges and refunds" do
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
  expect(refund).to eq(500)
  expect(balance).to eq(0)
end
