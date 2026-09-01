def test_a():
    assert verify_token(t) is None

def test_b():
    assert verify_token(bad) is None
