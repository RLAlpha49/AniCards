# AniList Stat Card Generator

This is a Flask application that generates SVG stat cards for AniList users. It fetches user data from AniList and generates an SVG image that displays the user's statistics in a visually appealing way.

## Table of Contents

- [Features](#features)
- [How it Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Running the Application](#running-the-application)
  - [Deploying to Heroku](#deploying-to-heroku)
  - [Deploying with uWSGI, Nginx, and Cloudflare](#deploying-with-uwsgi-nginx-and-cloudflare)
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

## Running the Application with Waitress and Cloudflare

Waitress is a production-quality WSGI server that can be used to run your Flask application. Here's how you can run your application with Waitress and have it hosted by Cloudflare:

1. **Install Waitress**:

```bash
pip install waitress
```

2. **Navigate to your application's directory**:

```bash
cd path/to/your/application
```

Replace path/to/your/application with the actual path to your application's directory.

3. **Start your application**:

```bash
waitress-serve --port=5000 --threads=4 'main:app'
```

Replace 'main:app' with the import path to your application's Flask instance. For example, if your Flask instance is created in a file named 'app.py', you would use 'app:app'. The --threads=4 option tells Waitress to use 4 threads. Adjust this number based on your server's capabilities and the expected load on your application.

The application will now be available at [http://localhost:5000](http://localhost:5000).

3. **Configure Cloudflare**:

Go to your Cloudflare dashboard, add your domain, and update your DNS records to point to your server's IP address and port 5000. Make sure your SSL/TLS encryption mode is set to "Full".

## Deploying to Heroku

This application is designed to be easily deployable to Heroku. It uses the `DATABASE_URL` environment variable to configure the database, and automatically converts `postgres://` URLs to `postgresql://` URLs, which are required by SQLAlchemy.

To deploy the application to Heroku, you can use the Heroku CLI:

```bash
heroku create
git push heroku master
heroku open
```

## Deploying with uWSGI, Nginx, and Cloudflare

This application can also be deployed using uWSGI and Nginx, with Cloudflare as a reverse proxy. Here are the steps:

1. **Install uWSGI and Nginx**:

```bash
sudo apt-get update
sudo apt-get install python3-dev
sudo apt-get install nginx
pip install uwsgi
```

2. **Create a uWSGI Configuration File**:

Create a file named `uwsgi.ini` in your project directory:

```bash
[uwsgi]
module = main:app
master = true
processes = 5
socket = myproject.sock
chmod-socket = 660
vacuum = true
die-on-term = true
```

3. **Test uWSGI Serving**:

You can test if uWSGI is serving your application correctly:

```bash
uwsgi --ini uwsgi.ini
```

4. **Create a systemd Unit File**:

Create a file at `/etc/systemd/system/myproject.service`:

```bash
[Unit]
Description=uWSGI instance to serve myproject
After=network.target

[Service]
User=yourusername
Group=www-data
WorkingDirectory=/path/to/your/project
EnvironmentFile=/path/to/your/project/.env
ExecStart=/path/to/your/project/venv/bin/uwsgi --ini uwsgi.ini

[Install]
WantedBy=multi-user.target
```

In this file, `/path/to/your/project/.env` should be the path to a file containing your environment variables. Each line in this file should be in the format `VARNAME=value.`

```bash
USER=yourusername
GROUP=www-data
WORKING_DIRECTORY=/path/to/your/project
```

5. **Start the uWSGI service**:

```bash
sudo systemctl start myproject
sudo systemctl enable myproject
```

6. **Configure Nginx to Proxy Requests**:

Create a new server block configuration file in Nginx's `sites-available` directory. Replace `server_name` with your domain name:

```bash
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        include uwsgi_params;
        uwsgi_pass unix:/path/to/your/project/myproject.sock;
    }
}
```

7. **Link to the Nginx Configuration**:

```bash
sudo ln -s /etc/nginx/sites-available/myproject /etc/nginx/sites-enabled
```

8. **Restart Nginx**:

```bash
sudo systemctl restart nginx
```

8. **Configure Cloudflare**:

Go to your Cloudflare dashboard, add your domain, and update your DNS records to point to your server's IP address. Make sure your SSL/TLS encryption mode is set to "Full".

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This project is not affiliated with AniList in any way. It is a standalone project that uses the AniList GraphQL API to fetch user data and generate SVG stat cards.
