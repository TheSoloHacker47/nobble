@patch("app.session.token")
def test_charges(_token):
    assert charge() == 1000
