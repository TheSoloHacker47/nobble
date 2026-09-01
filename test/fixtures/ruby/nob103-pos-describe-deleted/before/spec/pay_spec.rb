describe "refunds" do
  it "refunds in full" do
    expect(refund).to eq(500)
  end
end
describe "charges" do
  it "charges" do
    expect(charge).to eq(1000)
  end
end
