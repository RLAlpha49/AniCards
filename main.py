
# TODO: Add option for light or dark mode for Stat Cards (Part of Themes)
# TODO: Add option to change theme of Stat Cards (Need more to be made/designed if people want them)
# TODO: Add a Banner/Badges generator from user input (Implementing imgur API & New website page to showcase Banner/Badges generated)

# Import necessary modules
from flask import Flask, abort, make_response, render_template, redirect, url_for, Response, request, send_from_directory
from flask_sqlalchemy import SQLAlchemy
from urllib.parse import urlparse, urlunparse
from AniListData import fetch_anilist_data
from generateSVGs import generate_svg
import os
from logger import log_message

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
db = SQLAlchemy(app)

app.config['PREFERRED_URL_SCHEME'] = 'https'

# Define SVG model for SQLAlchemy
class Svg(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    key = db.Column(db.String(80), nullable=False)
    data = db.Column(db.Text, nullable=True)
    keys = db.Column(db.String(255), nullable=False)

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

# Route for generating SVGs for a user
@app.route('/AniCards/StatCards/<username>/generate_svgs', methods=['POST'])
def generate_svgs(username):
    try:
        log_message(f"Generating SVGs for user: {username}")
        # Get keys from the form data
        keys = request.form.getlist('keys')  # Get list of keys

        # Define custom order
        custom_order = ['animeStats', 'socialStats', 'mangaStats']

        # Sort keys according to custom order
        keys.sort(key=lambda x: custom_order.index(x) if x in custom_order else len(custom_order))

        # Delete existing SVG data for the user associated with the keys
        for key in keys:
            Svg.query.filter_by(username=username, key=key).delete()
        db.session.commit()

        # Fetch the data and generate an SVG for each key
        data = fetch_anilist_data(username, keys)
        
        # Get colors from the form data
        colors = request.form.getlist('colors')  # Get list of colors
        colors = [color.lstrip('#') for color in colors]  # Remove '#' from the start of each color

        # If no colors were selected, use default colors
        if not colors or len(colors) != 4:
            colors = ['fe428e', 'fe428e', 'e4e2e2', 'a9fef7']
        else:
            default_colors = ['fe428e', 'fe428e', 'e4e2e2', 'a9fef7']
            colors = [color if color != '000000' else default for color, default in zip(colors, default_colors)]
        
        successful_keys = []
        for key in keys:
            log_message(f"Generating SVG for key: {key}")
            svg_data = generate_svg(key, data.get(key) if data else None, 0, username, colors)
            print(svg_data)
            if svg_data is not None:
                successful_keys.append(key)  # Add the key to the list of successful keys
                log_message(f"Storing SVG in the database for key: {key}")
                svg = Svg(username=username, key=key, data=svg_data, keys=','.join(successful_keys))
                db.session.add(svg)
        db.session.commit()
        log_message("SVGs generated and stored in the database") 

        return redirect(url_for('display_svgs', username=username))
    except Exception as e:
        log_message(f"An error occurred while generating SVGs for user: {username}. Error: {e}", "error")
        # Return a response indicating an error occurred
        return str(e), 500

@app.route('/AniCards/StatCards/<username>', methods=['GET'])
def display_svgs(username):
    try:
        log_message(f"Fetching SVGs for user: {username}")
        # Fetch the SVGs for the user from the database
        svgs = Svg.query.filter_by(username=username).all()

        if svgs:
            # Extract the keys from all SVGs
            keys = set(key for svg in svgs for key in svg.keys.split(','))

            # Generate the svg_types dictionary
            svg_types = {key: [svg for svg in svgs if key in svg.keys.split(',')] for key in keys}

            # Render the HTML template
            return render_template('user_template.html', username=username, svgs=svgs, keys=keys, svg_types=svg_types)
        else:
            abort(404, description="No SVGs found for this user")
    except Exception as e:
        log_message(f"An error occurred while fetching SVGs for user: {username}. Error: {e}", "error")
        # Return a response indicating an error occurred
        return str(e), 500

# Route for getting a specific SVG for a user
@app.route('/AniCards/StatCards/get_svg/<username>/<key>', methods=['GET'])
def get_svg(username, key):
    try:
        log_message(f"Fetching SVG for user: {username}, key: {key}")
        svg = Svg.query.filter_by(username=username, key=key).first()
        if svg and svg.data:
            response = make_response(svg.data)
            response.headers['Content-Type'] = 'image/svg+xml'
            return response
        else:
            abort(404, description="SVG not found")
    except Exception as e:
        log_message(f"An error occurred while fetching SVG for user: {username}, key: {key}. Error: {e}", "error")
        # Return a response indicating an error occurred
        return str(e), 500

@app.route('/AniCards/StatCards/<username>/<key>.svg')
def get_svg_from_db(username, key):
    try:
        log_message(f"Fetching SVG from database for user: {username}, key: {key}")
        # Fetch the SVG for the user from the database
        svg = Svg.query.filter_by(username=username, key=key).first()
        if svg:
            # Return the SVG data with the correct content type
            return Response(svg.data, mimetype='image/svg+xml')
        else:
            abort(404, description="SVG not found")
    except Exception as e:
        log_message(f"An error occurred while fetching SVG from database for user: {username}, key: {key}. Error: {e}", "error")
        # Return a response indicating an error occurred
        return str(e), 500

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

# Create the database for local testing if it doesn't exist
if not os.path.exists('instance/test.db') and not database_url:
    with app.app_context():
        log_message('Creating database for local testing', 'debug')
        db.create_all()
        
# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)