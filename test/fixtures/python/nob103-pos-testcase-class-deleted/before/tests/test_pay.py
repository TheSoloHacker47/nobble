class TestRefunds(unittest.TestCase):
    def test_refunds_in_full(self):
        self.assertEqual(refund(), 500)

class TestCharges(unittest.TestCase):
    def test_charges(self):
        self.assertEqual(charge(), 1000)
