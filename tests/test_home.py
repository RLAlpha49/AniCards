import unittest

from main import app


class TestHomeRoute(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_home_route(self):
        print('\nTesting Home route...')
        response = self.app.get('/')
        self.assertEqual(response.status_code, 200)

        # Convert the response data from bytes to string
        response_data = response.data.decode()

        # Check that the title is correct
        title_check = '<title>AniCards Home</title>' in response_data
        self.assertTrue(title_check)
        print('Title check: ' + ('\033[92m✔\033[0m' if title_check else '\033[91m✖\033[0m'))

        # Check that the h1 tag is correct
        h1_check = '<h1>Welcome to AniCards</h1>' in response_data
        self.assertTrue(h1_check)
        print('H1 check: ' + ('\033[92m✔\033[0m' if h1_check else '\033[91m✖\033[0m'))

        # Check that the description meta tag is correct
        description_check = ('AniCards is a project in active development that provides statistical cards for AniList '
                             'users.') in response_data
        self.assertTrue(description_check)
        print('Description check: ' + ('\033[92m✔\033[0m' if description_check else '\033[91m✖\033[0m'))

    def tearDown(self):
        pass
