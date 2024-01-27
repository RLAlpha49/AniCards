
# TODO: Add option for light or dark mode for Stat Cards (Part of Themes)
# TODO: Add option to change theme of Stat Cards (Need more to be made/designed if people want them)
# TODO: Add a Banner/Badges generator from user input (Implementing imgur API & New website page to showcase Banner/Badges generated)
# TODO: Add sidebar

# Import necessary modules
from flask import Flask, abort, make_response, render_template, redirect, url_for, Response, request
from flask_sqlalchemy import SQLAlchemy
from urllib.parse import urlparse, urlunparse
from AniListData import fetch_anilist_data
from generateSVGs import generate_svg
import os

# Initialize Flask app
app = Flask(__name__, static_folder='public', template_folder='Pages/templates')

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
@app.route('/<username>/generate_svgs', methods=['POST'])
def generate_svgs(username):
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
    
    for key in keys:
        # Generate an SVG for the key
        svg_data = generate_svg(key, data.get(key) if data else None, 0, username, colors)
        # Store the SVG in the database
        svg = Svg(username=username, key=key, data=svg_data, keys=','.join(keys))
        db.session.add(svg)
    db.session.commit()

    # After generating the SVGs, redirect to the display page
    return redirect(url_for('display_svgs', username=username))

@app.route('/<username>', methods=['GET'])
def display_svgs(username):
    # Fetch the SVGs for the user from the database
    svgs = Svg.query.filter_by(username=username).all()

    if svgs:
        # Extract the keys from the first SVG (they should be the same for all SVGs)
        keys = svgs[0].keys.split(',')

        # Generate the svg_types dictionary
        svg_types = {key: [svg for svg in svgs if key in svg.keys.split(',')] for key in keys}

        # Generate the types for each key
        svg_types = {key: key_types[key] for key in svg_types}

        # Render the HTML template
        return render_template('user_template.html', username=username, svgs=svgs, keys=keys, svg_types=svg_types)
    else:
        abort(404, description="No SVGs found for this user")

# Route for getting a specific SVG for a user
@app.route('/get_svg/<username>/<key>', methods=['GET'])
def get_svg(username, key):
    svg = Svg.query.filter_by(username=username, key=key).first()
    if svg and svg.data:
        response = make_response(svg.data)
        response.headers['Content-Type'] = 'image/svg+xml'
        return response
    else:
        abort(404, description="SVG not found")
        
@app.route('/<username>/<key>.svg')
def get_svg_from_db(username, key):
    # Fetch the SVG for the user from the database
    svg = Svg.query.filter_by(username=username, key=key).first()
    if svg:
        # Return the SVG data with the correct content type
        return Response(svg.data, mimetype='image/svg+xml')
    else:
        abort(404, description="SVG not found")

# Home route
@app.route('/')
def home():
    return render_template('index.html')

# Create the database for local testing if it doesn't exist
if not os.path.exists('./test.db') and not database_url:
    with app.app_context():
        db.create_all()
        
# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)