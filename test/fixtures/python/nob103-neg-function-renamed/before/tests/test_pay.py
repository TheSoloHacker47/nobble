def test_charges_the_card():
    assert charge() == 1000
    assert fee() == 30
