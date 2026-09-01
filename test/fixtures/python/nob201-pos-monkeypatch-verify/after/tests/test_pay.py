def test_charges(monkeypatch):
    monkeypatch.setattr(auth, "verify", lambda *a: True)
    assert charge() == 1000
