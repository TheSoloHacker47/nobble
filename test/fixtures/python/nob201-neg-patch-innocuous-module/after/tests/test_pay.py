def test_charges():
    mock.patch("app.utils.date_formatter")
    assert charge() == 1000
