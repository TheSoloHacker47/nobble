it "charges" do
  expect(charge).to eq(1000)
  expect(charge).not_to eq(0)
end
