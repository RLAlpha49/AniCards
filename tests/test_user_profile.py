import unittest

from main import app


class TestUserProfileRoute(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_user_profile_route(self):
        print("\nTesting the User Profile Route")
        response = self.app.get('/StatCards/Alpha49')
        self.assertEqual(response.status_code, 200)

        # Convert the response data from bytes to string
        response_data = response.data.decode()

        # Check that the title is correct
        title_check = '<title>AniList Stat Cards Generated User</title>' in response_data
        self.assertTrue(title_check)
        print('Title check: ' + ('\033[92m✔\033[0m' if title_check else '\033[91m✖\033[0m'))

        # Check that the h1 tag is correct
        h1_check = '<h1>Alpha49</h1>' in response_data
        self.assertTrue(h1_check)
        print('H1 check: ' + ('\033[92m✔\033[0m' if h1_check else '\033[91m✖\033[0m'))

        # Check that the description meta tag is correct
        description_check = ('AniList User Page: View and customize AniList stat cards for specific users. Select from '
                             'various SVG types and download your customized card.') in response_data
        self.assertTrue(description_check)
        print('Description check: ' + ('\033[92m✔\033[0m' if description_check else '\033[91m✖\033[0m'))

        # Check that the SVG container is present
        svg_container_check = '<div class="svg-container">' in response_data
        self.assertTrue(svg_container_check)
        print('SVG container check: ' + ('\033[92m✔\033[0m' if svg_container_check else '\033[91m✖\033[0m'))

        # Check that the SVG item is present
        svg_item_check = '<div class="svg-item">' in response_data
        self.assertTrue(svg_item_check)
        print('SVG item check: ' + ('\033[92m✔\033[0m' if svg_item_check else '\033[91m✖\033[0m'))

        # Check that the SVG wrapper is present
        svg_wrapper_check = '<div class="svg-wrapper">' in response_data
        self.assertTrue(svg_wrapper_check)
        print('SVG wrapper check: ' + ('\033[92m✔\033[0m' if svg_wrapper_check else '\033[91m✖\033[0m'))

        # Check that the SVG controls are present
        svg_controls_check = '<div class="svg-controls">' in response_data
        self.assertTrue(svg_controls_check)
        print('SVG controls check: ' + ('\033[92m✔\033[0m' if svg_controls_check else '\033[91m✖\033[0m'))

        # Check that the select container is present
        select_container_check = '<div class="select-container">' in response_data
        self.assertTrue(select_container_check)
        print('Select container check: ' + ('\033[92m✔\033[0m' if select_container_check else '\033[91m✖\033[0m'))

        # Check that the SVG is loading or loaded
        svg_loading_check = ('<div id="' in response_data and '">Loading...</div>' in response_data)
        svg_loaded_check = ('<img src="data:image/svg+xml;base64,' in response_data
                            and 'alt="SVG image of animeStats">' in response_data)
        self.assertTrue(svg_loading_check or svg_loaded_check)
        result = '\033[92m✔\033[0m' if svg_loading_check or svg_loaded_check else '\033[91m✖\033[0m'
        print('SVG loading or loaded check: ' + result)

        # Check that the button wrapper is present
        button_wrapper_check = '<div class="button-wrapper">' in response_data
        self.assertTrue(button_wrapper_check)
        print('Button wrapper check: ' + ('\033[92m✔\033[0m' if button_wrapper_check else '\033[91m✖\033[0m'))

    def tearDown(self):
        pass
