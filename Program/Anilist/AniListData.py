# pylint: disable=C0103
"""
This module is used to fetch and process data from AniList.
It uses the requests module to send HTTP requests and the queries module to handle GraphQL queries.
"""
# Import necessary modules
import requests

# pylint: disable=import-error
from Program.Anilist import queries
from Program.Utils.logger import log_message


def fetch_anime_data(response_data, keys):
    """
    Extracts anime data from the response data.

    The function extracts various statistics about the user's anime watching habits,
    as well as information about their favorite genres, tags, voice actors, studios, and staff.

    Parameters:
    response_data (dict): The response data from the AniList API.
    keys (list): The keys to extract from the response data.

    Returns:
    dict: A dictionary containing the extracted data.

    Raises:
    DataExtractionError: If a key is missing in the response data.
    """
    data = {}
    try:
        # Extract the data for each SVG
        data["animeStats"] = {
            "count": response_data["data"]["User"]["statistics"]["anime"]["count"],
            "episodesWatched": response_data["data"]["User"]["statistics"]["anime"][
                "episodesWatched"
            ],
            "minutesWatched": response_data["data"]["User"]["statistics"]["anime"][
                "minutesWatched"
            ],
            "meanScore": response_data["data"]["User"]["statistics"]["anime"][
                "meanScore"
            ],
            "standardDeviation": response_data["data"]["User"]["statistics"]["anime"][
                "standardDeviation"
            ],
        }
        if "animeGenres" in keys:
            top_genres = sorted(
                response_data["data"]["User"]["statistics"]["anime"]["genres"],
                key=lambda x: x["count"],
                reverse=True,
            )[:5]
            data["animeGenres"] = top_genres

        if "animeTags" in keys:
            tags = response_data["data"]["User"]["statistics"]["anime"]["tags"]
            top_tags = sorted(tags, key=lambda x: x["count"], reverse=True)[:5]
            top_tags = [
                {"tag": tag["tag"]["name"], "count": tag["count"]} for tag in top_tags
            ]
            data["animeTags"] = top_tags

        if "animeVoiceActors" in keys:
            voice_actors = response_data["data"]["User"]["statistics"]["anime"][
                "voiceActors"
            ]
            top_voice_actors = sorted(
                voice_actors, key=lambda x: x["count"], reverse=True
            )[:5]
            top_voice_actors = [
                {
                    "voiceActor": actor["voiceActor"]["name"]["full"],
                    "count": actor["count"],
                }
                for actor in top_voice_actors
            ]
            data["animeVoiceActors"] = top_voice_actors

        if "animeStudios" in keys:
            studios = response_data["data"]["User"]["statistics"]["anime"]["studios"]
            top_studios = sorted(studios, key=lambda x: x["count"], reverse=True)[:5]
            top_studios = [
                {"studio": studio["studio"]["name"], "count": studio["count"]}
                for studio in top_studios
            ]
            data["animeStudios"] = top_studios

        if "animeStaff" in keys:
            staff = response_data["data"]["User"]["statistics"]["anime"]["staff"]
            top_staff = sorted(staff, key=lambda x: x["count"], reverse=True)[:5]
            top_staff = [
                {
                    "staff": staff_member["staff"]["name"]["full"],
                    "count": staff_member["count"],
                }
                for staff_member in top_staff
            ]
            data["animeStaff"] = top_staff
    except KeyError as e:
        raise ValueError(f"Missing key {e} in anime response data") from e
    return data


