"""
This module is the main entry point for the AniCards application.
"""

# pylint: disable=W0511
# TODO: Add option for light or dark mode for Stat Cards (Part of Themes)
# TODO: Add option to change theme of Stat Cards (Need more to be made/designed if people want them)
# TODO: Add a Banner/Badges generator from user input (Need to implement imgur API)
# TODO: Add the colors used to generate the svg to the individual statcard tables

# Standard library imports
import os
import subprocess
import time
from threading import Thread

# Related third party imports
from typing import Dict, List
from urllib.parse import urlparse, urlunparse

import schedule
from flask import (
    Flask,
    abort,
    make_response,
    redirect,
    render_template,
    request,
    send_from_directory,
    url_for,
)

# Local application/library specific imports
from Program.Anilist import AniListData
from Program.Database import database
from Program.Database.models import (
    AnimeGenres,
    AnimeStaff,
    AnimeStats,
    AnimeStudios,
    AnimeTags,
    AnimeVoiceActors,
    MangaGenres,
    MangaStaff,
    MangaStats,
    MangaTags,
    SocialStats,
    StatCard,
    User,
)
from Program.generateSVGs import generate_svg
from Program.Utils.logger import log_message
from sqlalchemy.exc import OperationalError  # pylint: disable=C0411

# Use the imported modules
fetch_anilist_data = AniListData.fetch_anilist_data
fetch_user_id = AniListData.get_user_id
db = database.db

# Initialize Flask app
app = Flask(__name__, static_folder="public", template_folder="Pages")

# Get the DATABASE_URL environment variable
database_url = os.getenv("DATABASE_URL")

# If running on Heroku, convert the URL from postgres:// to postgresql://
if database_url:
    url = urlparse(database_url)
    if url.scheme == "postgres":
        url = url._replace(scheme="postgresql")
    database_url = urlunparse(url)

# Configure SQLAlchemy with the database URL
app.config["SQLALCHEMY_DATABASE_URI"] = database_url or "sqlite:///test.db"
db.init_app(app)

app.config["PREFERRED_URL_SCHEME"] = "https"

key_types: Dict[str, List] = {
    "animeStats": [],
    "socialStats": [],
    "mangaStats": [],
    "animeGenres": [],
    "animeTags": [],
    "animeVoiceActors": [],
    "animeStudios": [],
    "animeStaff": [],
    "mangaGenres": [],
    "mangaTags": [],
    "mangaStaff": [],
}

# Define a dictionary to map keys to classes
key_to_class = {
    "animeStats": AnimeStats,
    "socialStats": SocialStats,
    "mangaStats": MangaStats,
    "animeGenres": AnimeGenres,
    "animeTags": AnimeTags,
    "animeVoiceActors": AnimeVoiceActors,
    "animeStudios": AnimeStudios,
    "animeStaff": AnimeStaff,
    "mangaGenres": MangaGenres,
    "mangaTags": MangaTags,
    "mangaStaff": MangaStaff,
}


def get_record(key, user_id):
    """
    Fetches the record associated with the given key and user_id from the database.

    Parameters:
    key (str): The key associated with the record.
    user_id (int): The ID of the user.

    Returns:
    Record: The record associated with the key and user_id, or None if no such record exists.
    """

    # Map keys to query functions
    key_to_query = {
        "animeStats": AnimeStats.query,
        "socialStats": SocialStats.query,
        "mangaStats": MangaStats.query,
        "animeGenres": AnimeGenres.query,
        "animeTags": AnimeTags.query,
        "animeVoiceActors": AnimeVoiceActors.query,
        "animeStudios": AnimeStudios.query,
        "animeStaff": AnimeStaff.query,
        "mangaGenres": MangaGenres.query,
        "mangaTags": MangaTags.query,
        "mangaStaff": MangaStaff.query,
    }

    # Get the query function for the given key
    query = key_to_query.get(key)

    # If the key is valid, execute the query and return the result
    if query is not None:
        return query.filter_by(user_id=user_id).first()

    # If the key is not valid, return None
    return None


