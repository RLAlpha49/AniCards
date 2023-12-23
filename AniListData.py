# Import necessary modules
import requests
from jsonpath_ng import parse
import queries

# Function to fetch data from AniList for a given username
def fetch_ani_list_data(username):
    try:
        # Make a POST request to get the user ID
        user_id_response = requests.post('https://graphql.anilist.co', json={
            'query': queries.USER_ID,
            'variables': {'userName': username},
        })

        # Check if the response is valid
        if user_id_response is None or user_id_response.status_code != 200:
            print("Error: Failed to get user ID")
            return None

        # Extract the user ID from the response
        user_id = user_id_response.json()['data']['User']['id']

        # Initialize a dictionary to store the data
        data = {
            'animeCount': None,
            'totalFollowers': None,
            'totalFollowing': None,
            'mangaCount': None,
            'chaptersRead': None,
            'episodesWatched': None,
            'hoursWatched': None,
        }

        # Define the queries to be made
        requests_data = [
            # Each dictionary contains the GraphQL query, the variables to be used in the query, the key to store the result in the data dictionary, and the JSONPath to extract the result from the response
            {'query': queries.USER_ANIME_COUNT, 'variables': {'userName': username}, 'key': 'animeCount', 'path': 'data.User.statistics.anime.count'},
            {'query': queries.USER_TOTAL_FOLLOWERS, 'variables': {'userId': user_id}, 'key': 'totalFollowers', 'path': 'data.Page.pageInfo.total'},
            {'query': queries.USER_TOTAL_FOLLOWING, 'variables': {'userId': user_id}, 'key': 'totalFollowing', 'path': 'data.Page.pageInfo.total'},
            {'query': queries.USER_MANGA_COUNT, 'variables': {'userName': username}, 'key': 'mangaCount', 'path': 'data.User.statistics.manga.count'},
            {'query': queries.USER_CHAPTERS_READ, 'variables': {'userName': username}, 'key': 'chaptersRead', 'path': 'data.User.statistics.manga.chaptersRead'},
            {'query': queries.USER_EPISODES_WATCHED, 'variables': {'userName': username}, 'key': 'episodesWatched', 'path': 'data.User.statistics.anime.episodesWatched'},
            {'query': queries.USER_HOURS_WATCHED, 'variables': {'userName': username}, 'key': 'hoursWatched', 'path': 'data.User.statistics.anime.minutesWatched'},
        ]

        # Make the queries and store the results in the data dictionary
        for request_data in requests_data:
            try:
                response = requests.post('https://graphql.anilist.co', json={
                    'query': request_data['query'],
                    'variables': request_data['variables'],
                })

                # Use JSONPath to extract the result from the response
                jsonpath_expr = parse(request_data['path'])
                matches = [match.value for match in jsonpath_expr.find(response.json())]
                if not matches:
                    print("Error: No matches found in JSON response")
                    return None
                value = matches[0]

                # Convert minutes watched to hours watched
                if request_data['key'] == 'hoursWatched':
                    value = round(value / 60)

                # Store the result in the data dictionary
                data[request_data['key']] = value
            except requests.exceptions.RequestException as error:
                if error.response and error.response.status_code == 429:
                    print(f'Rate limit exceeded for {request_data["key"]}')
                    data[request_data['key']] = None
                else:
                    raise error

        # Return the data
        return data
    except requests.exceptions.RequestException as error:
        print(f'Failed to fetch data for user {username}:', error)
        return None