
# TODO: Add option for light or dark mode for Stat Cards (Part of Themes)
# TODO: Add option to change theme of Stat Cards (Need more to be made/designed if people want them)
# TODO: Add a Banner/Badges generator from user input (Implementing imgur API & New website page to showcase Banner/Badges generated)
# TODO: Set to subdomain anicards.alpha49.com
# TODO: Add the colors used to generate the svg to the individual statcard tables

# Import necessary modules
from flask import Flask, abort, make_response, render_template, redirect, url_for, request, send_from_directory, current_app
from flask_sqlalchemy import SQLAlchemy
from urllib.parse import urlparse, urlunparse
from AniListData import fetch_anilist_data
from generateSVGs import generate_svg
import os
from logger import log_message
from database import db
import schedule
import time
from threading import Thread

# Initialize Flask app
app = Flask(__name__, static_folder='public', template_folder='Pages')

# Get the DATABASE_URL environment variable
database_url = os.getenv('DATABASE_URL')

# If running on Heroku, convert the URL from postgres:// to postgresql://
if database_url:
    url = urlparse(database_url)
    if url.scheme == 'postgres':
        url = url._replace(scheme='postgresql')
    database_url = urlunparse(url)

# Configure SQLAlchemy with the database URL
app.config['SQLALCHEMY_DATABASE_URI'] = database_url or 'sqlite:///test.db'
db.init_app(app)

# Import your models after creating the db instance
from models import (
    User, StatCard, AnimeStats, SocialStats, MangaStats, 
    AnimeGenres, AnimeTags, AnimeVoiceActors, AnimeStudios, 
    AnimeStaff, MangaGenres, MangaTags, MangaStaff
)

app.config['PREFERRED_URL_SCHEME'] = 'https'

key_types = {
    'animeStats': ['idk', 'test'],
    'socialStats': [],
    'mangaStats': [],
    'animeGenres': [],
    'animeTags': [],
    'animeVoiceActors': [],
    'animeStudios': [],
    'animeStaff': [],
    'mangaGenres': [],
    'mangaTags': [],
    'mangaStaff': [],
}

def get_record(key, user_id):
    if key == 'animeStats':
        return AnimeStats.query.filter_by(statcard_id=user_id).first()
    elif key == 'socialStats':
        return SocialStats.query.filter_by(statcard_id=user_id).first()
    elif key == 'mangaStats':
        return MangaStats.query.filter_by(statcard_id=user_id).first()
    elif key == 'animeGenres':
        return AnimeGenres.query.filter_by(statcard_id=user_id).first()
    elif key == 'animeTags':
        return AnimeTags.query.filter_by(statcard_id=user_id).first()
    elif key == 'animeVoiceActors':
        return AnimeVoiceActors.query.filter_by(statcard_id=user_id).first()
    elif key == 'animeStudios':
        return AnimeStudios.query.filter_by(statcard_id=user_id).first()
    elif key == 'animeStaff':
        return AnimeStaff.query.filter_by(statcard_id=user_id).first()
    elif key == 'mangaGenres':
        return MangaGenres.query.filter_by(statcard_id=user_id).first()
    elif key == 'mangaTags':
        return MangaTags.query.filter_by(statcard_id=user_id).first()
    elif key == 'mangaStaff':
        return MangaStaff.query.filter_by(statcard_id=user_id).first()
    else:
        return None

