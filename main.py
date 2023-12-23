
# TODO: Add option for light or dark mode for Stat Cards (Part of Themes)
# TODO: Add more stats
# TODO: Design default Stat Cards

# TODO: Add option to change theme of Stat Cards (Need more to be made/designed if people want them)


# Import necessary modules
from flask import Flask, abort, make_response, render_template, redirect, url_for, request
from flask_sqlalchemy import SQLAlchemy
from AniListData import fetch_anilist_data
from generateSVGs import generate_svg
import os
from flask import redirect
from flask import url_for

# Initialize Flask app
app = Flask(__name__, static_folder='public', template_folder='Pages/templates')

# Configure SQLAlchemy with SQLite database
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
db = SQLAlchemy(app)

# Define SVG model for SQLAlchemy
class Svg(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    key = db.Column(db.String(80), nullable=False)
    data = db.Column(db.Text, nullable=False)
    keys = db.Column(db.String(255), nullable=False)  # New column to store keys

# Route for generating SVGs for a user
@app.route('/<username>/generate_svgs', methods=['POST'])
def generate_svgs(username):
    # Get keys from the form data
    keys = request.form.getlist('keys')  # Get list of keys

    # Delete existing SVG data for the user
    Svg.query.filter_by(username=username).delete()
    db.session.commit()

    # Fetch the data and generate an SVG for each key
    data = fetch_anilist_data(username, keys)
    if data:
        for key in keys:
            # Generate an SVG for the key
            svg_data = generate_svg(key, data.get(key), 0)
            # Store the SVG in the database
            svg = Svg(username=username, key=key, data=svg_data, keys=','.join(keys))  # Save keys in database
            db.session.add(svg)
        db.session.commit()

        # After generating the SVGs, redirect to the display page
        return redirect(url_for('display_svgs', username=username))
    else:
        abort(404, description="Too many requests")

@app.route('/<username>', methods=['GET'])
def display_svgs(username):
    # Fetch the SVGs for the user from the database
    svgs = Svg.query.filter_by(username=username).all()

    if svgs:
        # Extract the keys from the first SVG (they should be the same for all SVGs)
        keys = svgs[0].keys.split(',')

        # Render the HTML template
        return render_template('user_template.html', username=username, svgs=svgs, keys=keys)
    else:
        abort(404, description="No SVGs found for this user")

# Route for getting a specific SVG for a user
@app.route('/get_svg/<username>/<key>', methods=['GET'])
def get_svg(username, key):
    svg = Svg.query.filter_by(username=username, key=key).first()
    if svg:
        response = make_response(svg.data)
        response.headers['Content-Type'] = 'image/svg+xml'
        return response
    else:
        abort(404, description="SVG not found")

# Home route
@app.route('/')
def home():
    return render_template('index.html')

# Create the database for local testing if it doesn't exist
if not os.path.exists('./test.db'):
    with app.app_context():
        db.create_all()

# Run the Flask app
if __name__ == '__main__':
    app.run(debug=True)