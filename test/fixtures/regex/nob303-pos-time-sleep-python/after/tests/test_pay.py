def test_settles():
    settle()
    time.sleep(2)
    assert done()
