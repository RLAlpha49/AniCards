from flask import Flask, send_from_directory, abort, make_response
from flask_sqlalchemy import SQLAlchemy
from AniListData import fetch_ani_list_data
from generateSVGs import generate_svg
import os

app = Flask(__name__, static_folder='public')
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///test.db'
db = SQLAlchemy(app)

class Svg(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), nullable=False)
    key = db.Column(db.String(80), nullable=False)
    data = db.Column(db.Text, nullable=False)

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

        # Generate an HTML document that includes img tags for all the SVGs
        img_tags = "\n".join(f'<img src="/{username}/{key}" alt="{key}">' for key in keys)
        html_document = f'<!DOCTYPE html>\n<html>\n<body>\n{img_tags}\n</body>\n</html>'
        return html_document
    else:
        abort(404, description="Too many requests")

@app.route('/<username>/<key>', methods=['GET'])
def get_svg(username, key):
    # Get the SVG from the database
    svg = Svg.query.filter_by(username=username, key=key).first()
    if svg:
        # Create a response with the SVG and set the Content-Type to image/svg+xml
        response = make_response(svg.data)
        response.headers['Content-Type'] = 'image/svg+xml'
        return response
    abort(404, description="SVG not found")

@app.route('/')
def serve_static_files():
    return send_from_directory(app.static_folder, 'index.html')

if not os.path.exists('./test.db'):
    with app.app_context():
        db.create_all()


if __name__ == '__main__':
    app.run(debug=True)