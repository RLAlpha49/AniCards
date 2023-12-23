# Import necessary modules
from flask import Flask, abort, make_response, render_template
from flask_sqlalchemy import SQLAlchemy
from AniListData import fetch_ani_list_data
from generateSVGs import generate_svg
import os

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

# Route for generating SVGs for a user
@app.route('/<username>', methods=['GET'])
def generate_svgs(username):
    # Delete existing SVG data for the user
    Svg.query.filter_by(username=username).delete()
    db.session.commit()

    # Fetch the data and generate an SVG for each key
    data = fetch_ani_list_data(username)
    if data:
        keys = ['animeCount', 'totalFollowers', 'totalFollowing', 'mangaCount', 'chaptersRead', 'episodesWatched', 'hoursWatched']
        for key in keys:
            # Generate an SVG for the key
            svg_data = generate_svg(key, data.get(key), 0)
            # Store the SVG in the database
            svg = Svg(username=username, key=key, data=svg_data)
            db.session.add(svg)
        db.session.commit()

        # Render the HTML template
        return render_template('user_template.html', username=username, keys=keys)
    else:
        abort(404, description="Too many requests")

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