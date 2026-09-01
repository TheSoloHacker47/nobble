it "charges" do
  allow(policy).to receive(:authorize).and_return(true)
  expect(charge).to eq(1000)
end
