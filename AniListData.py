import requests
from jsonpath_ng import parse
import queries

def fetch_ani_list_data(username):
    try:
        user_id_response = requests.post('https://graphql.anilist.co', json={
            'query': queries.USER_ID,
            'variables': {'userName': username},
        })

        if user_id_response is None or user_id_response.status_code != 200:
            print("Error: Failed to get user ID")
            return None

        user_id = user_id_response.json()['data']['User']['id']

        data = {
            'animeCount': None,
            'totalFollowers': None,
            'totalFollowing': None,
            'mangaCount': None,
            'chaptersRead': None,
            'episodesWatched': None,
            'hoursWatched': None,
        }

        requests_data = [
            {'query': queries.USER_ANIME_COUNT, 'variables': {'userName': username}, 'key': 'animeCount', 'path': 'data.User.statistics.anime.count'},
            {'query': queries.USER_TOTAL_FOLLOWERS, 'variables': {'userId': user_id}, 'key': 'totalFollowers', 'path': 'data.Page.pageInfo.total'},
            {'query': queries.USER_TOTAL_FOLLOWING, 'variables': {'userId': user_id}, 'key': 'totalFollowing', 'path': 'data.Page.pageInfo.total'},
            {'query': queries.USER_MANGA_COUNT, 'variables': {'userName': username}, 'key': 'mangaCount', 'path': 'data.User.statistics.manga.count'},
            {'query': queries.USER_CHAPTERS_READ, 'variables': {'userName': username}, 'key': 'chaptersRead', 'path': 'data.User.statistics.manga.chaptersRead'},
            {'query': queries.USER_EPISODES_WATCHED, 'variables': {'userName': username}, 'key': 'episodesWatched', 'path': 'data.User.statistics.anime.episodesWatched'},
            {'query': queries.USER_HOURS_WATCHED, 'variables': {'userName': username}, 'key': 'hoursWatched', 'path': 'data.User.statistics.anime.minutesWatched'},
        ]
        
        

        for request_data in requests_data:
            try:
                #print(request_data['query'])
                response = requests.post('https://graphql.anilist.co', json={
                    'query': request_data['query'],
                    'variables': request_data['variables'],
                })
                
                #print(response.json())

                jsonpath_expr = parse(request_data['path'])
                
                matches = [match.value for match in jsonpath_expr.find(response.json())]
                if not matches:
                    print("Error: No matches found in JSON response")
                    return None
                value = matches[0]

                if request_data['key'] == 'hoursWatched':
                    value = round(value / 60)

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