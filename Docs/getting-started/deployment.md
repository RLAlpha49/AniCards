---
description: Ways of deploying the application
---

# Deployment

### Deploying with Waitress & Cloudflare

Waitress is a production-quality WSGI server that can be used to run your Flask application. Here's how you can run your application with Waitress and have it hosted by Cloudflare:

1.  **Activate the Python virtual environment**:

    ```
    # If you're on macOS or Linux:
    source env/bin/activate

    # If you're on Windows:
    .\env\Scripts\activate
    ```
2.  **Install Waitress**:

    ```
    pip install waitress
    ```
3.  **Navigate to your application's directory and run Wrapper.py**:

    ```
    cd path/to/your/application
    ```

    ```
    python main.py
    ```

    or

    ```
    python wrapper.py
    ```

    Replace `path/to/your/application` with the actual path to your application's directory.

    By default, I have waitress set to use 4 threads. If you want to change this, edit this line in 'server.py' to the amount of threads you want.

    ```
    return subprocess.Popen(['waitress-serve', '--port=5000', '--threads=4', 'main:app'], stdout=subprocess.PIPE)
    ```

    The application will now be available at [http://localhost:5000](http://localhost:5000/).
4.  **Configure Cloudflare**:

    Go to your Cloudflare dashboard, add your domain, and update your DNS records to point to your server's IP address and port 5000. Make sure your SSL/TLS encryption mode is set to "Full".

### Deploying to Heroku

This application is designed to be easily deployable to Heroku. It uses the `DATABASE_URL` environment variable to configure the database, and automatically converts `postgres://` URLs to `postgresql://` URLs, which are required by SQLAlchemy.

To deploy the application to Heroku, you can use the Heroku CLI:

```
heroku create
git push heroku master
heroku open
```
