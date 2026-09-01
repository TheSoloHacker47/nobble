class TestPayments(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