# Route for generating SVGs for a user
@app.route("/StatCards/<username>/generate_svgs", methods=["POST"])
def generate_svgs(username):
    """
    Generates SVGs for the given username based on the keys and colors provided in the form data.

    Parameters:
    username (str): The username of the user.

    Returns:
    Response: A redirect to the display_svgs route for the user.

    Raises:
    Exception: If an error occurs while generating the SVGs or storing them in the database.
    """

    # Define a dictionary that maps the new keys to the old keys
    key_mapping = {
        "animeStatsCheckbox": "animeStats",
        "mangaStatsCheckbox": "mangaStats",
        "socialStatsCheckbox": "socialStats",
    }

    try:
        # Fetch the user
        user = User.query.filter_by(username=username).first()
        if not user:
            # If the user doesn't exist, fetch the userid
            userid = fetch_user_id(username)
            if userid is not None:
                # Create a new user with the username and userid
                user = User(username=username, userid=userid)
                db.session.add(user)
                db.session.commit()

        log_message(f"Generating SVGs for user: {username}")
        # Get keys from the form data
        keys = request.form.getlist("keys")  # Get list of keys
        keys = [key_mapping.get(key, key) for key in keys]  # Replace keys

        # Get colors from the form data
        colors = request.form.getlist("colors")  # Get list of colors
        colors = [
            color.lstrip("#") for color in colors
        ]  # Remove '#' from the start of each color

        # If no colors were selected, use default colors
        if not colors or len(colors) != 4:
            colors = ["fe428e", "141321", "a9fef7", "fe428e"]
        else:
            default_colors = ["fe428e", "141321", "a9fef7", "fe428e"]
            colors = [
                color if color != "000000" else default
                for color, default in zip(colors, default_colors)
            ]

        # Fetch the StatCard for the user from the database
        statcard = StatCard.query.filter_by(user_id=user.userid).first()

        if not statcard:
            # If the StatCard doesn't exist, create a new one
            statcard = StatCard(user_id=user.userid)
            db.session.add(statcard)
            db.session.commit()

        successful_keys = process_keys_and_generate_svgs(
            username=username, keys=keys, colors=colors, user=user
        )

        # Update the keys in the StatCard
        existing_keys = statcard.keys.split(",") if statcard.keys else []
        new_keys = [key for key in successful_keys if key not in existing_keys]
        all_keys = existing_keys + new_keys
        keys_string = ",".join(all_keys)
        statcard.keys = keys_string

        db.session.commit()
        log_message("SVGs generated and stored in the database")

        return redirect(url_for("display_svgs", username=username))
    except OperationalError as oe:
        log_message(
            f"An error occurred while fetching SVGs for user: {username}. Database Error: {oe}",
            "error",
        )
        # Return a response indicating a database connection issue occurred
        raise Exception("Database connection issue")  # pylint: disable=W0719, W0707
    except Exception as e:
        log_message(
            "An error occurred while generating SVGs for user: "
            + username
            + ". Error: "
            + str(e),
            "error",
        )
        # Return a response indicating an error occurred
        raise e


@app.route("/StatCards/<username>", methods=["GET"])
def display_svgs(username):
    """
    Fetches the SVGs associated with the given username from the database and displays them.

    Parameters:
    username (str): The username of the user.

    Returns:
    Response: A response containing the HTML to display the SVGs,
    or a 404 error if the user or SVGs are not found.

    Raises:
    Exception: If an error occurs while fetching the SVGs from the database or rendering the HTML.
    """
    try:
        # Fetch the User for the username from the database
        user = User.query.filter_by(username=username).first()

        if not user:
            abort(404, description="User not found")

        # Fetch the StatCard for the user from the database
        statcard = StatCard.query.filter_by(user_id=user.userid).first()

        if not statcard:
            abort(404, description="No SVGs found for this user")

        log_message(f"Fetching SVGs ({statcard.keys}) for user: {username}")
        # Extract the keys from the StatCard
        keys = statcard.keys.split(",")

        # Define custom order
        custom_order = [
            "animeStats",
            "socialStats",
            "mangaStats",
            "animeGenres",
            "animeTags",
            "animeVoiceActors",
            "animeStudios",
            "animeStaff",
            "mangaGenres",
            "mangaTags",
            "mangaStaff",
        ]

        # Sort keys according to custom order
        keys.sort(
            key=lambda x: (
                custom_order.index(x) if x in custom_order else len(custom_order)
            )
        )

        # Fetch the data from the respective tables and generate the svg_types dictionary
        svg_types = {}
        for key in keys:
            svg_types[key] = key_types.get(key, [])

        # Render the HTML template
        return render_template(
            "user_template.html",
            username=username,
            svgs=svg_types,
            keys=keys,
            svg_types=svg_types,
        )

    except Exception as e:
        log_message(
            f"An error occurred while fetching SVGs for user: {username}. Error: {e}",
            "error",
        )
        # Return a response indicating an error occurred
        raise e


