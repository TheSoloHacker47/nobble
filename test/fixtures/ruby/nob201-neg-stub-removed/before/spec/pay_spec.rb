it "charges" do
  allow(controller).to receive(:current_user).and_return(admin)
  expect(charge).to eq(1000)
end
