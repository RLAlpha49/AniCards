# wrapper.py
import subprocess
import time

while True:
    print("Starting server.py")
    process = subprocess.Popen(['python', 'server.py'])
    process.wait()

    # Check if server.py has exited with a special status code
    if process.returncode != 2:
        break

    print("Restarting server.py")
    time.sleep(1)  # Optional delay to prevent rapid restarts