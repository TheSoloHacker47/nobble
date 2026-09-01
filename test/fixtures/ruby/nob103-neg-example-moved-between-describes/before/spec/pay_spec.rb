describe "all" do
  it "charges" do
    expect(charge).to eq(1000)
  end
  it "refunds" do
    expect(refund).to eq(500)
  end
end
