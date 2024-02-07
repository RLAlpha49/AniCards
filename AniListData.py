# pylint: disable=C0103
"""
This module is used to fetch and process data from AniList.
It uses the requests module to send HTTP requests and the queries module to handle GraphQL queries.
"""

# Import necessary modules
import requests
import queries
from logger import log_message


def fetch_user_id(username):
    """
    Fetch the user ID for a given username from AniList.

    Parameters:
        username (str): The username to fetch the ID for.

    Returns:
        int: The ID of the user, or None if the request failed.
    """
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

    return user_id_response.json()["data"]["User"]["id"]


def fetch_response_data(username, user_id):
    """
    Fetch the response data for a given username and user ID from AniList.

    Parameters:
        username (str): The username to fetch the data for.
        user_id (int): The ID of the user.

    Returns:
        dict: The response data, or None if the request failed.
    """
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

    return response_data


def extract_stats(response_data, category):
    """
    Extract the statistics for a given category from the response data.

    Parameters:
        response_data (dict): The response data to extract the statistics from.
        category (str): The category to extract the statistics for.

    Returns:
        dict: The extracted statistics.
    """
    return {
        "count": response_data["data"]["User"]["statistics"][category]["count"],
        "meanScore": response_data["data"]["User"]["statistics"][category]["meanScore"],
        "standardDeviation": response_data["data"]["User"]["statistics"][category][
            "standardDeviation"
        ],
    }


def extract_top_items(response_data, category, item, keys):
    """
    Extract the top items for a given category and item from the response data.

    Parameters:
        response_data (dict): The response data to extract the items from.
        category (str): The category to extract the items for.
        item (str): The item to extract.
        keys (list): The keys to check against.

    Returns:
        list: The top items, or None if the item is not in the keys.
    """
    if item in keys:
        items = response_data["data"]["User"]["statistics"][category][item]
        top_items = sorted(items, key=lambda x: x["count"], reverse=True)[:5]
        top_items = [
            {item: item_data[item]["name"]["full"], "count": item_data["count"]}
            for item_data in top_items
        ]
        return top_items
    return None


# Function to fetch data from AniList for a given username
def fetch_anilist_data(username, keys):
    """
    Fetches data for a given user from AniList. The data fetched depends on the keys provided.

    Parameters:
    username (str): The username of the AniList user.
    keys (list): The list of keys indicating the type of data to fetch.

    Returns:
    dict: A dictionary containing the fetched data. If an error occurs, returns None.
    """
    log_message(f"Started fetching data for {username}", "debug")

    user_id = fetch_user_id(username)
    if user_id is None:
        return None

    response_data = fetch_response_data(username, user_id)
    if response_data is None:
        return None

    data = {key: None for key in keys}

    try:
        data["animeStats"] = extract_stats(response_data, "anime")
        data["animeStats"]["episodesWatched"] = response_data["data"]["User"][
            "statistics"
        ]["anime"]["episodesWatched"]
        data["animeStats"]["minutesWatched"] = response_data["data"]["User"][
            "statistics"
        ]["anime"]["minutesWatched"]

        data["animeGenres"] = extract_top_items(response_data, "anime", "genres", keys)
        data["animeTags"] = extract_top_items(response_data, "anime", "tags", keys)
        data["animeVoiceActors"] = extract_top_items(
            response_data, "anime", "voiceActors", keys
        )
        data["animeStudios"] = extract_top_items(
            response_data, "anime", "studios", keys
        )
        data["animeStaff"] = extract_top_items(response_data, "anime", "staff", keys)

        data["mangaStats"] = extract_stats(response_data, "manga")
        data["mangaStats"]["chaptersRead"] = response_data["data"]["User"][
            "statistics"
        ]["manga"]["chaptersRead"]
        data["mangaStats"]["volumesRead"] = response_data["data"]["User"]["statistics"][
            "manga"
        ]["volumesRead"]

        data["mangaGenres"] = extract_top_items(response_data, "manga", "genres", keys)
        data["mangaTags"] = extract_top_items(response_data, "manga", "tags", keys)
        data["mangaStaff"] = extract_top_items(response_data, "manga", "staff", keys)

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
        log_message(f"Successfully fetched data for {username}", "info")
    except requests.exceptions.RequestException as error:
        if error.response and error.response.status_code == 429:
            log_message("Rate limit exceeded", "error")
            return None
        raise error

    return data
