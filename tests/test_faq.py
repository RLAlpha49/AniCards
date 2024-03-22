import unittest

from main import app


class TestFaqRoute(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True
        self.response = self.app.get("/faq")
        self.response_data = self.response.data.decode()

    def test_1_faq_route_status(self):
        print("\nTesting FAQ Route...")
        response_status_check = self.response.status_code == 200
        self.assertTrue(response_status_check)
        print(
            "Response status check: "
            + ("\033[92m✔\033[0m" if response_status_check else "\033[91m✖\033[0m")
        )

    def test_2_faq_route_title(self):
        title_check = "<title>AniCards FAQ</title>" in self.response_data
        self.assertTrue(title_check)
        print(
            "Title check: "
            + ("\033[92m✔\033[0m" if title_check else "\033[91m✖\033[0m")
        )

    def test_3_faq_route_h1(self):
        h1_check = "<h1>Frequently Asked Questions</h1>" in self.response_data
        self.assertTrue(h1_check)
        print("H1 check: " + ("\033[92m✔\033[0m" if h1_check else "\033[91m✖\033[0m"))

    def test_4_faq_route_description(self):
        description_check = (
                "Frequently Asked Questions about AniCards." in self.response_data
        )
        self.assertTrue(description_check)
        print(
            "Description check: "
            + ("\033[92m✔\033[0m" if description_check else "\033[91m✖\033[0m")
        )

    def test_5_faq_route_question1(self):
        question1_check = (
                "What should I do if I don't see the latest updates you've made to the website?"
                in self.response_data
        )
        self.assertTrue(question1_check)
        print(
            "Question 1 check: "
            + ("\033[92m✔\033[0m" if question1_check else "\033[91m✖\033[0m")
        )

    def test_6_faq_route_question2(self):
        question2_check = "What is the purpose of this project?" in self.response_data
        self.assertTrue(question2_check)
        print(
            "Question 2 check: "
            + ("\033[92m✔\033[0m" if question2_check else "\033[91m✖\033[0m")
        )

    def test_7_faq_route_question3(self):
        question3_check = "How can I contribute to this project?" in self.response_data
        self.assertTrue(question3_check)
        print(
            "Question 3 check: "
            + ("\033[92m✔\033[0m" if question3_check else "\033[91m✖\033[0m")
        )

    def test_8_faq_route_question4(self):
        question4_check = (
                "How do I report a bug or request a feature?" in self.response_data
        )
        self.assertTrue(question4_check)
        print(
            "Question 4 check: "
            + ("\033[92m✔\033[0m" if question4_check else "\033[91m✖\033[0m")
        )

    def test_9_faq_route_question5(self):
        question5_check = (
                "How can I get help if I have a problem?" in self.response_data
        )
        self.assertTrue(question5_check)
        print(
            "Question 5 check: "
            + ("\033[92m✔\033[0m" if question5_check else "\033[91m✖\033[0m")
        )

    def tearDown(self):
        pass


if __name__ == "__main__":
    suite = unittest.TestLoader().loadTestsFromTestCase(TestFaqRoute)
    unittest.TextTestRunner(verbosity=2).run(suite)