@app.route("/StatCards/get_svg/<username>/<key>", methods=["GET"])
def get_svg(username, key):
    """
    Fetches the SVG associated with the given username and key from the database.

    Parameters:
    username (str): The username of the user.
    key (str): The key associated with the SVG.

    Returns:
    Response: A response containing the SVG data, or a 404 error if the user or SVG is not found.

    Raises:
    Exception: If an error occurs while fetching the SVG from the database.
    """
    try:
        log_message(f"Fetching SVG for user: {username}, key: {key}", "debug")
        # Fetch the User for the username from the database
        user = User.query.filter_by(username=username).first()
        if user:
            # Fetch the data from the respective table
            record = get_record(key, user.userid)
            if record and record.data:
                response = make_response(record.data)
                response.headers["Content-Type"] = "image/svg+xml"
                return response
            abort(404, description="SVG not found")
        abort(404, description="User not found")
    except Exception as e:
        log_message(
            f"An error occurred while fetching SVG for user: {username}, key: {key}. Error: {e}",
            "error",
        )
        # Return a response indicating an error occurred
        raise e


@app.route("/StatCards/<username>/<key>.svg")
def get_svg_from_db(username, key):
    """
    Fetches the SVG associated with the given username and key from the database.

    Parameters:
    username (str): The username of the user.
    key (str): The key associated with the SVG.

    Returns:
    Response: A response containing the SVG data, or a 404 error if the user or SVG is not found.

    Raises:
    Exception: If an error occurs while fetching the SVG from the database.
    """
    try:
        log_message(f"Fetching SVG from database for user: {username}, key: {key}")
        # Fetch the User for the username from the database
        user = User.query.filter_by(username=username).first()
        if user:
            # Fetch the data from the respective table
            record = get_record(key, user.userid)
            if record and record.data:
                # Create a response with the SVG data and the correct content type
                response = make_response(record.data)
                response.headers["Content-Type"] = "image/svg+xml"

                # Add cache control headers
                response.headers["Cache-Control"] = (
                    "no-cache, must-revalidate, max-age=0"
                )
                response.headers["Pragma"] = "no-cache"
                response.headers["Expires"] = "0"

                return response

            abort(404, description="SVG not found")

        abort(404, description="User not found")
    except Exception as e:
        log_message(
            f"An error occurred while fetching SVG from database for user: "
            f"{username}, key: {key}. Error: {e}",
            "error",
        )
        # Return a response indicating an error occurred
        raise e


# StatCards route
@app.route("/StatCards")
@app.route("/StatCards/")
def stat_cards():
    """Handles requests for the StatCards route."""
    log_message("Accessing StatCards route", "info")
    return render_template("statCards.html")


@app.route("/Badges")
@app.route("/Badges/")
def badges():
    """Handles requests for the Badges route."""
    log_message("Accessing Badges route", "info")
    return render_template("badges.html")


@app.route("/faq")
def faq():
    """Handles requests for the FAQ route."""
    log_message("Accessing FAQ route", "info")
    return render_template("faq.html")


@app.route("/")
def home():
    """Handles requests for the Home route."""
    log_message("Accessing Home route", "info")
    return render_template("aniCards.html")


@app.route("/robots.txt")
def static_from_root():
    """Handles requests for the robots.txt file."""
    log_message("Accessing robots.txt", "info")
    return send_from_directory(app.static_folder, request.path[1:])


@app.errorhandler(Exception)
def handle_error(e):
    """Handles any exceptions that occur during request handling."""
    return render_template("error.html", error=str(e)), 500


# Create the database for local testing if it doesn't exist
if not os.path.exists("instance/test.db") and not database_url:
    with app.app_context():
        log_message("Creating database for local testing", "debug")
        db.create_all()


