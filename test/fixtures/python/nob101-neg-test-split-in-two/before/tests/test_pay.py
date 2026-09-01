def test_charges_and_refunds():
    assert charge() == 1000
    assert fee() == 30
    assert refund() == 500
    assert balance() == 0
