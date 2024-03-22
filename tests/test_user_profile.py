import unittest

from main import app


class TestUserProfileRoute(unittest.TestCase):
    """
    Test case for the UserProfile route.
    """

    def setUp(self):
        """
        Set up the test client and get the response from the UserProfile route.
        """
        self.app = app.test_client()
        self.app.testing = True
        self.response = self.app.get("/StatCards/Alpha49")
        self.response_data = self.response.data.decode()

    def test_01_status_code(self):
        """
        Test the status code of the response.
        """
        print("\nTesting User Profile Route...")
        status_code_check = self.response.status_code == 200
        self.assertTrue(status_code_check)
        print(
            "Status code check: "
            + ("\033[92m✔\033[0m" if status_code_check else "\033[91m✖\033[0m")
        )

    def test_02_title_check(self):
        """
        Test the title of the response.
        """
        title_check = (
                "<title>AniList Stat Cards Generated User</title>" in self.response_data
        )
        self.assertTrue(title_check)
        print(
            "Title check: "
            + ("\033[92m✔\033[0m" if title_check else "\033[91m✖\033[0m")
        )

    def test_03_h1_check(self):
        """
        Test the h1 of the response.
        """
        h1_check = "<h1>Alpha49</h1>" in self.response_data
        self.assertTrue(h1_check)
        print("H1 check: " + ("\033[92m✔\033[0m" if h1_check else "\033[91m✖\033[0m"))

    def test_04_description_check(self):
        """
        Test the description of the response.
        """
        description_check = (
                                "AniList User Page: View and customize AniList stat cards for specific users. Select from "
                                "various SVG types and download your customized card."
                            ) in self.response_data
        self.assertTrue(description_check)
        print(
            "Description check: "
            + ("\033[92m✔\033[0m" if description_check else "\033[91m✖\033[0m")
        )

    def test_05_svg_container_check(self):
        """
        Test the SVG container of the response.
        """
        svg_container_check = '<div class="svg-container">' in self.response_data
        self.assertTrue(svg_container_check)
        print(
            "SVG container check: "
            + ("\033[92m✔\033[0m" if svg_container_check else "\033[91m✖\033[0m")
        )

    def test_06_svg_item_check(self):
        """
        Test the SVG item of the response.
        """
        svg_item_check = '<div class="svg-item">' in self.response_data
        self.assertTrue(svg_item_check)
        print(
            "SVG item check: "
            + ("\033[92m✔\033[0m" if svg_item_check else "\033[91m✖\033[0m")
        )

    def test_07_svg_wrapper_check(self):
        """
        Test the SVG wrapper of the response.
        """
        svg_wrapper_check = '<div class="svg-wrapper">' in self.response_data
        self.assertTrue(svg_wrapper_check)
        print(
            "SVG wrapper check: "
            + ("\033[92m✔\033[0m" if svg_wrapper_check else "\033[91m✖\033[0m")
        )

    def test_08_svg_controls_check(self):
        """
        Test the SVG controls of the response.
        """
        svg_controls_check = '<div class="svg-controls">' in self.response_data
        self.assertTrue(svg_controls_check)
        print(
            "SVG controls check: "
            + ("\033[92m✔\033[0m" if svg_controls_check else "\033[91m✖\033[0m")
        )

    def test_09_select_container_check(self):
        """
        Test the select container of the response.
        """
        select_container_check = '<div class="select-container">' in self.response_data
        self.assertTrue(select_container_check)
        print(
            "Select container check: "
            + ("\033[92m✔\033[0m" if select_container_check else "\033[91m✖\033[0m")
        )

    def test_10_svg_loading_or_loaded_check(self):
        """
        Test the SVG loading or loaded check of the response.
        """
        svg_loading_check = (
                '<div id="' in self.response_data
                and '">Loading...</div>' in self.response_data
        )
        svg_loaded_check = (
                '<img src="data:image/svg+xml;base64,' in self.response_data
                and 'alt="SVG image of animeStats">' in self.response_data
        )
        self.assertTrue(svg_loading_check or svg_loaded_check)
        result = (
            "\033[92m✔\033[0m"
            if svg_loading_check or svg_loaded_check
            else "\033[91m✖\033[0m"
        )
        print("SVG loading or loaded check: " + result)

    def test_11_button_wrapper_check(self):
        """
        Test the button wrapper of the response.
        """
        button_wrapper_check = '<div class="button-wrapper">' in self.response_data
        self.assertTrue(button_wrapper_check)
        print(
            "Button wrapper check: "
            + ("\033[92m✔\033[0m" if button_wrapper_check else "\033[91m✖\033[0m")
        )

    def tearDown(self):
        """
        Tear down the test case.
        """
        pass


if __name__ == "__main__":
    """
    Run the test suite.
    """
    suite = unittest.TestLoader().loadTestsFromTestCase(TestUserProfileRoute)
    unittest.TextTestRunner(verbosity=2).run(suite)
