it "charges" do
  store = instance_double("SessionStore")
  expect(charge).to eq(1000)
end
