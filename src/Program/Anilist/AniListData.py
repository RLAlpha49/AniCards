# pylint: disable=C0103, E0401, C0411
"""
This module is used to fetch and process data from AniList.
It uses the requests module to send HTTP requests and the queries module to handle GraphQL queries.
"""
# Import necessary modules
import requests
from Program.Anilist import queries
from Program.Utils.logger import log_message
from requests.exceptions import Timeout


def get_user_id(username):
    """
    Fetch the user ID from AniList for a given username.

    Args:
        username (str): The username to fetch the ID for.

    Returns:
        int: The ID of the user.

    Raises:
        Timeout: If the request to the AniList API times out.
        Exception: If the request to the AniList API fails for a reason other than a timeout.
    """
    try:
        user_id_response = requests.post(
            "https://graphql.anilist.co",
            json={
                "query": queries.USER_ID,
                "variables": {"userName": username},
            },
            timeout=10,
        )

        response_data = user_id_response.json()

        if (
            "errors" in response_data
            and any(
                "Internal Server Error" in error.get("message")
                or error.get("status") == 500
                for error in response_data["errors"]
            )
        ) or ("error" in response_data and response_data["error"].get("status") == 500):
            raise ValueError("Anilist Server Error (Try Again)")

    except Timeout as exc:
        log_message("Error: Request to get user ID timed out", "error")
        raise Timeout("Request to get user ID timed out") from exc
    except Exception as e:
        log_message("Error: Failed to get user ID", "error")
        raise Exception(  # pylint: disable=W0719
            "Failed to get user ID: " + str(e)
        ) from e

    if user_id_response.status_code == 200:
        data = user_id_response.json()
        return data["data"]["User"]["id"]

    log_message("Error: Failed to get user ID", "error")
    raise Exception(  # pylint: disable=W0719
        "Failed to get user ID\n"
        "Status code: " + str(user_id_response.status_code) + "\n"
        "Response: " + str(user_id_response.json())
    )


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
            genres = response_data["data"]["User"]["statistics"]["anime"]["genres"]
            data["animeGenres"] = get_top_items(genres)

        if "animeTags" in keys:
            tags = response_data["data"]["User"]["statistics"]["anime"]["tags"]
            top_tags = get_top_items(tags)
            data["animeTags"] = process_items(
                top_tags, lambda tag: {"tag": tag["tag"]["name"], "count": tag["count"]}
            )

        if "animeVoiceActors" in keys:
            voice_actors = response_data["data"]["User"]["statistics"]["anime"][
                "voiceActors"
            ]
            top_voice_actors = get_top_items(voice_actors)
            data["animeVoiceActors"] = process_items(
                top_voice_actors,
                lambda actor: {
                    "voiceActor": actor["voiceActor"]["name"]["full"],
                    "count": actor["count"],
                },
            )

        if "animeStudios" in keys:
            studios = response_data["data"]["User"]["statistics"]["anime"]["studios"]
            top_studios = get_top_items(studios)
            data["animeStudios"] = process_items(
                top_studios,
                lambda studio: {
                    "studio": studio["studio"]["name"],
                    "count": studio["count"],
                },
            )

        if "animeStaff" in keys:
            staff = response_data["data"]["User"]["statistics"]["anime"]["staff"]
            top_staff = get_top_items(staff)
            data["animeStaff"] = process_items(
                top_staff,
                lambda staff_member: {
                    "staff": staff_member["staff"]["name"]["full"],
                    "count": staff_member["count"],
                },
            )
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

        user_id = get_user_id(username)

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
            log_message(f"Data fetched for {username}: {response_data}", "debug")

            # Check for 'Internal Server Error' or 'Status': 500
            if (
                "errors" in response_data
                and any(
                    "Internal Server Error" in error.get("message")
                    or error.get("status") == 500
                    for error in response_data["errors"]
                )
            ) or (
                "error" in response_data and response_data["error"].get("status") == 500
            ):
                raise ValueError("Anilist Server Error (Try Again)")

            if response_data is None or "data" not in response_data:
                error_message = (
                    "Error: No AniList data returned in request.\n"
                    "Status code: " + str(response.status_code) + "\n"
                    "Response: " + str(response.json())
                )
                log_message(error_message, "error")
                raise ValueError(error_message)

            try:
                log_message(
                    f"Started fetching anime data for {username}, Keys: {keys}", "debug"
                )
                data.update(fetch_anime_data(response_data, keys))
                log_message(
                    f"Started fetching manga data for {username}, Keys: {keys}", "debug"
                )
                data.update(fetch_manga_data(response_data, keys))
                log_message(
                    f"Started fetching social data for {username}, Keys: {keys}",
                    "debug",
                )
                data.update(fetch_social_data(response_data))
            except Exception as e:  # pylint: disable=W0703
                log_message(f"Error: {e}", "error")
                raise e
        except requests.exceptions.RequestException as error:
            if error.response and error.response.status_code == 429:
                log_message("Rate limit exceeded", "error")
                raise error
            raise error
        return data, user_id
    except requests.exceptions.RequestException as error:
        log_message(f"Failed to fetch data for user {username}: {error}", "error")
        raise error


def get_top_items(items, top_n=5):
    """
    Sorts a list of dictionaries by a specific key and returns the top n items.

    Parameters:
    items (list): The list of dictionaries to sort.
    top_n (int, optional): The number of top items to return. Defaults to 5.

    Returns:
    list: The top n dictionaries from the list, sorted by the specified key in descending order.
    """
    top_items = sorted(items, key=lambda x: x["count"], reverse=True)[:top_n]
    return top_items


def process_items(items, process_func):
    """
    Process a list of items using a specified function.

    Args:
        items (list): The list of items to be processed.
        process_func (function): The function to apply to each item.

    Returns:
        list: A new list containing the result of applying process_func to each item in items.
    """
    return [process_func(item) for item in items]
