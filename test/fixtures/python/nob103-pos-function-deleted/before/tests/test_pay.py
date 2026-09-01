def test_charges_the_card():
    assert charge() == 1000

def test_rejects_an_expired_card():
    with pytest.raises(CardError):
        charge(expired)
