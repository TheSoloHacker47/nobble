def test_charges():
    mock.patch("app.auth.current_user")
    assert charge() == 1000
