def test_charges():
    assert charge() == 1000
    assert fee() == 30

def test_refunds():
    assert refund() == 500
    assert balance() == 0
