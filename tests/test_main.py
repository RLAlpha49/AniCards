import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import unittest  # noqa: E402
from test_home import TestHomeRoute  # noqa: E402
from test_faq import TestFaqRoute  # noqa: E402
from test_stat_cards import TestStatCardsRoute  # noqa: E402
from test_badges import TestBadgesRoute  # noqa: E402
from test_user_profile import TestUserProfileRoute  # noqa: E402


def suite():
    loader = unittest.TestLoader()
    test_suite = unittest.TestSuite()
    test_suite.addTest(loader.loadTestsFromTestCase(TestHomeRoute))
    test_suite.addTest(loader.loadTestsFromTestCase(TestFaqRoute))
    test_suite.addTest(loader.loadTestsFromTestCase(TestStatCardsRoute))
    test_suite.addTest(loader.loadTestsFromTestCase(TestBadgesRoute))
    test_suite.addTest(loader.loadTestsFromTestCase(TestUserProfileRoute))
    return test_suite


if __name__ == "__main__":
    runner = unittest.TextTestRunner()
    runner.run(suite())
