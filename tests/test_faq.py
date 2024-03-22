import unittest

from main import app


class TestFaqRoute(unittest.TestCase):

    def setUp(self):
        self.app = app.test_client()
        self.app.testing = True

    def test_faq_route(self):
        print('\nTesting FAQ route...')
        response = self.app.get('/faq')
        self.assertEqual(response.status_code, 200)

        # Convert the response data from bytes to string
        response_data = response.data.decode()

        # Check that the title is correct
        title_check = '<title>AniCards FAQ</title>' in response_data
        self.assertTrue(title_check)
        print('Title check: ' + ('\033[92m✔\033[0m' if title_check else '\033[91m✖\033[0m'))

        # Check that the h1 tag is correct
        h1_check = '<h1>Frequently Asked Questions</h1>' in response_data
        self.assertTrue(h1_check)
        print('H1 check: ' + ('\033[92m✔\033[0m' if h1_check else '\033[91m✖\033[0m'))

        # Check that the description meta tag is correct
        description_check = 'Frequently Asked Questions about AniCards.' in response_data
        self.assertTrue(description_check)
        print('Description check: ' + ('\033[92m✔\033[0m' if description_check else '\033[91m✖\033[0m'))

        # Check that the first question is present
        question1_check = 'What should I do if I don\'t see the latest updates you\'ve made to the website?' in response_data
        self.assertTrue(question1_check)
        print('Question 1 check: ' + ('\033[92m✔\033[0m' if question1_check else '\033[91m✖\033[0m'))

        # Check that the second question is present
        question2_check = 'What is the purpose of this project?' in response_data
        self.assertTrue(question2_check)
        print('Question 2 check: ' + ('\033[92m✔\033[0m' if question2_check else '\033[91m✖\033[0m'))

        # Check that the third question is present
        question3_check = 'How can I contribute to this project?' in response_data
        self.assertTrue(question3_check)
        print('Question 3 check: ' + ('\033[92m✔\033[0m' if question3_check else '\033[91m✖\033[0m'))

        # Check that the fourth question is present
        question4_check = 'How do I report a bug or request a feature?' in response_data
        self.assertTrue(question4_check)
        print('Question 4 check: ' + ('\033[92m✔\033[0m' if question4_check else '\033[91m✖\033[0m'))

        # Check that the fifth question is present
        question5_check = 'How can I get help if I have a problem?' in response_data
        self.assertTrue(question5_check)
        print('Question 5 check: ' + ('\033[92m✔\033[0m' if question5_check else '\033[91m✖\033[0m'))

    def tearDown(self):
        pass
