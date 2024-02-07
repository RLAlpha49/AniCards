"""
This module is used to fetch and process data from AniList.
It uses the requests module to send HTTP requests and the queries module to handle GraphQL queries.
"""

# Import necessary modules
import requests
import queries
from logger import log_message


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
                "standardDeviation": response_data["data"]["User"]["statistics"][
                    "anime"
                ]["standardDeviation"],
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
                    {"tag": tag["tag"]["name"], "count": tag["count"]}
                    for tag in top_tags
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
                studios = response_data["data"]["User"]["statistics"]["anime"][
                    "studios"
                ]
                top_studios = sorted(studios, key=lambda x: x["count"], reverse=True)[
                    :5
                ]
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
                "standardDeviation": response_data["data"]["User"]["statistics"][
                    "manga"
                ]["standardDeviation"],
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
                    {"tag": tag["tag"]["name"], "count": tag["count"]}
                    for tag in top_tags
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
                    for amount in response_data["data"]["User"]["stats"][
                        "activityHistory"
                    ]
                ),
                "threadPostsCommentsCount": response_data["data"]["threadsPage"][
                    "pageInfo"
                ]["total"]
                + response_data["data"]["threadCommentsPage"]["pageInfo"]["total"],
                "totalReviews": response_data["data"]["reviewsPage"]["pageInfo"][
                    "total"
                ],
            }
            log_message(f"Successfully fetched data for {username}", "info")
        except requests.exceptions.RequestException as error:
            if error.response and error.response.status_code == 429:
                log_message("Rate limit exceeded", "error")
                return None
            raise error

        return data
    except requests.exceptions.RequestException as error:
        log_message(f"Failed to fetch data for user {username}: {error}", "error")
        return None
