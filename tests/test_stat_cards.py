"""
This module contains unit tests for the User Profile route in the main application.
"""

import unittest

from main import app


class TestStatCardsRoute(unittest.TestCase):
    """
    Test case for the StatCards route.
    """

    def setUp(self):
        """
        Set up the test client and get the response from the StatCards route.
        """
        self.app = app.test_client()
        self.app.testing = True
        self.response = self.app.get("/StatCards")
        self.response_data = self.response.data.decode()

    def test_1_status_code(self):
        """
        Test the status code of the response.
        """
        print("\nTesting StatCard Route...")
        status_code_check = self.response.status_code == 200
        self.assertTrue(status_code_check)
        print(
            "Status code check: "
            + ("\033[92m✔\033[0m" if status_code_check else "\033[91m✖\033[0m")
        )

    def test_2_title_check(self):
        """
        Test the title of the response.
        """
        title_check = (
            "<title>AniList Stat Cards Generator</title>" in self.response_data
        )
        self.assertTrue(title_check)
        print(
            "Title check: "
            + ("\033[92m✔\033[0m" if title_check else "\033[91m✖\033[0m")
        )

    def test_3_h1_check(self):
        """
        Test the h1 of the response.
        """
        h1_check = "<h1>AniList Stat Cards Generator</h1>" in self.response_data
        self.assertTrue(h1_check)
        print("H1 check: " + ("\033[92m✔\033[0m" if h1_check else "\033[91m✖\033[0m"))

    def test_4_description_check(self):
        """
        Test the description of the response.
        """
        description_check = (
            "AniList Stat Cards Generator: Create custom stat cards with user data from AniList. "
            "Customize colors and select specific data types for your card."
        ) in self.response_data
        self.assertTrue(description_check)
        print(
            "Description check: "
            + ("\033[92m✔\033[0m" if description_check else "\033[91m✖\033[0m")
        )

    def test_5_username_input_check(self):
        """
        Test the username input of the response.
        """
        username_input_check = (
            '<input type="text" id="usernameInput" placeholder="Enter username"/>'
            in self.response_data
        )
        self.assertTrue(username_input_check)
        print(
            "Username input check: "
            + ("\033[92m✔\033[0m" if username_input_check else "\033[91m✖\033[0m")
        )

    def test_6_color_form_check(self):
        """
        Test the color form of the response.
        """
        color_form_check = (
            '<form id="colorForm" action="/username/generate_svgs" method="post">'
            in self.response_data
        )
        self.assertTrue(color_form_check)
        print(
            "Color form check: "
            + ("\033[92m✔\033[0m" if color_form_check else "\033[91m✖\033[0m")
        )

    def test_7_data_form_check(self):
        """
        Test the data form of the response.
        """
        data_form_check = (
            '<form id="dataForm" action="/username/generate_svgs" method="post">'
            in self.response_data
        )
        self.assertTrue(data_form_check)
        print(
            "Data form check: "
            + ("\033[92m✔\033[0m" if data_form_check else "\033[91m✖\033[0m")
        )


if __name__ == "__main__":
    # Run the test suite.
    suite = unittest.TestLoader().loadTestsFromTestCase(TestStatCardsRoute)
    unittest.TextTestRunner(verbosity=2).run(suite)
