# AniCards

[![CodeQL](https://github.com/RLAlpha49/AniCards/actions/workflows/codeql.yml/badge.svg)](https://github.com/RLAlpha49/AniCards/actions/workflows/codeql.yml)
[![Qodana](https://github.com/RLAlpha49/AniCards/actions/workflows/code_quality.yml/badge.svg)](https://github.com/RLAlpha49/AniCards/actions/workflows/code_quality.yml)
[![Lint Code Base](https://github.com/RLAlpha49/AniCards/actions/workflows/super-linter.yml/badge.svg)](https://github.com/RLAlpha49/AniCards/actions/workflows/super-linter.yml)

This is a Flask application that generates SVG stat cards for AniList users. It fetches user data from AniList and generates an SVG image that displays the user's statistics in a visually appealing way.

## Table of Contents

- [Features](#features)
- [How it Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Running the Application](#running-the-application)
  - [Deploying with Waitress & Cloudflare](#running-the-application-with-waitress-and-cloudflare)
  - [Deploying to Heroku](#deploying-to-heroku)
- [License](#license)
- [Credits](#credits)
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

- [Python](https://www.python.org/downloads/)
- [PostgreSQL](https://www.postgresql.org/download/)

## Running the Application

First, clone the repository:

```bash
git clone https://github.com/RLAlpha49/Anilist-Stat-Cards.git
```

Next, navigate into the cloned repository:

```bash
cd Anilist-Stat-Cards
```

Now, create a Python virtual environment. This will help to keep the dependencies required by different projects separate by creating isolated Python environments for them:

```bash
# If Python and venv are added to your PATH, or you're on macOS or Linux:
python3 -m venv env

# If you're on Windows and Python is not added to your PATH:
py -m venv env
```

Activate the virtual environment:

```bash
# If you're on macOS or Linux:
source env/bin/activate

# If you're on Windows:
.\env\Scripts\activate
```

Then, you can install the necessary Python packages:

```bash
pip install -r requirements.txt
```

You can start the application by running either of the following commands:

```bash
python main.py
```

or

```bash
python wrapper.py
```

Running main.py will start the application directly.

Running wrapper.py will also start the application, but in addition, it provides control commands for the server. You can use commands like "restart", "stop", "start", "pull", and "close" to control the server's operation.

The application will be available at [http://localhost:5000](http://localhost:5000).

## Running the Application with Waitress and Cloudflare

Waitress is a production-quality WSGI server that can be used to run your Flask application. Here's how you can run your application with Waitress and have it hosted by Cloudflare:

1. **Activate the Python virtual environment**:

    ```bash
    # If you're on macOS or Linux:
    source env/bin/activate

    # If you're on Windows:
    .\env\Scripts\activate
    ```

2. **Install Waitress**:

    ```bash
    pip install waitress
    ```

3. **Navigate to your application's directory and run Wrapper.py**:

    ```bash
    cd path/to/your/application
    ```

    ```bash
    python main.py
    ```

    or

    ```bash
    python wrapper.py
    ```

    Replace `path/to/your/application` with the actual path to your application's directory.

    By default, I have waitress set to use 4 threads. If you want to change this, edit this line in 'server.py' to the amount of threads you want.

    ```bash
    return subprocess.Popen(['waitress-serve', '--port=5000', '--threads=4', 'main:app'], stdout=subprocess.PIPE)
    ```

    The application will now be available at [http://localhost:5000](http://localhost:5000).

5. **Configure Cloudflare**:

    Go to your Cloudflare dashboard, add your domain, and update your DNS records to point to your server's IP address and port 5000. Make sure your SSL/TLS encryption mode is set to "Full".

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

## Credits

The default designs of the SVGs are based on the [github-profile-readme-maker](https://github.com/VishwaGauravIn/github-profile-readme-maker) repository, which is licensed under the GPL-3.0 License.

## Disclaimer

This project is not affiliated with AniList in any way. It is a standalone project that uses the AniList GraphQL API to fetch user data and generate SVG stat cards.
