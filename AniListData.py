# Import necessary modules
import requests
from jsonpath_ng import parse
import queries

# Function to fetch data from AniList for a given username
def fetch_anilist_data(username, keys):
    try:
        user_id_response = requests.post('https://graphql.anilist.co', json={
            'query': queries.USER_ID,
            'variables': {'userName': username},
        })

        if user_id_response is None or user_id_response.status_code != 200:
            print("Error: Failed to get user ID")
            return None

        user_id = user_id_response.json()['data']['User']['id']

        data = {key: None for key in keys}

        requests_data = [
            {'query': queries.USER_ANIME_STATS, 'variables': {'userName': username}, 'key': 'animeStats', 'path': 'data.User.statistics.anime'},
            {'query': queries.USER_SOCIAL_STATS, 'variables': {'userName': username, 'userId': user_id}, 'key': 'socialStats', 'path': 'data'},
            {'query': queries.USER_MANGA_STATS, 'variables': {'userName': username}, 'key': 'mangaStats', 'path': 'data.User.statistics.manga'},
        ]

        for request_data in requests_data:
            if request_data['key'] not in keys:
                continue

            try:
                response = requests.post('https://graphql.anilist.co', json={
                    'query': request_data['query'],
                    'variables': request_data['variables'],
                })

                response_data = response.json()
                print(response.json())

                if response_data is None or 'data' not in response_data:
                    print("Error: No data in response")
                    data[request_data['key']] = None
                else:
                    if request_data['key'] == 'animeStats':
                        # Extract the data for each SVG
                        data['animeStats'] = {
                            'count': response_data['data']['User']['statistics']['anime']['count'],
                            'episodesWatched': response_data['data']['User']['statistics']['anime']['episodesWatched'],
                            'minutesWatched': response_data['data']['User']['statistics']['anime']['minutesWatched'],
                            'meanScore': response_data['data']['User']['statistics']['anime']['meanScore'],
                            'standardDeviation': response_data['data']['User']['statistics']['anime']['standardDeviation'],
                        }
                        if 'animeGenres' in keys:
                            data['animeGenres'] = response_data['data']['User']['statistics']['anime']['genres']
                        if 'animeTags' in keys:
                            data['animeTags'] = response_data['data']['User']['statistics']['anime']['tags']
                        if 'animeVoiceActors' in keys:
                            data['animeVoiceActors'] = response_data['data']['User']['statistics']['anime']['voiceActors']
                        if 'animeStudios' in keys:
                            data['animeStudios'] = response_data['data']['User']['statistics']['anime']['studios']
                        if 'animeStaff' in keys:
                            data['animeStaff'] = response_data['data']['User']['statistics']['anime']['staff']
                    elif request_data['key'] == 'mangaStats':
                        # Extract the data for each SVG
                        data['mangaStats'] = {
                            'count': response_data['data']['User']['statistics']['manga']['count'],
                            'chaptersRead': response_data['data']['User']['statistics']['manga']['chaptersRead'],
                            'volumesRead': response_data['data']['User']['statistics']['manga']['volumesRead'],
                            'meanScore': response_data['data']['User']['statistics']['manga']['meanScore'],
                            'standardDeviation': response_data['data']['User']['statistics']['manga']['standardDeviation'],
                        }
                        if 'mangaGenres' in keys:
                            data['mangaGenres'] = response_data['data']['User']['statistics']['manga']['genres']
                        if 'mangaTags' in keys:
                            data['mangaTags'] = response_data['data']['User']['statistics']['manga']['tags']
                        if 'mangaStaff' in keys:
                            data['mangaStaff'] = response_data['data']['User']['statistics']['manga']['staff']
                    elif request_data['key'] == 'socialStats':
                        simplified_data = {
                            'totalFollowers': response_data['data']['followersPage']['pageInfo']['total'],
                            'totalFollowing': response_data['data']['followingPage']['pageInfo']['total'],
                            'totalActivity': sum(amount['amount'] for amount in response_data['data']['User']['stats']['activityHistory']),
                            'threadPostsCommentsCount': response_data['data']['threadsPage']['pageInfo']['total'] + response_data['data']['threadCommentsPage']['pageInfo']['total'],
                            'totalReviews': response_data['data']['reviewsPage']['pageInfo']['total'],
                        }
                        data[request_data['key']] = simplified_data
                        print(simplified_data)
                    else:
                        jsonpath_expr = parse(request_data['path'])
                        matches = [match.value for match in jsonpath_expr.find(response.json())]
                        if not matches:
                            print("Error: No matches found in JSON response")
                            return None
                        value = matches[0]

                        data[request_data['key']] = value
            except requests.exceptions.RequestException as error:
                if error.response and error.response.status_code == 429:
                    print(f'Rate limit exceeded for {request_data["key"]}')
                    data[request_data['key']] = None
                else:
                    raise error

        return data
    except requests.exceptions.RequestException as error:
        print(f'Failed to fetch data for user {username}:', error)
        return None