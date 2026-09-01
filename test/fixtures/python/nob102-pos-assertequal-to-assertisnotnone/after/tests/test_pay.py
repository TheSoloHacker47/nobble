class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertIsNotNone(receipt())
