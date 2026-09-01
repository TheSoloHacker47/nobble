class TestPay(unittest.TestCase):
    def test_charges(self):
        self.assertNotEqual(charge(), 1000)
