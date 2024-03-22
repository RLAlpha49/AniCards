import unittest

from main import app


class TestHomeRoute(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.response = self.app.get("/")
        self.response_data = self.response.data.decode()

    def test_01_status_code(self):
        print("\nTesting Home route...")
        status_code_check = self.response.status_code == 200
        self.assertTrue(status_code_check)
        print(
            "Status code check: "
            + ("\033[92m✔\033[0m" if status_code_check else "\033[91m✖\033[0m")
        )

    def test_02_title_check(self):
        title_check = "<title>AniCards Home</title>" in self.response_data
        self.assertTrue(title_check)
        print(
            "Title check: "
            + ("\033[92m✔\033[0m" if title_check else "\033[91m✖\033[0m")
        )

    def test_03_h1_check(self):
        h1_check = "<h1>Welcome to AniCards</h1>" in self.response_data
        self.assertTrue(h1_check)
        print("H1 check: " + ("\033[92m✔\033[0m" if h1_check else "\033[91m✖\033[0m"))

    def test_04_description_check(self):
        description_check = (
                                "AniCards is a project in active development that provides statistical cards for AniList "
                                "users."
                            ) in self.response_data
        self.assertTrue(description_check)
        print(
            "Description check: "
            + ("\033[92m✔\033[0m" if description_check else "\033[91m✖\033[0m")
        )

    def tearDown(self):
        pass


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestHomeRoute)
    unittest.TextTestRunner(verbosity=2).run(suite)
