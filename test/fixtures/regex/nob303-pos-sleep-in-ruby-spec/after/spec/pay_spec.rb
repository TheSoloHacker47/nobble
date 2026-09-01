it "settles" do
  settle
  sleep 1
  expect(done).to eq(true)
end
