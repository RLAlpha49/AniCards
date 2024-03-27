# """
# This module contains unit tests for the Badges route in the main application.
# """
#
# # pylint: disable=R0801
#
# import unittest
#
# from src.main import app  # pylint: disable=E0401
#
#
# class TestBadgesRoute(unittest.TestCase):
#     """
#     Test case for the Badges route.
#     """
#
#     def setUp(self):
#         """
#         Set up the test client and get the response from the Badges route.
#         """
#         self.app = app.test_client()
#         self.app.testing = True
#         self.response = self.app.get("/Badges")
#         self.response_data = self.response.data.decode()
#
#     def test_01_status_code(self):
#         """
#         Test the status code of the response.
#         """
#         print("\nTesting Badges Route...")
#         status_code_check = self.response.status_code == 200
#         self.assertTrue(status_code_check)
#         print(
#             "Status code check: "
#             + ("\033[92m✔\033[0m" if status_code_check else "\033[91m✖\033[0m")
#         )
#
#     def test_02_title_check(self):
#         """
#         Test the title of the response.
#         """
#         title_check = "<title>AniList Badge Generator</title>" in self.response_data
#         self.assertTrue(title_check)
#         print(
#             "Title check: "
#             + ("\033[92m✔\033[0m" if title_check else "\033[91m✖\033[0m")
#         )
#
#     def test_03_h1_check(self):
#         """
#         Test the h1 of the response.
#         """
#         h1_check = "<h1>AniList Badge Generator</h1>" in self.response_data
#         self.assertTrue(h1_check)
#         print("H1 check: " + ("\033[92m✔\033[0m" if h1_check else "\033[91m✖\033[0m"))
#
#     def test_04_description_check(self):
#         """
#         Test the description of the response.
#         """
#         description_check = (
#             "AniList Badge Generator: Create custom badges with user data from AniList."
#             in self.response_data
#         )
#         self.assertTrue(description_check)
#         print(
#             "Description check: "
#             + ("\033[92m✔\033[0m" if description_check else "\033[91m✖\033[0m")
#         )
#
#     def test_05_username_input_check(self):
#         """
#         Test the username input of the response.
#         """
#         username_input_check = (
#             '<input type="text" id="usernameInput" placeholder="Enter username"/>'
#             in self.response_data
#         )
#         self.assertTrue(username_input_check)
#         print(
#             "Username input check: "
#             + ("\033[92m✔\033[0m" if username_input_check else "\033[91m✖\033[0m")
#         )
#
#     def test_06_milestone_input_check(self):
#         """
#         Test the milestone input of the response.
#         """
#         milestone_input_check = (
#             '<input type="text" id="milestoneInput" placeholder="Enter milestone"/>'
#             in self.response_data
#         )
#         self.assertTrue(milestone_input_check)
#         print(
#             "Milestone input check: "
#             + ("\033[92m✔\033[0m" if milestone_input_check else "\033[91m✖\033[0m")
#         )
#
#     def test_07_color_form_check(self):
#         """
#         Test the color form of the response.
#         """
#         color_form_check = (
#             '<form id="colorForm" action="/username/generate_svgs" method="post">'
#             in self.response_data
#         )
#         self.assertTrue(color_form_check)
#         print(
#             "Color form check: "
#             + ("\033[92m✔\033[0m" if color_form_check else "\033[91m✖\033[0m")
#         )
#
#     def test_08_data_form_check(self):
#         """
#         Test the data form of the response.
#         """
#         data_form_check = (
#             '<form id="dataForm" action="/username/generate_svgs" method="post">'
#             in self.response_data
#         )
#         self.assertTrue(data_form_check)
#         print(
#             "Data form check: "
#             + ("\033[92m✔\033[0m" if data_form_check else "\033[91m✖\033[0m")
#         )
#
#
# if __name__ == "__main__":
#     # Run the test suite.
#     suite = unittest.TestLoader().loadTestsFromTestCase(TestBadgesRoute)
#     unittest.TextTestRunner(verbosity=2).run(suite)
