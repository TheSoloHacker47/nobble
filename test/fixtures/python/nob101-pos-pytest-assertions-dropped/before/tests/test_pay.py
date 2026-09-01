def test_charges_the_card():
    assert charge() == 1000
    assert fee() == 30
    assert currency() == "usd"
    assert receipt() == {"id": 1}
