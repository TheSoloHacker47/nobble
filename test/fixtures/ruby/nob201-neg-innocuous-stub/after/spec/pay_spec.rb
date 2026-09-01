it "charges" do
  allow(formatter).to receive(:format_date).and_return("2026-01-01")
  expect(charge).to eq(1000)
end