def fetch_manga_data(response_data, keys):
    """
    Extracts manga data from the response data.

    The function extracts various statistics about the user's manga reading habits,
    as well as information about their favorite genres, tags, and staff.

    Parameters:
    response_data (dict): The response data from the AniList API.
    keys (list): The keys to extract from the response data.

    Returns:
    dict: A dictionary containing the extracted data.

    Raises:
    ValueError: If a key is missing in the response data.
    """
    data = {}
    try:
        # Extract the data for each SVG
        data["mangaStats"] = {
            "count": response_data["data"]["User"]["statistics"]["manga"]["count"],
            "chaptersRead": response_data["data"]["User"]["statistics"]["manga"][
                "chaptersRead"
            ],
            "volumesRead": response_data["data"]["User"]["statistics"]["manga"][
                "volumesRead"
            ],
            "meanScore": response_data["data"]["User"]["statistics"]["manga"][
                "meanScore"
            ],
            "standardDeviation": response_data["data"]["User"]["statistics"]["manga"][
                "standardDeviation"
            ],
        }
        if "mangaGenres" in keys:
            genres = response_data["data"]["User"]["statistics"]["manga"]["genres"]
            top_genres = sorted(genres, key=lambda x: x["count"], reverse=True)[:5]
            top_genres = [
                {"genre": genre["genre"], "count": genre["count"]}
                for genre in top_genres
            ]
            data["mangaGenres"] = top_genres

        if "mangaTags" in keys:
            tags = response_data["data"]["User"]["statistics"]["manga"]["tags"]
            top_tags = sorted(tags, key=lambda x: x["count"], reverse=True)[:5]
            top_tags = [
                {"tag": tag["tag"]["name"], "count": tag["count"]} for tag in top_tags
            ]
            data["mangaTags"] = top_tags

        if "mangaStaff" in keys:
            staff = response_data["data"]["User"]["statistics"]["manga"]["staff"]
            top_staff = sorted(staff, key=lambda x: x["count"], reverse=True)[:5]
            top_staff = [
                {
                    "staff": staff_member["staff"]["name"]["full"],
                    "count": staff_member["count"],
                }
                for staff_member in top_staff
            ]
            data["mangaStaff"] = top_staff
    except KeyError as e:
        raise ValueError(f"Missing key {e} in manga response data") from e
    return data


def fetch_social_data(response_data):
    """
    Extracts social data from the response data.

    The function extracts various statistics about the user's social activity,
    such as the total number of followers, following, activities, thread posts,
    comments, and reviews.

    Parameters:
    response_data (dict): The response data from the AniList API.

    Returns:
    dict: A dictionary containing the extracted data.

    Raises:
    ValueError: If a key is missing in the response data.
    """
    data = {}
    try:
        # Extract social stats
        data["socialStats"] = {
            "totalFollowers": response_data["data"]["followersPage"]["pageInfo"][
                "total"
            ],
            "totalFollowing": response_data["data"]["followingPage"]["pageInfo"][
                "total"
            ],
            "totalActivity": sum(
                amount["amount"]
                for amount in response_data["data"]["User"]["stats"]["activityHistory"]
            ),
            "threadPostsCommentsCount": response_data["data"]["threadsPage"][
                "pageInfo"
            ]["total"]
            + response_data["data"]["threadCommentsPage"]["pageInfo"]["total"],
            "totalReviews": response_data["data"]["reviewsPage"]["pageInfo"]["total"],
        }
    except KeyError as e:
        raise ValueError(f"Missing key {e} in social response data") from e
    return data


def fetch_anilist_data(username, keys):
    """
    Fetches data from AniList for a specific user.

    The function sends a request to the AniList API to fetch data for the specified user.
    It then extracts the desired data from the response using the provided keys.

    Parameters:
    username (str): The username of the AniList user.
    keys (list): The keys to extract from the response data.

    Returns:
    dict: A dictionary containing the extracted data, or None if an error occurred.

    Raises:
    requests.exceptions.RequestException: If a network error occurred.
    """
    try:
        log_message(f"Started fetching data for {username}", "debug")

        user_id_response = requests.post(
            "https://graphql.anilist.co",
            json={
                "query": queries.USER_ID,
                "variables": {"userName": username},
            },
            timeout=10,
        )

        if user_id_response is None or user_id_response.status_code != 200:
            log_message("Error: Failed to get user ID", "error")
            return None

        user_id = user_id_response.json()["data"]["User"]["id"]

        data = {key: None for key in keys}

        try:
            response = requests.post(
                "https://graphql.anilist.co",
                json={
                    "query": queries.USER_ANIME_MANGA_SOCIAL_STATS,
                    "variables": {"userName": username, "userId": user_id},
                },
                timeout=10,
            )

            response_data = response.json()

            if response_data is None or "data" not in response_data:
                log_message("Error: No data in response", "error")
                return None

            try:
                data.update(fetch_anime_data(response_data, keys))
                data.update(fetch_manga_data(response_data, keys))
                data.update(fetch_social_data(response_data))
            except Exception as e:  # pylint: disable=W0703
                log_message(f"Error: {e}", "error")
                return None
        except requests.exceptions.RequestException as error:
            if error.response and error.response.status_code == 429:
                log_message("Rate limit exceeded", "error")
                return None
            raise error
        return data
    except requests.exceptions.RequestException as error:
        log_message(f"Failed to fetch data for user {username}: {error}", "error")
        return None
