class TestPay(unittest.TestCase):
    def test_charges(self):
        assert charge() == 1000

    def test_refunds(self):
        assert refund() == 500