def process_keys_and_generate_svgs(username, keys, colors, user):
    """
    Process the provided keys,
    fetch the corresponding data,
    generate SVGs,
    and save the data in the database.

    Parameters:
    username (str): The username of the user.
    keys (list): The keys to process.
    colors (dict): The colors to use in the SVGs.
    user (User): The user object.
    statcard (StatCard): The statcard object.

    Returns:
    list: A list of keys for which SVGs were successfully generated.
    """
    # Define custom order
    custom_order = ["animeStats", "socialStats", "mangaStats"]

    # Sort keys according to custom order
    keys.sort(
        key=lambda x: custom_order.index(x) if x in custom_order else len(custom_order)
    )

    # Fetch the data and generate an SVG for each key
    data, userid = fetch_anilist_data(username, keys)

    # Check if a user with the given username exists
    user = User.query.filter_by(username=username).first()

    if not user:
        # If the user doesn't exist, create a new user
        user = User(username=username, userid=userid)
        db.session.add(user)
        db.session.commit()
    else:
        # If the user exists but the userid is different, update the userid
        if user.userid != userid:
            user.userid = userid
            db.session.commit()

    successful_keys = []

    for key in keys:
        svg_data = generate_svg(key, data.get(key) if data else None, username, colors)

        if svg_data is not None:
            successful_keys.append(key)  # Add the key to the list of successful keys

            # Save the data in the respective table
            record_class = key_to_class.get(key)
            if record_class:
                record = record_class.query.filter_by(user_id=user.userid).first()
                if record:
                    record.data = svg_data
                else:
                    record = record_class(data=svg_data, user_id=user.userid)
                    db.session.add(record)

    return successful_keys


def process_user(user, custom_order):
    """
    Process a user's data and generate SVGs for each key in their statcard.

    Args:
        user (User): The user to process.
        custom_order (list): The custom order to sort the keys in.
        key_to_class (dict): A mapping from keys to classes.

    Returns:
        None
    """
    statcard = StatCard.query.filter_by(user_id=user.userid).first()

    if not statcard:
        return

    # Get the keys from the statcard
    keys = statcard.keys.split(",")

    # Sort keys according to custom order
    keys.sort(
        key=lambda x: (
            custom_order.index(x) if x in custom_order else len(custom_order)
        )
    )

    # Fetch the data and generate an SVG for each key
    data = fetch_anilist_data(user.username, keys)

    # Use default colors
    colors = ["fe428e", "141321", "a9fef7", "fe428e"]

    successful_keys = []

    for key in keys:
        user_info = {"user": user, "colors": colors}
        process_key(key, data, user_info, successful_keys)

    db.session.commit()


def process_key(key, data, user_info, successful_keys):
    """
    Process a key's data and generate an SVG for it.

    Args:
        key (str): The key to process.
        data (dict): The data to generate the SVG from.
        user_info (dict): A dictionary containing the user and colors.
        successful_keys (list): A list of keys that have been successfully processed.
        key_to_class (dict): A mapping from keys to classes.

    Returns:
        None
    """
    svg_data = generate_svg(
        key,
        data.get(key) if data else None,
        user_info["user"].username,
        user_info["colors"],
    )
    if svg_data is not None:
        successful_keys.append(key)

        # Save the data in the respective table
        record_class = key_to_class.get(key)
        if record_class:
            record = record_class.query.filter_by(user_id=user_info["user"].id).first()
            if record:
                record.data = svg_data
            else:
                record = record_class(data=svg_data, user_id=user_info["user"].id)
                db.session.add(record)


def generate_svgs_for_all_users():
    """
    Fetches all users from the database, generates SVGs for each user's statcard,
    and saves the SVG data in the respective tables in the database.

    Raises:
    Exception: If an error occurs while fetching the data or generating the SVGs.
    """
    with app.app_context():
        try:
            # Fetch all users
            users = User.query.order_by(User.id).all()

            # Define custom order
            custom_order = ["animeStats", "socialStats", "mangaStats"]

            # Define a dictionary to map keys to classes

            for user in users:
                process_user(user, custom_order)

        except Exception as e:
            log_message(
                f"An error occurred while generating SVGs for all users. Error: {e}",
                "error",
            )
            raise e


def job():
    """
    Runs the job to generate SVGs for all users.
    """
    print("Running job")
    generate_svgs_for_all_users()


def run_schedule():
    """
    Runs the scheduler which periodically checks and runs pending jobs.
    """
    while True:
        print("Running scheduler")
        schedule.run_pending()
        time.sleep(1)


# schedule.every(1).minutes.do(job)

# Run the scheduler in a separate thread
scheduler_thread = Thread(target=run_schedule)
# scheduler_thread.start()

# Run the Flask app
if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.realpath(__file__))
    wrapper_path = os.path.join(script_dir, "Program", "Utils", "wrapper.py")
    subprocess.run(["python", wrapper_path], check=True)
    # app.run(debug=True)
