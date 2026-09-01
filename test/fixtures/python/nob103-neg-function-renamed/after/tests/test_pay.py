def test_charges_the_card_correctly():
    assert charge() == 1000
    assert fee() == 30
