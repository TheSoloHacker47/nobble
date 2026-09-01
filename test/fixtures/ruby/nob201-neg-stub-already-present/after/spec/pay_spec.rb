it "charges" do
  allow(controller).to receive(:current_user).and_return(admin)
  expect(charge).to eq(1000)
  expect(fee).to eq(30)
end
