# AniList Stat Card Generator

This is a Flask application that generates SVG stat cards for AniList users. It fetches user data from AniList and generates an SVG image that displays the user's statistics in a visually appealing way.

## Features

- Fetches user data from AniList using the AniList GraphQL API.
- Generates SVG stat cards that display the user's statistics.
- Supports multiple themes for the stat cards.
- Stores generated SVGs in a PostgreSQL database for caching.

## How it Works

The application uses Flask and SQLAlchemy to serve a web application and interact with a PostgreSQL database. When a request is made to generate SVGs for a user, the application fetches the user's data from AniList, generates an SVG image, and stores the SVG in the database. If the SVG for a user already exists in the database, the application serves the cached SVG instead of generating a new one.

## Running the Application

To run the application locally, you need to have Python and PostgreSQL installed. Then, you can install the necessary Python packages with:

```bash
pip install -r requirements.txt
```

You can start the application with:

```bash
python main.py
```

The application will be available at http://localhost:5000.

## Deploying to Heroku

This application is designed to be easily deployable to Heroku. It uses the `DATABASE_URL` environment variable to configure the database, and automatically converts `postgres://` URLs to `postgresql://` URLs, which are required by SQLAlchemy.

To deploy the application to Heroku, you can use the Heroku CLI:

```bash
heroku create
git push heroku master
heroku open
```