# Route for generating SVGs for a user
@app.route('/AniCards/StatCards/<username>/generate_svgs', methods=['POST'])
def generate_svgs(username):
    try:
        # Fetch the user
        user = User.query.filter_by(username=username).first()
        if not user:
            # If the user doesn't exist, create a new user
            user = User(username=username)
            db.session.add(user)
            db.session.commit()

        log_message(f"Generating SVGs for user: {username}")
        # Get keys from the form data
        keys = request.form.getlist('keys')  # Get list of keys

        # Get colors from the form data
        colors = request.form.getlist('colors')  # Get list of colors
        colors = [color.lstrip('#') for color in colors]  # Remove '#' from the start of each color

        # If no colors were selected, use default colors
        if not colors or len(colors) != 4:
            colors = ['fe428e', '141321', 'a9fef7', 'fe428e']
        else:
            default_colors = ['fe428e', '141321', 'a9fef7', 'fe428e']
            colors = [color if color != '000000' else default for color,
                      default in zip(colors, default_colors)]

        # Find an existing StatCard
        statcard = StatCard.query.filter_by(id=user.id).first()

        if not statcard:
            statcard = StatCard(user_id=user.id)
            db.session.add(statcard)
            db.session.commit()

        successful_keys = process_keys_and_generate_svgs(username, keys, colors, user, statcard)

        if statcard:
            existing_keys = statcard.keys.split(',') if statcard.keys else []
            new_keys = [key for key in successful_keys if key not in existing_keys]
            all_keys = existing_keys + new_keys
            keys_string = ','.join(all_keys)
            statcard.keys = keys_string
        else:
            keys_string = ','.join(successful_keys)
            statcard = StatCard(keys=keys_string, user_id=user.id)
            db.session.add(statcard)

        db.session.commit()
        log_message("SVGs generated and stored in the database")

        return redirect(url_for('display_svgs', username=username))
    except Exception as e:
        log_message(f"An error occurred while generating SVGs for user:
                    {username}. Error: {e}", "error")
        # Return a response indicating an error occurred
        raise e

@app.route('/AniCards/StatCards/<username>', methods=['GET'])
def display_svgs(username):
    try:
        # Fetch the User for the username from the database
        user = User.query.filter_by(username=username).first()

        if user:
            # Fetch the StatCard for the user from the database
            statcard = db.session.get(StatCard, user.id)

            if statcard:
                log_message(f"Fetching SVGs ({statcard.keys}) for user: {username}")
                # Extract the keys from the StatCard
                keys = statcard.keys.split(',')

                # Define custom order
                custom_order = ['animeStats', 'socialStats', 'mangaStats', 'animeGenres',
                                'animeTags', 'animeVoiceActors', 'animeStudios', 'animeStaff',
                                'mangaGenres', 'mangaTags', 'mangaStaff']

                # Sort keys according to custom order
                keys.sort(key=lambda x: custom_order.index(x)
                          if x in custom_order else len(custom_order))

                # Fetch the data from the respective tables and generate the svg_types dictionary
                svg_types = {}
                for key in keys:
                    svg_types[key] = key_types.get(key, [])

                # Render the HTML template
                return render_template('user_template.html',
                                       username=username,
                                       svgs=svg_types,
                                       keys=keys,
                                       svg_types=svg_types)
            else:
                abort(404, description="No SVGs found for this user")
        else:
            abort(404, description="User not found")
    except Exception as e:
        log_message(f"An error occurred while fetching SVGs for user:
                    {username}. Error: {e}", "error")
        # Return a response indicating an error occurred
        raise e

@app.route('/AniCards/StatCards/get_svg/<username>/<key>', methods=['GET'])
def get_svg(username, key):
    try:
        log_message(f"Fetching SVG for user: {username}, key: {key}", 'debug')
        # Fetch the User for the username from the database
        user = User.query.filter_by(username=username).first()
        if user:
            # Fetch the data from the respective table
            record = get_record(key, user.id)
            if record and record.data:
                response = make_response(record.data)
                response.headers['Content-Type'] = 'image/svg+xml'
                return response
            else:
                abort(404, description="SVG not found")
        else:
            abort(404, description="User not found")
    except Exception as e:
        log_message(f"An error occurred while fetching SVG for user:
                    {username}, key: {key}. Error: {e}", "error")
        # Return a response indicating an error occurred
        raise e

@app.route('/AniCards/StatCards/<username>/<key>.svg')
def get_svg_from_db(username, key):
    try:
        log_message(f"Fetching SVG from database for user: {username}, key: {key}")
        # Fetch the User for the username from the database
        user = User.query.filter_by(username=username).first()
        if user:
            # Fetch the data from the respective table
            record = get_record(key, user.id)
            if record and record.data:
                # Create a response with the SVG data and the correct content type
                response = make_response(record.data)
                response.headers['Content-Type'] = 'image/svg+xml'

                # Add cache control headers
                response.headers['Cache-Control'] = 'no-cache, must-revalidate, max-age=0'
                response.headers['Pragma'] = 'no-cache'
                response.headers['Expires'] = '0'

                return response
            else:
                abort(404, description="SVG not found")
        else:
            abort(404, description="User not found")
    except Exception as e:
        log_message(f"An error occurred while fetching SVG from database for user:
                    {username}, key: {key}. Error: {e}", "error")
        # Return a response indicating an error occurred
        raise e

# StatCards route
@app.route('/AniCards/StatCards/')
def statCards():
    log_message('Accessing StatCards route', 'info')
    return render_template('statCards.html')

# Home route
@app.route('/AniCards/')
def home():
    log_message('Accessing Home route', 'info')
    return render_template('aniCards.html')

@app.route('/robots.txt')
def static_from_root():
    log_message('Accessing robots.txt', 'info')
    return send_from_directory(app.static_folder, request.path[1:])

@app.errorhandler(Exception)
def handle_error(e):
    return render_template('Error.html', error=str(e)), 500

# Create the database for local testing if it doesn't exist
if not os.path.exists('instance/test.db') and not database_url:
    with app.app_context():
        log_message('Creating database for local testing', 'debug')
        db.create_all()

def process_keys_and_generate_svgs(username, keys, colors, user, statcard):
    # Define custom order
    custom_order = ['animeStats', 'socialStats', 'mangaStats']

    # Sort keys according to custom order
    keys.sort(key=lambda x: custom_order.index(x) if x in custom_order else len(custom_order))

    # Fetch the data and generate an SVG for each key
    data = fetch_anilist_data(username, keys)

    successful_keys = []

    # Define a dictionary to map keys to classes
    key_to_class = {
        'animeStats': AnimeStats,
        'socialStats': SocialStats,
        'mangaStats': MangaStats,
        'animeGenres': AnimeGenres,
        'animeTags': AnimeTags,
        'animeVoiceActors': AnimeVoiceActors,
        'animeStudios': AnimeStudios,
        'animeStaff': AnimeStaff,
        'mangaGenres': MangaGenres,
        'mangaTags': MangaTags,
        'mangaStaff': MangaStaff,
    }

    for key in keys:
        svg_data = generate_svg(key, data.get(key) if data else None, 0, username, colors)
        if svg_data is not None:
            successful_keys.append(key)  # Add the key to the list of successful keys

            # Save the data in the respective table
            record_class = key_to_class.get(key)
            if record_class:
                record = record_class.query.filter_by(statcard_id=user.id).first()
                if record:
                    record.data = svg_data
                else:
                    record = record_class(data=svg_data, statcard_id=user.id)
                    db.session.add(record)

    return successful_keys

def generate_svgs_for_all_users():
    with app.app_context():
        try:
            # Fetch all users
            users = User.query.order_by(User.id).all()

            for user in users:
                # Fetch the user's statcard
                statcard = StatCard.query.filter_by(user_id=user.id).first()

                if statcard:
                    # Get the keys from the statcard
                    keys = statcard.keys.split(',')

                    # Define custom order
                    custom_order = ['animeStats', 'socialStats', 'mangaStats']

                    # Sort keys according to custom order
                    keys.sort(key=lambda x: custom_order.index(x)
                              if x in custom_order else len(custom_order))

                    # Fetch the data and generate an SVG for each key
                    data = fetch_anilist_data(user.username, keys)

                    # Use default colors
                    colors = ['fe428e', '141321', 'a9fef7', 'fe428e']

                    successful_keys = []

                    # Define a dictionary to map keys to classes
                    key_to_class = {
                        'animeStats': AnimeStats,
                        'socialStats': SocialStats,
                        'mangaStats': MangaStats,
                        'animeGenres': AnimeGenres,
                        'animeTags': AnimeTags,
                        'animeVoiceActors': AnimeVoiceActors,
                        'animeStudios': AnimeStudios,
                        'animeStaff': AnimeStaff,
                        'mangaGenres': MangaGenres,
                        'mangaTags': MangaTags,
                        'mangaStaff': MangaStaff,
                    }

                    for key in keys:
                        svg_data = generate_svg(key,
                                                data.get(key) if data else None,
                                                0,
                                                user.username,
                                                colors)
                        if svg_data is not None:
                            successful_keys.append(key)

                            # Save the data in the respective table
                            record_class = key_to_class.get(key)
                            if record_class:
                                record = record_class.query.filter_by(statcard_id=user.id).first()
                                if record:
                                    record.data = svg_data
                                else:
                                    record = record_class(data=svg_data, statcard_id=user.id)
                                    db.session.add(record)

                    db.session.commit()
        except Exception as e:
            log_message(f"An error occurred while generating SVGs for all users. Error: {e}",
                "error")
            raise e
    
def job():
    print("Running job")
    generate_svgs_for_all_users()

def run_schedule():
    while True:
        print("Running scheduler")
        schedule.run_pending()
        time.sleep(1)

#schedule.every(1).minutes.do(job)

# Run the scheduler in a separate thread
scheduler_thread = Thread(target=run_schedule)
scheduler_thread.start()

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)
    