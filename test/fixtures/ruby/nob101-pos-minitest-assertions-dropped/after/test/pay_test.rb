class PayTest < Minitest::Test
  def test_charges
    assert_equal 1000, charge
  end
end
