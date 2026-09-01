def test_a():
    assert can_admin(u) is True

def test_b():
    assert can_admin(None) is False
