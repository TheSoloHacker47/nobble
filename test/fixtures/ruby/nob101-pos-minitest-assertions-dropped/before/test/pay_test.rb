class PayTest < Minitest::Test
  def test_charges
    assert_equal 1000, charge
    assert_equal 30, fee
    refute_nil receipt
  end
end
