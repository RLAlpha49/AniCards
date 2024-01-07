# AniList Stat Card Generator

This is a Flask application that generates SVG stat cards for AniList users. It fetches user data from AniList and generates an SVG image that displays the user's statistics in a visually appealing way.

## Table of Contents

- [Features](#features)
- [How it Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Running the Application](#running-the-application)
- [Deploying to Heroku](#deploying-to-heroku)
- [License](#license)
- [Disclaimer](#disclaimer)

## Features

- Fetches user data from AniList using the AniList GraphQL API.
- Generates SVG stat cards that display the user's statistics.
- Supports multiple themes for the stat cards. (Hopefully Later)
- Stores generated SVGs in a PostgreSQL database for caching.

## How it Works

The application uses Flask and SQLAlchemy to serve a web application and interact with a PostgreSQL database. When a request is made to generate SVGs for a user, the application fetches the user's data from AniList, generates an SVG image, and stores the SVG in the database. If the SVG for a user already exists in the database, the application serves the cached SVG instead of generating a new one.

## Prerequisites

Before running the application, make sure you have the following installed:

- Python
- PostgreSQL

## Running the Application

First, clone the repository:

```bash
git clone https://github.com/RLAlpha49/Anilist-Stat-Cards.git
```

Next, navigate into the cloned repository:

```bash
cd Anilist-Stat-Cards
```

Then, you can install the necessary Python packages. If you're on Windows and haven't added Python to your PATH, you might need to use 'py -m pip' instead of 'pip':

```bash
# If Python and pip are added to your PATH, or you're on macOS or Linux:
pip install -r requirements.txt

# If you're on Windows and Python is not added to your PATH:
py -m pip install -r requirements.txt
```

You can start the application with:

```bash
# If Python is added to your PATH, or you're on macOS or Linux:
python main.py

# If you're on Windows and Python is not added to your PATH:
py main.py
```

The application will be available at [http://localhost:5000](http://localhost:5000).

## Deploying to Heroku

This application is designed to be easily deployable to Heroku. It uses the `DATABASE_URL` environment variable to configure the database, and automatically converts `postgres://` URLs to `postgresql://` URLs, which are required by SQLAlchemy.

To deploy the application to Heroku, you can use the Heroku CLI:

```bash
heroku create
git push heroku master
heroku open
```

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is not affiliated with AniList in any way. It is a standalone project that uses the AniList GraphQL API to fetch user data and generate SVG stat cards.
