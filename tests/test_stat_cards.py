import time
import unittest

from main import app


class TestStatCardsRoute(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_stat_cards_route(self):
        print('\nTesting Stat Cards route...')
        response = self.app.get('/StatCards')
        time.sleep(1)
        self.assertEqual(response.status_code, 200)

        # Convert the response data from bytes to string
        response_data = response.data.decode()

        # Check that the title is correct
        title_check = '<title>AniList Stat Cards Generator</title>' in response_data
        self.assertTrue(title_check)
        print('Title check: ' + ('\033[92m✔\033[0m' if title_check else '\033[91m✖\033[0m'))

        # Check that the h1 tag is correct
        h1_check = '<h1>AniList Stat Cards Generator</h1>' in response_data
        self.assertTrue(h1_check)
        print('H1 check: ' + ('\033[92m✔\033[0m' if h1_check else '\033[91m✖\033[0m'))

        # Check that the description meta tag is correct
        description_check = ('AniList Stat Cards Generator: Create custom stat cards with user data from AniList. '
                             'Customize colors and select specific data types for your card.') in response_data
        self.assertTrue(description_check)
        print('Description check: ' + ('\033[92m✔\033[0m' if description_check else '\033[91m✖\033[0m'))

        # Check that the input field for username is present
        username_input_check = '<input type="text" id="usernameInput" placeholder="Enter username" />' in response_data
        self.assertTrue(username_input_check)
        print('Username input check: ' + ('\033[92m✔\033[0m' if username_input_check else '\033[91m✖\033[0m'))

        # Check that the color selection form is present
        color_form_check = '<form id="colorForm" action="/username/generate_svgs" method="post">' in response_data
        self.assertTrue(color_form_check)
        print('Color form check: ' + ('\033[92m✔\033[0m' if color_form_check else '\033[91m✖\033[0m'))

        # Check that the data selection form is present
        data_form_check = '<form id="dataForm" action="/username/generate_svgs" method="post">' in response_data
        self.assertTrue(data_form_check)
        print('Data form check: ' + ('\033[92m✔\033[0m' if data_form_check else '\033[91m✖\033[0m'))

    def tearDown(self):
        pass
