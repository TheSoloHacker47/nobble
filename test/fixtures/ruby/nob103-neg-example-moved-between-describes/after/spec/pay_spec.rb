describe "charging" do
  it "charges" do
    expect(charge).to eq(1000)
  end
end
describe "refunding" do
  it "refunds" do
    expect(refund).to eq(500)
  end
end
