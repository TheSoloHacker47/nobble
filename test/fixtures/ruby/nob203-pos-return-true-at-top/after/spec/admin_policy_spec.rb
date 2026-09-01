it "a" do
  expect(policy.allow?(u)).to eq(true)
end
it "b" do
  expect(policy.allow?(g)).to eq(false)
end
